const { CURRENCIES } = require("../config/constants");

const formatters = new Map();

function getFormatter(currency, compact) {
  const key = `${currency}:${compact ? "c" : "f"}`;
  if (!formatters.has(key)) {
    const locale = (CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]).locale;
    formatters.set(
      key,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 2,
      })
    );
  }
  return formatters.get(key);
}

function formatMoney(amount, currency = "INR", { compact = false } = {}) {
  return getFormatter(currency, compact).format(Number(amount) || 0);
}

function formatDate(date, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

function monthLabel(date, style = "long") {
  return new Date(date).toLocaleDateString("en-US", { month: style, year: "numeric", timeZone: "UTC" });
}

function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

module.exports = { formatMoney, formatDate, monthLabel, percent };
