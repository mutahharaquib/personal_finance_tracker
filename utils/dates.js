// All transaction dates are stored as UTC midnight of the calendar day the user
// picked, so every calculation here is done in UTC to avoid off-by-one days.

const DAY_MS = 24 * 60 * 60 * 1000;

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  // Clamp e.g. Jan 31 + 1 month to Feb 28/29 instead of rolling into March.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

function addDays(date, n) {
  return new Date(date.getTime() + n * DAY_MS);
}

function daysInMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

// "YYYY-MM-DD" -> Date at UTC midnight, or null when invalid.
function parseDateInput(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

// "YYYY-MM" -> first day of that month, falling back to the current month.
function parseMonthParam(value) {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return new Date(`${value}-01T00:00:00.000Z`);
  }
  return startOfMonth(todayUTC());
}

function toDateInput(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

function toMonthParam(date) {
  return new Date(date).toISOString().slice(0, 7);
}

function advance(date, frequency) {
  switch (frequency) {
    case "daily": return addDays(date, 1);
    case "weekly": return addDays(date, 7);
    case "monthly": return addMonths(date, 1);
    case "yearly": return addMonths(date, 12);
    default: throw new Error(`Unknown frequency: ${frequency}`);
  }
}

module.exports = {
  DAY_MS, todayUTC, startOfMonth, addMonths, addDays, daysInMonth,
  parseDateInput, parseMonthParam, toDateInput, toMonthParam, advance,
};
