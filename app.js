const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");

const csrf = require("./middlewares/csrf");
const flash = require("./middlewares/flash");
const { notFound, errorHandler } = require("./middlewares/errors");
const { formatDate, monthLabel, formatMoney } = require("./utils/format");
const { isValidTimeZone } = require("./utils/dates");

function createApp({ sessionStore, sessionSecret }) {
  const app = express();
  const isProd = process.env.NODE_ENV === "production";

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  if (isProd) app.set("trust proxy", 1);

  // Per-request nonce so the tiny inline theme script is allowed by the CSP.
  app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString("base64");
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:"],
          // Allow plain-HTTP form posts when running locally without TLS.
          "upgrade-insecure-requests": isProd ? [] : null,
        },
      },
    })
  );

  app.use(express.static(path.join(__dirname, "public"), { maxAge: isProd ? "7d" : 0 }));
  app.use("/vendor/chart.js", express.static(path.join(__dirname, "node_modules/chart.js/dist")));
  app.use("/vendor/lucide", express.static(path.join(__dirname, "node_modules/lucide/dist/umd")));

  app.use(express.urlencoded({ extended: false, limit: "2mb" }));
  app.use(express.json({ limit: "100kb" }));

  app.use(
    session({
      name: "fintrac.sid",
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days, refreshed on activity
      },
    })
  );

  app.use(flash);
  app.use(csrf);

  // The browser reports its timezone in a `tz` cookie (see partials/head.ejs).
  app.use((req, res, next) => {
    const match = /(?:^|;\s*)tz=([^;]+)/.exec(req.headers.cookie || "");
    let tz = null;
    try { tz = match && decodeURIComponent(match[1]); } catch { tz = null; }
    req.timeZone = isValidTimeZone(tz) ? tz : process.env.APP_TIMEZONE;
    next();
  });

  // Helpers available in every view.
  app.use((req, res, next) => {
    res.locals.path = req.originalUrl.split("?")[0];
    res.locals.originalUrl = req.originalUrl;
    res.locals.formatDate = formatDate;
    res.locals.monthLabel = monthLabel;
    res.locals.currentUser = null;
    res.locals.fmt = (amount, opts) => formatMoney(amount, "INR", opts);
    // JSON that is safe to embed inside a <script type="application/json"> tag.
    res.locals.json = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
    next();
  });

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/", require("./routes/index"));
  app.use("/auth", require("./routes/auth"));
  app.use("/dashboard", require("./routes/dashboard"));
  app.use("/transactions", require("./routes/transactions"));
  app.use("/budgets", require("./routes/budgets"));
  app.use("/goals", require("./routes/goals"));
  app.use("/recurring", require("./routes/recurring"));
  app.use("/reports", require("./routes/reports"));
  app.use("/settings", require("./routes/settings"));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
