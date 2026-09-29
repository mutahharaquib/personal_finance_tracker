const User = require("../models/User");
const { getCategories } = require("../services/categories");
const { processDueRecurring } = require("../services/recurring");
const { formatMoney } = require("../utils/format");
const { CURRENCIES } = require("../config/constants");

// Guards app pages: loads the signed-in user, their categories (used by the
// global "add transaction" dialog) and posts any recurring transactions due.
async function requireLogin(req, res, next) {
  if (!req.session.userId) {
    if (req.method === "GET") req.session.returnTo = req.originalUrl;
    req.flash("info", "Please log in to continue.");
    return res.redirect("/auth/login");
  }

  const user = await User.findById(req.session.userId).lean();
  if (!user) {
    return req.session.destroy(() => res.redirect("/auth/login"));
  }

  if (req.method === "GET") await processDueRecurring(user._id);

  req.user = user;
  res.locals.currentUser = user;
  res.locals.categories = await getCategories(user._id);
  res.locals.fmt = (amount, opts) => formatMoney(amount, user.currency, opts);
  res.locals.chartLocale = {
    currency: user.currency,
    locale: (CURRENCIES.find((c) => c.code === user.currency) || CURRENCIES[0]).locale,
  };
  next();
}

// Keeps signed-in users away from the login/register pages.
function guestOnly(req, res, next) {
  if (req.session.userId) return res.redirect("/dashboard");
  next();
}

module.exports = { requireLogin, guestOnly };
