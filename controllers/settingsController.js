const bcrypt = require("bcrypt");
const User = require("../models/User");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const Recurring = require("../models/Recurring");
const { CURRENCIES, CATEGORY_ICONS } = require("../config/constants");
const { BCRYPT_ROUNDS } = require("./authController");
const { str, isEmail, passwordProblem } = require("../utils/validate");
const { notFoundError } = require("../utils/http");

exports.index = async (req, res) => {
  const usage = await Transaction.aggregate([
    { $match: { userId: req.user._id } },
    { $group: { _id: { type: "$type", category: "$category" }, count: { $sum: 1 } } },
  ]);
  const usageCount = new Map(usage.map((u) => [`${u._id.type}:${u._id.category}`, u.count]));

  res.render("settings", {
    title: "Settings",
    currencies: CURRENCIES,
    icons: CATEGORY_ICONS,
    usageCount: (c) => usageCount.get(`${c.type}:${c.name}`) || 0,
  });
};

exports.updateProfile = async (req, res) => {
  const name = str(req.body.name);
  const email = str(req.body.email).toLowerCase();
  const currency = CURRENCIES.some((c) => c.code === req.body.currency) ? req.body.currency : req.user.currency;

  const errors = [];
  if (!name || name.length > 60) errors.push("Name must be between 1 and 60 characters.");
  if (!isEmail(email)) errors.push("Enter a valid email address.");
  else if (email !== req.user.email && (await User.exists({ email }))) errors.push("That email is already used by another account.");
  if (errors.length) {
    errors.forEach((e) => req.flash("error", e));
    return res.redirect("/settings");
  }

  try {
    await User.updateOne({ _id: req.user._id }, { name, email, currency });
  } catch (err) {
    if (err.code !== 11000) throw err;
    req.flash("error", "That email is already used by another account.");
    return res.redirect("/settings");
  }
  req.flash("success", "Profile saved.");
  res.redirect("/settings");
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = await User.findById(req.user._id);

  if (!(await bcrypt.compare(String(currentPassword || ""), user.password))) {
    req.flash("error", "Your current password is incorrect.");
    return res.redirect("/settings#security");
  }
  const problem = passwordProblem(newPassword) || (newPassword !== confirmPassword ? "New passwords don't match." : null);
  if (problem) {
    req.flash("error", problem);
    return res.redirect("/settings#security");
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();
  req.flash("success", "Password changed.");
  res.redirect("/settings#security");
};

exports.addCategory = async (req, res) => {
  const name = str(req.body.name);
  const type = req.body.type === "income" ? "income" : "expense";
  const icon = CATEGORY_ICONS.includes(req.body.icon) ? req.body.icon : "tag";
  const color = /^#[0-9a-f]{6}$/i.test(req.body.color) ? req.body.color : "#64748b";

  if (!name || name.length > 40) {
    req.flash("error", "Category name must be between 1 and 40 characters.");
    return res.redirect("/settings#categories");
  }
  try {
    await Category.create({ userId: req.user._id, name, type, icon, color });
    req.flash("success", `Category “${name}” added.`);
  } catch (err) {
    if (err.code !== 11000) throw err;
    req.flash("error", `You already have an ${type} category called “${name}”.`);
  }
  res.redirect("/settings#categories");
};

exports.deleteCategory = async (req, res) => {
  const cat = await Category.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!cat) throw notFoundError("That category");
  req.flash("success", `Category “${cat.name}” removed. Existing transactions keep their category name.`);
  res.redirect("/settings#categories");
};

exports.deleteAccount = async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(String(req.body.password || ""), user.password))) {
    req.flash("error", "Password incorrect — your account was not deleted.");
    return res.redirect("/settings#danger");
  }

  const userId = user._id;
  await Promise.all([
    Transaction.deleteMany({ userId }),
    Category.deleteMany({ userId }),
    Budget.deleteMany({ userId }),
    Goal.deleteMany({ userId }),
    Recurring.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("fintrac.sid");
    res.redirect("/");
  });
};
