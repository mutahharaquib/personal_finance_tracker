const Recurring = require("../models/Recurring");
const { FREQUENCIES } = require("../config/constants");
const { categoryLookup } = require("../services/categories");
const { processDueRecurring } = require("../services/recurring");
const { todayUTC, advance, parseDateInput, addMonths } = require("../utils/dates");
const { transactionFields, str } = require("../utils/validate");
const { notFoundError } = require("../utils/http");

// Rough monthly equivalent, used for the "committed per month" summary.
const PER_MONTH = { daily: 30.44, weekly: 4.35, monthly: 1, yearly: 1 / 12 };

exports.index = async (req, res) => {
  const rules = await Recurring.find({ userId: req.user._id }).sort({ active: -1, nextDate: 1 }).lean();
  const lookup = categoryLookup(res.locals.categories);

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const r of rules.filter((x) => x.active)) {
    const perMonth = r.amount * PER_MONTH[r.frequency];
    if (r.type === "income") monthlyIncome += perMonth;
    else monthlyExpense += perMonth;
  }

  res.render("recurring", {
    title: "Recurring",
    rules: rules.map((r) => ({ ...r, meta: lookup(r.type, r.category) })),
    frequencies: FREQUENCIES,
    monthlyIncome,
    monthlyExpense,
  });
};

exports.create = async (req, res) => {
  const { errors, value } = transactionFields(req.body);
  const frequency = FREQUENCIES.includes(req.body.frequency) ? req.body.frequency : null;
  const endRaw = str(req.body.endDate);
  const endDate = endRaw ? parseDateInput(endRaw) : null;

  if (!frequency) errors.push("Choose how often this repeats.");
  if (endRaw && !endDate) errors.push("Enter a valid end date.");
  if (endDate && value.date && endDate < value.date) errors.push("End date must be after the start date.");
  if (value.date && value.date > addMonths(todayUTC(), 12 * 5)) errors.push("Start date must be within the next 5 years.");

  if (errors.length) {
    req.keepInput(req.body);
    errors.forEach((e) => req.flash("error", e));
    return res.redirect("/recurring");
  }

  const { date, ...rest } = value;
  await Recurring.create({ userId: req.user._id, ...rest, frequency, nextDate: date, endDate: endDate || undefined });
  const posted = await processDueRecurring(req.user._id);
  req.flash(
    "success",
    posted
      ? `Recurring ${value.type} created — ${posted} past occurrence${posted === 1 ? " was" : "s were"} added to your transactions.`
      : `Recurring ${value.type} created. It will be added automatically on each due date.`
  );
  res.redirect("/recurring");
};

exports.toggle = async (req, res) => {
  const rule = await Recurring.findOne({ _id: req.params.id, userId: req.user._id });
  if (!rule) throw notFoundError("That recurring rule");

  rule.active = !rule.active;
  if (rule.active) {
    // Resuming shouldn't back-fill everything that was skipped while paused.
    const today = todayUTC();
    while (rule.nextDate < today) rule.nextDate = advance(rule.nextDate, rule.frequency);
  }
  await rule.save();
  req.flash("success", rule.active ? "Recurring rule resumed." : "Recurring rule paused.");
  res.redirect("/recurring");
};

exports.remove = async (req, res) => {
  const { deletedCount } = await Recurring.deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!deletedCount) throw notFoundError("That recurring rule");
  req.flash("success", "Recurring rule deleted. Transactions it already created were kept.");
  res.redirect("/recurring");
};
