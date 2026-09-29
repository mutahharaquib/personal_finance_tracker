const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCSV, toCSV } = require("../utils/csv");
const { addMonths, parseDateInput, advance } = require("../utils/dates");
const { parseAmount, passwordProblem, transactionFields } = require("../utils/validate");

test("CSV round-trips quotes, commas and newlines", () => {
  const rows = [["a", 'he said "hi"', "x,y", "line1\nline2"]];
  assert.deepEqual(parseCSV(toCSV(rows)), rows);
});

test("CSV export neutralises formula injection but keeps negative numbers", () => {
  assert.equal(toCSV([["=SUM(A1)", "-12.50", "@cmd"]]).trim(), "'=SUM(A1),-12.50,'@cmd");
});

test("CSV parser handles BOM, CRLF and blank lines", () => {
  assert.deepEqual(parseCSV("﻿Date,Amount\r\n2026-01-01,10\r\n\r\n"), [["Date", "Amount"], ["2026-01-01", "10"]]);
});

test("addMonths clamps to the end of shorter months", () => {
  assert.equal(addMonths(parseDateInput("2026-01-31"), 1).toISOString().slice(0, 10), "2026-02-28");
  assert.equal(addMonths(parseDateInput("2024-01-31"), 1).toISOString().slice(0, 10), "2024-02-29");
  assert.equal(addMonths(parseDateInput("2026-03-15"), -3).toISOString().slice(0, 10), "2025-12-15");
});

test("advance supports every frequency", () => {
  const d = parseDateInput("2026-05-10");
  assert.equal(advance(d, "daily").toISOString().slice(0, 10), "2026-05-11");
  assert.equal(advance(d, "weekly").toISOString().slice(0, 10), "2026-05-17");
  assert.equal(advance(d, "monthly").toISOString().slice(0, 10), "2026-06-10");
  assert.equal(advance(d, "yearly").toISOString().slice(0, 10), "2027-05-10");
});

test("parseDateInput rejects impossible dates", () => {
  assert.equal(parseDateInput("2026-02-30"), null);
  assert.equal(parseDateInput("26-02-01"), null);
  assert.ok(parseDateInput("2026-02-28"));
});

test("parseAmount only accepts positive finite numbers", () => {
  assert.equal(parseAmount("12.345"), 12.35);
  assert.equal(parseAmount("1,200"), 1200);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(undefined), null);
});

test("password rules", () => {
  assert.ok(passwordProblem("short1"));
  assert.ok(passwordProblem("onlyletters"));
  assert.equal(passwordProblem("letters123"), null);
});

test("transactionFields reports every problem", () => {
  const { errors } = transactionFields({ type: "gift", amount: "-1", category: "", date: "nope" });
  assert.equal(errors.length, 4);
});
