const Transaction = require("../models/Transaction");
const Category = require("../models/Category");
const { categoryLookup } = require("../services/categories");
const { oid } = require("../services/stats");
const { transactionFields, str, parseAmount } = require("../utils/validate");
const { parseDateInput, addDays, toDateInput, todayUTC } = require("../utils/dates");
const { toCSV, parseCSV } = require("../utils/csv");
const { backTo, escapeRegex, notFoundError } = require("../utils/http");

const PAGE_SIZE = 20;
const MAX_IMPORT_ROWS = 5000;
const SORTS = {
  newest: { date: -1, createdAt: -1 },
  oldest: { date: 1, createdAt: 1 },
  highest: { amount: -1, date: -1 },
  lowest: { amount: 1, date: -1 },
};

// Turns the query string into a Mongo filter. Uses real ObjectIds and Dates so
// the same filter works for both find() and aggregate().
function buildFilter(userId, query) {
  const params = {
    q: str(query.q).slice(0, 100),
    type: ["income", "expense"].includes(query.type) ? query.type : "",
    category: str(query.category).slice(0, 40),
    from: parseDateInput(str(query.from)) ? str(query.from) : "",
    to: parseDateInput(str(query.to)) ? str(query.to) : "",
    sort: SORTS[query.sort] ? query.sort : "newest",
  };

  const filter = { userId: oid(userId) };
  if (params.type) filter.type = params.type;
  if (params.category) filter.category = params.category;
  if (params.from || params.to) {
    filter.date = {};
    if (params.from) filter.date.$gte = parseDateInput(params.from);
    if (params.to) filter.date.$lt = addDays(parseDateInput(params.to), 1);
  }
  if (params.q) {
    const re = new RegExp(escapeRegex(params.q), "i");
    filter.$or = [{ note: re }, { category: re }];
  }
  return { filter, params };
}

exports.list = async (req, res) => {
  const { filter, params } = buildFilter(req.user._id, req.query);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const [transactions, count, [sums]] = await Promise.all([
    Transaction.find(filter).sort(SORTS[params.sort]).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
        },
      },
    ]),
  ]);

  const lookup = categoryLookup(res.locals.categories);
  const queryWithout = (overrides) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...overrides })) {
      if (v && !(k === "sort" && v === "newest") && !(k === "page" && v === 1)) qs.set(k, v);
    }
    const s = qs.toString();
    return s ? `?${s}` : "";
  };

  res.render("transactions", {
    title: "Transactions",
    transactions: transactions.map((t) => ({ ...t, meta: lookup(t.type, t.category) })),
    params,
    filtered: Boolean(params.q || params.type || params.category || params.from || params.to),
    count,
    page,
    pages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
    sums: { income: sums ? sums.income : 0, expense: sums ? sums.expense : 0 },
    pageUrl: (p) => queryWithout({ page: p }),
    exportUrl: `/transactions/export${queryWithout({ page: 1 })}`,
  });
};

exports.create = async (req, res) => {
  const { errors, value } = transactionFields(req.body);
  if (errors.length) {
    req.keepInput(req.body);
    errors.forEach((e) => req.flash("error", e));
    return res.redirect(backTo(req, "/transactions"));
  }
  await Transaction.create({ userId: req.user._id, ...value });
  req.flash("success", `${value.type === "income" ? "Income" : "Expense"} of ${res.locals.fmt(value.amount)} added.`);
  res.redirect(backTo(req, "/transactions"));
};

exports.update = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, userId: req.user._id });
  if (!tx) throw notFoundError("That transaction");

  const { errors, value } = transactionFields(req.body);
  if (errors.length) {
    errors.forEach((e) => req.flash("error", e));
    return res.redirect(backTo(req, "/transactions"));
  }
  Object.assign(tx, value);
  await tx.save();
  req.flash("success", "Transaction updated.");
  res.redirect(backTo(req, "/transactions"));
};

exports.remove = async (req, res) => {
  const { deletedCount } = await Transaction.deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!deletedCount) throw notFoundError("That transaction");
  req.flash("success", "Transaction deleted.");
  res.redirect(backTo(req, "/transactions"));
};

exports.exportCSV = async (req, res) => {
  const { filter, params } = buildFilter(req.user._id, req.query);
  const rows = await Transaction.find(filter).sort(SORTS[params.sort]).lean();
  const csv = toCSV([
    ["Date", "Type", "Category", "Amount", "Note"],
    ...rows.map((t) => [toDateInput(t.date), t.type, t.category, t.amount.toFixed(2), t.note || ""]),
  ]);
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="fintrac-transactions-${toDateInput(todayUTC())}.csv"`);
  res.send("﻿" + csv); // BOM so Excel detects UTF-8
};

// Accepts YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY.
function parseImportDate(value) {
  const s = str(value);
  const iso = parseDateInput(s);
  if (iso) return iso;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? parseDateInput(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`) : null;
}

exports.importCSV = async (req, res) => {
  const text = typeof req.body.csv === "string" ? req.body.csv : "";
  const rows = parseCSV(text);
  if (rows.length < 2) {
    req.flash("error", "That file looks empty. It needs a header row and at least one transaction.");
    return res.redirect("/transactions");
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names) => header.findIndex((h) => names.includes(h));
  const idx = {
    date: col("date"),
    type: col("type"),
    category: col("category"),
    amount: col("amount"),
    note: col("note", "notes", "description", "memo"),
  };
  if (idx.date < 0 || idx.amount < 0) {
    req.flash("error", "The CSV needs at least “Date” and “Amount” columns (plus optional Type, Category, Note).");
    return res.redirect("/transactions");
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    req.flash("error", `You can import up to ${MAX_IMPORT_ROWS} rows at a time.`);
    return res.redirect("/transactions");
  }

  const docs = [];
  const problems = [];
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const rawAmount = str(row[idx.amount]).replace(/[^\d.,-]/g, "");
    const signed = Number(rawAmount.replace(/,/g, ""));
    const amount = parseAmount(String(Math.abs(signed)));
    let type = idx.type >= 0 ? str(row[idx.type]).toLowerCase() : "";
    if (!type) type = signed < 0 ? "expense" : "income";
    if (["debit", "dr", "withdrawal"].includes(type)) type = "expense";
    if (["credit", "cr", "deposit"].includes(type)) type = "income";
    const date = parseImportDate(row[idx.date]);
    const category = (idx.category >= 0 && str(row[idx.category]).slice(0, 40)) || (type === "income" ? "Other Income" : "Other");
    const note = idx.note >= 0 ? str(row[idx.note]).slice(0, 200) : "";

    if (!date || amount === null || !["income", "expense"].includes(type)) {
      problems.push(line);
    } else {
      docs.push({ userId: req.user._id, type, amount, category, note, date });
    }
  });

  if (docs.length) {
    await Transaction.insertMany(docs);
    // Make any new category names show up in pickers and filters.
    const known = new Set(res.locals.categories.map((c) => `${c.type}:${c.name}`));
    const fresh = new Map();
    for (const d of docs) {
      const key = `${d.type}:${d.category}`;
      if (!known.has(key)) fresh.set(key, { userId: req.user._id, type: d.type, name: d.category });
    }
    if (fresh.size) await Category.insertMany([...fresh.values()], { ordered: false }).catch(() => {});
  }

  if (docs.length) req.flash("success", `Imported ${docs.length} transaction${docs.length === 1 ? "" : "s"}.`);
  if (problems.length) {
    const shown = problems.slice(0, 10).join(", ");
    req.flash("error", `Skipped ${problems.length} row${problems.length === 1 ? "" : "s"} with a missing or invalid date/amount (line ${shown}${problems.length > 10 ? ", …" : ""}).`);
  }
  res.redirect("/transactions");
};
