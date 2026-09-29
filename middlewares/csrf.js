const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Synchronizer-token CSRF protection: every session gets a random token that
// each state-changing request must echo back (form field `_csrf` or the
// `X-CSRF-Token` header).
function csrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();

  const sent = (req.body && req.body._csrf) || req.get("x-csrf-token") || "";
  const expected = Buffer.from(req.session.csrfToken);
  const actual = Buffer.from(String(sent));
  if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
    return next();
  }

  const err = new Error("Your session expired or the form was out of date. Please go back, refresh the page and try again.");
  err.status = 403;
  next(err);
}

module.exports = csrf;
