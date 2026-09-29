const Goal = require("../models/Goal");
const { GOAL_COLORS } = require("../config/constants");
const { todayUTC, parseDateInput } = require("../utils/dates");
const { str, parseAmount } = require("../utils/validate");
const { notFoundError } = require("../utils/http");

function goalFields(body) {
  const errors = [];
  const name = str(body.name);
  const targetAmount = parseAmount(body.targetAmount);
  const deadlineRaw = str(body.deadline);
  const deadline = deadlineRaw ? parseDateInput(deadlineRaw) : null;
  const color = GOAL_COLORS.includes(body.color) ? body.color : GOAL_COLORS[0];

  if (!name) errors.push("Give your goal a name.");
  else if (name.length > 60) errors.push("Goal name must be 60 characters or fewer.");
  if (targetAmount === null) errors.push("Enter a target amount greater than zero.");
  if (deadlineRaw && !deadline) errors.push("Enter a valid target date.");
  return { errors, value: { name, targetAmount, deadline: deadline || undefined, color } };
}

// How much to put aside each month to hit the target by the deadline.
function monthlyNeeded(goal, today) {
  if (!goal.deadline || goal.completed) return null;
  const remaining = goal.targetAmount - goal.savedAmount;
  const months =
    (goal.deadline.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (goal.deadline.getUTCMonth() - today.getUTCMonth());
  if (goal.deadline < today) return { overdue: true, remaining };
  return { overdue: false, perMonth: remaining / Math.max(1, months), months: Math.max(1, months) };
}

exports.index = async (req, res) => {
  const goals = await Goal.find({ userId: req.user._id }).sort({ createdAt: -1 });
  const today = todayUTC(req.timeZone);
  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  res.render("goals", {
    title: "Savings goals",
    goals: goals.map((g) => ({ goal: g, plan: monthlyNeeded(g, today) })),
    totalSaved,
    totalTarget,
    colors: GOAL_COLORS,
  });
};

exports.create = async (req, res) => {
  const { errors, value } = goalFields(req.body);
  const initial = str(req.body.savedAmount) ? parseAmount(req.body.savedAmount) : 0;
  if (initial === null) errors.push("Starting amount must be a positive number.");
  if (errors.length) {
    req.keepInput(req.body);
    errors.forEach((e) => req.flash("error", e));
    return res.redirect("/goals");
  }
  await Goal.create({ userId: req.user._id, ...value, savedAmount: initial });
  req.flash("success", `Goal “${value.name}” created. You've got this!`);
  res.redirect("/goals");
};

exports.update = async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw notFoundError("That goal");
  const { errors, value } = goalFields(req.body);
  if (errors.length) {
    errors.forEach((e) => req.flash("error", e));
    return res.redirect("/goals");
  }
  goal.set({ ...value, deadline: value.deadline || null });
  await goal.save();
  req.flash("success", "Goal updated.");
  res.redirect("/goals");
};

exports.contribute = async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, userId: req.user._id });
  if (!goal) throw notFoundError("That goal");
  const amount = parseAmount(req.body.amount);
  const withdraw = req.body.action === "withdraw";
  if (amount === null) {
    req.flash("error", "Enter an amount greater than zero.");
    return res.redirect("/goals");
  }
  if (withdraw && amount > goal.savedAmount) {
    req.flash("error", `You can withdraw at most ${res.locals.fmt(goal.savedAmount)} from this goal.`);
    return res.redirect("/goals");
  }

  const wasComplete = goal.completed;
  goal.savedAmount = Math.round((goal.savedAmount + (withdraw ? -amount : amount)) * 100) / 100;
  await goal.save();

  if (!wasComplete && goal.completed) req.flash("success", `🎉 You reached your “${goal.name}” goal!`);
  else req.flash("success", `${withdraw ? "Withdrew" : "Added"} ${res.locals.fmt(amount)} ${withdraw ? "from" : "to"} “${goal.name}”.`);
  res.redirect("/goals");
};

exports.remove = async (req, res) => {
  const { deletedCount } = await Goal.deleteOne({ _id: req.params.id, userId: req.user._id });
  if (!deletedCount) throw notFoundError("That goal");
  req.flash("success", "Goal deleted.");
  res.redirect("/goals");
};
