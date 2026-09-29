const Transaction = require("../models/Transaction");
const stats = require("../services/stats");
const { categoryLookup } = require("../services/categories");
const { todayUTC, startOfMonth, addMonths, addDays, parseDateInput, toDateInput, DAY_MS } = require("../utils/dates");
const { monthLabel, formatDate, percent } = require("../utils/format");
const { str } = require("../utils/validate");

const PRESETS = {
  "this-month": "This month",
  "last-month": "Last month",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  ytd: "Year to date",
  "12m": "Last 12 months",
  custom: "Custom range",
};

// Resolves the requested range to [from, to) in UTC days.
function resolveRange(query, today) {
  const month = startOfMonth(today);
  const range = PRESETS[query.range] ? query.range : "this-month";
  switch (range) {
    case "last-month": return { range, from: addMonths(month, -1), to: month };
    case "3m": return { range, from: addMonths(month, -2), to: addMonths(month, 1) };
    case "6m": return { range, from: addMonths(month, -5), to: addMonths(month, 1) };
    case "12m": return { range, from: addMonths(month, -11), to: addMonths(month, 1) };
    case "ytd": return { range, from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), to: addMonths(month, 1) };
    case "custom": {
      const from = parseDateInput(str(query.from));
      const to = parseDateInput(str(query.to));
      if (from && to && from <= to) return { range, from, to: addDays(to, 1) };
      return { range: "this-month", from: month, to: addMonths(month, 1), invalid: true };
    }
    default: return { range, from: month, to: addMonths(month, 1) };
  }
}

exports.index = async (req, res) => {
  const userId = req.user._id;
  const { range, from, to, invalid } = resolveRange(req.query, todayUTC(req.timeZone));
  if (invalid && req.query.range === "custom") {
    res.locals.flash.push({ type: "error", message: "Pick a valid start and end date for a custom range." });
  }

  const days = Math.round((to - from) / DAY_MS);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);
  const useDaily = days <= 62;

  const [current, previous, expenseCats, incomeCats, topExpenses, series] = await Promise.all([
    stats.totals(userId, from, to),
    stats.totals(userId, prevFrom, from),
    stats.byCategory(userId, from, to, "expense"),
    stats.byCategory(userId, from, to, "income"),
    Transaction.find({ userId, type: "expense", date: { $gte: from, $lt: to } }).sort({ amount: -1 }).limit(5).lean(),
    useDaily ? stats.dailySeries(userId, from, to) : stats.monthlySeries(userId, from, to),
  ]);

  // Daily values are spiky (one salary day dwarfs everything), so daily ranges
  // show running totals instead.
  if (useDaily) {
    let income = 0;
    let expense = 0;
    for (const s of series) {
      income += s.income;
      expense += s.expense;
      s.income = income;
      s.expense = expense;
    }
  }

  const lookup = categoryLookup(res.locals.categories);
  const withMeta = (rows, type, total) =>
    rows.map((r) => ({ ...r, meta: lookup(type, r.category), pct: percent(r.total, total) }));
  const change = (now, before) => (before > 0 ? percent(now - before, before) : null);

  // Clamp "days so far" for ranges that include the future (e.g. this month).
  const elapsedDays = Math.max(1, Math.min(days, Math.round((addDays(todayUTC(req.timeZone), 1) - from) / DAY_MS)));

  res.render("reports", {
    title: "Reports",
    presets: PRESETS,
    range,
    fromInput: toDateInput(from),
    toInput: toDateInput(addDays(to, -1)),
    rangeLabel: `${formatDate(from)} – ${formatDate(addDays(to, -1))}`,
    current,
    changes: {
      income: change(current.income, previous.income),
      expense: change(current.expense, previous.expense),
    },
    savingsRate: current.income > 0 ? Math.round((current.net / current.income) * 100) : null,
    avgDaily: current.expense / elapsedDays,
    expenseCats: withMeta(expenseCats, "expense", current.expense),
    incomeCats: withMeta(incomeCats, "income", current.income),
    topExpenses: topExpenses.map((t) => ({ ...t, meta: lookup("expense", t.category) })),
    cumulative: useDaily,
    exportUrl: `/transactions/export?from=${toDateInput(from)}&to=${toDateInput(addDays(to, -1))}`,
    chart: {
      trend: {
        labels: series.map((s) => (useDaily ? formatDate(s.day, { day: "numeric", month: "short" }) : monthLabel(s.month, "short"))),
        income: series.map((s) => s.income),
        expense: series.map((s) => s.expense),
      },
      categories: expenseCats.slice(0, 10).map((c) => ({
        label: c.category,
        value: c.total,
        color: lookup("expense", c.category).color,
      })),
    },
  });
};
