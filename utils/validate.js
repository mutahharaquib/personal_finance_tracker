const { parseDateInput } = require("./dates");

const MAX_AMOUNT = 1e11;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Returns a positive amount rounded to 2 decimals, or null.
function parseAmount(value) {
  const n = Number(str(value).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

function isEmail(value) {
  return EMAIL_RE.test(value) && value.length <= 254;
}

function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must contain letters and numbers.";
  return null;
}

// Validates the fields shared by transactions and recurring rules.
function transactionFields(body, { requireDate = true } = {}) {
  const errors = [];
  const type = str(body.type);
  const amount = parseAmount(body.amount);
  const category = str(body.category);
  const note = str(body.note);
  const date = parseDateInput(str(body.date));

  if (!["income", "expense"].includes(type)) errors.push("Choose whether this is income or an expense.");
  if (amount === null) errors.push("Enter an amount greater than zero.");
  if (!category) errors.push("Choose a category.");
  else if (category.length > 40) errors.push("Category must be 40 characters or fewer.");
  if (note.length > 200) errors.push("Note must be 200 characters or fewer.");
  if (requireDate && !date) errors.push("Enter a valid date.");

  return { errors, value: { type, amount, category, note, date } };
}

module.exports = { str, parseAmount, isEmail, passwordProblem, transactionFields };
