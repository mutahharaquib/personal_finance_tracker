const Budget = require("../models/Budget");
const User = require("../models/User");
const stats = require("../services/stats");
const { categoryLookup } = require("../services/categories");
const { parseMonthParam, addMonths, todayUTC, startOfMonth, daysInMonth, toMonthParam } = require("../utils/dates");
const { monthLabel, percent } = require("../utils/format");
const { str, parseAmount } = require("../utils/validate");
const { notFoundError } = require("../utils/http");

exports.index = async (req, res) => {
  const userId = req.user._id;
  const month = parseMonthParam(req.query.month, req.timeZone);
  const nextMonth = addMonths(month, 1);
  const today = todayUTC(req.timeZone);
  const isCurrent = month.getTime() === startOfMonth(today).getTime();

  const [budgets, spentRows, monthTotals] = await Promise.all([
    Budget.find({ userId }).sort({ category: 1 }).lean(),
    stats.byCategory(userId, month, nextMonth, "expense"),
    stats.totals(userId, month, nextMonth),
  ]);

  const lookup = categoryLookup(res.locals.categories);
  const spentBy = new Map(spentRows.map((r) => [r.category, r.total]));
  const rows = budgets.map((b) => {
    const spent = spentBy.get(b.category) || 0;
    return { ...b, spent, remaining: b.amount - spent, pct: percent(spent, b.amount), meta: lookup("expense", b.category) };
  });

  const budgeted = new Set(budgets.map((b) => b.category));
  const unbudgeted = spentRows
    .filter((r) => !budgeted.has(r.category))
    .map((r) => ({ ...r, meta: lookup("expense", r.category) }));

  const daysLeft = isCurrent ? daysInMonth(month) - today.getUTCDate() + 1 : 0;
  const monthlyBudget = req.user.monthlyBudget || 0;

  res.render("budgets", {
    title: "Budgets",
    month,
    monthName: monthLabel(month),
    prevMonth: toMonthParam(addMonths(month, -1)),
    nextMonth: toMonthParam(nextMonth),
    isCurrent,
    daysLeft,
    rows,
    unbudgeted,
    totalBudgeted: budgets.reduce((s, b) => s + b.amount, 0),
    totalSpent: monthTotals.expense,
    monthlyBudget,
    overallPct: percent(monthTotals.expense, monthlyBudget),
    availableCategories: res.locals.categories.filter((c) => c.type === "expense"),
  });
};

exports.save = async (req, res) => {
  const category = str(req.body.category);
  const amount = parseAmount(req.body.amount);
  if (!category || category.length > 40 || amount === null) {
    req.flash("error", "Pick a category and enter a budget greater than zero.");
    return res.redirect("/budgets");
  }
  await Budget.findOneAndUpdate(
    { userId: req.user._id, category },
    { amount },
    { upsert: true, runValidators: true }
  );
  req.flash("success", `Monthly budget for ${category} set to ${res.locals.fmt(amount)}.`);
  res.redirect("/budgets");
};

exports.remove = async (req, res) => {
  const { deletedCount } = await Budget.deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!deletedCount) throw notFoundError("That budget");
  req.flash("success", "Budget removed.");
  res.redirect("/budgets");
};

exports.setOverall = async (req, res) => {
  const raw = str(req.body.monthlyBudget);
  const amount = raw === "" || raw === "0" ? 0 : parseAmount(raw);
  if (amount === null) {
    req.flash("error", "Enter a valid amount (or leave empty to remove the overall budget).");
    return res.redirect("/budgets");
  }
  await User.updateOne({ _id: req.user._id }, { monthlyBudget: amount });
  req.flash("success", amount ? `Overall monthly budget set to ${res.locals.fmt(amount)}.` : "Overall monthly budget removed.");
  res.redirect("/budgets");
};
