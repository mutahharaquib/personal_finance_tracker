const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const { seedDefaults } = require("../services/categories");
const mailer = require("../services/mailer");
const { str, isEmail, passwordProblem } = require("../utils/validate");

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Starts a fresh session for the user (prevents session fixation).
function signIn(req, userId) {
  const returnTo = req.session.returnTo;
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = String(userId);
      resolve(returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard");
    });
  });
}

exports.getLogin = (req, res) => res.render("auth/login", { title: "Log in" });

exports.postLogin = async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";

  const user = email ? await User.findOne({ email }) : null;
  const ok = user ? await bcrypt.compare(password, user.password) : false;
  if (!ok) {
    req.keepInput({ email });
    req.flash("error", "That email and password don't match. Please try again.");
    return res.redirect("/auth/login");
  }

  const destination = await signIn(req, user._id);
  req.flash("success", `Welcome back, ${user.name.split(" ")[0]}!`);
  res.redirect(destination);
};

exports.getRegister = (req, res) => res.render("auth/register", { title: "Create account" });

exports.postRegister = async (req, res) => {
  const name = str(req.body.name);
  const email = str(req.body.email).toLowerCase();
  const { password, confirmPassword } = req.body;

  const errors = [];
  if (!name) errors.push("Tell us your name.");
  else if (name.length > 60) errors.push("Name must be 60 characters or fewer.");
  if (!isEmail(email)) errors.push("Enter a valid email address.");
  const pwProblem = passwordProblem(password);
  if (pwProblem) errors.push(pwProblem);
  else if (password !== confirmPassword) errors.push("Passwords don't match.");

  if (!errors.length && (await User.exists({ email }))) {
    errors.push("An account with this email already exists. Try logging in instead.");
  }

  if (errors.length) {
    req.keepInput({ name, email });
    errors.forEach((e) => req.flash("error", e));
    return res.redirect("/auth/register");
  }

  let user;
  try {
    user = await User.create({ name, email, password: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Lost a race with a simultaneous signup for the same email.
    req.keepInput({ name, email });
    req.flash("error", "An account with this email already exists. Try logging in instead.");
    return res.redirect("/auth/register");
  }
  await seedDefaults(user._id);

  await signIn(req, user._id);
  req.flash("success", `Welcome to FinTrac, ${name.split(" ")[0]}! Add your first transaction to get started.`);
  res.redirect("/dashboard");
};

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("fintrac.sid");
    res.redirect("/");
  });
};

exports.getForgot = (req, res) => res.render("auth/forgot", { title: "Reset password" });

exports.postForgot = async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const user = isEmail(email) ? await User.findOne({ email }) : null;

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const base = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    await mailer.sendMail({
      to: user.email,
      subject: "Reset your FinTrac password",
      text: `Hi ${user.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${base}/auth/reset/${token}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
  }

  // Same response either way so the form can't be used to discover accounts.
  req.flash("success", "If an account exists for that email, a reset link is on its way.");
  res.redirect("/auth/login");
};

async function findByResetToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return User.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
  });
}

exports.getReset = async (req, res) => {
  const user = await findByResetToken(req.params.token);
  if (!user) {
    req.flash("error", "That reset link is invalid or has expired. Request a new one.");
    return res.redirect("/auth/forgot");
  }
  res.render("auth/reset", { title: "Choose a new password", token: req.params.token });
};

exports.postReset = async (req, res) => {
  const user = await findByResetToken(req.params.token);
  if (!user) {
    req.flash("error", "That reset link is invalid or has expired. Request a new one.");
    return res.redirect("/auth/forgot");
  }

  const { password, confirmPassword } = req.body;
  const problem = passwordProblem(password) || (password !== confirmPassword ? "Passwords don't match." : null);
  if (problem) {
    req.flash("error", problem);
    return res.redirect(`/auth/reset/${req.params.token}`);
  }

  user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  req.flash("success", "Password updated. You can log in with your new password.");
  res.redirect("/auth/login");
};

exports.BCRYPT_ROUNDS = BCRYPT_ROUNDS;
