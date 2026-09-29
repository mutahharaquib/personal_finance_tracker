// All transaction dates are stored as UTC midnight of the calendar day the user
// picked, so every calculation here is done in UTC to avoid off-by-one days.

const DAY_MS = 24 * 60 * 60 * 1000;

const validZones = new Map();

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 64) return false;
  if (!validZones.has(timeZone)) {
    let ok = true;
    try { new Intl.DateTimeFormat("en-US", { timeZone }); } catch { ok = false; }
    validZones.set(timeZone, ok);
  }
  return validZones.get(timeZone);
}

// Today's calendar date for someone in `timeZone` (e.g. "Asia/Kolkata"), as UTC
// midnight like every stored date. Without a valid zone, today's date in UTC.
function todayUTC(timeZone) {
  const now = new Date();
  if (isValidTimeZone(timeZone)) {
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    return new Date(`${ymd}T00:00:00.000Z`);
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

// `anchorDay` keeps month-end dates stable: a rule that starts on the 31st
// lands on Feb 28 and then on Mar 31 again, instead of drifting to the 28th.
function addMonths(date, n, anchorDay) {
  const d = new Date(date);
  const day = anchorDay || d.getUTCDate();
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
function parseMonthParam(value, timeZone) {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return new Date(`${value}-01T00:00:00.000Z`);
  }
  return startOfMonth(todayUTC(timeZone));
}

function toDateInput(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

function toMonthParam(date) {
  return new Date(date).toISOString().slice(0, 7);
}

function advance(date, frequency, anchorDay) {
  switch (frequency) {
    case "daily": return addDays(date, 1);
    case "weekly": return addDays(date, 7);
    case "monthly": return addMonths(date, 1, anchorDay);
    case "yearly": return addMonths(date, 12, anchorDay);
    default: throw new Error(`Unknown frequency: ${frequency}`);
  }
}

module.exports = {
  DAY_MS, isValidTimeZone, todayUTC, startOfMonth, addMonths, addDays, daysInMonth,
  parseDateInput, parseMonthParam, toDateInput, toMonthParam, advance,
};
