const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startDB, stopDB, agentFor, registeredAgent, csrfFrom, isoDaysAgo } = require("./helpers");

const Transaction = require("../models/Transaction");
const Category = require("../models/Category");
const User = require("../models/User");
const Recurring = require("../models/Recurring");
const mailer = require("../services/mailer");

let app;
before(async () => { app = await startDB(); });
after(stopDB);

const txId = async (email, note) => {
  const user = await User.findOne({ email });
  return (await Transaction.findOne({ userId: user._id, note }))._id;
};

describe("public pages & auth", () => {
  test("landing page renders and app pages require login", async () => {
    const home = await request(app).get("/");
    assert.equal(home.status, 200);
    assert.match(home.text, /Take control of your money/);

    const dash = await request(app).get("/dashboard");
    assert.equal(dash.status, 302);
    assert.equal(dash.headers.location, "/auth/login");
  });

  test("security headers are set", async () => {
    const res = await request(app).get("/");
    assert.match(res.headers["content-security-policy"], /script-src 'self' 'nonce-/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  test("unknown pages return a friendly 404", async () => {
    const res = await request(app).get("/definitely-not-here");
    assert.equal(res.status, 404);
    assert.match(res.text, /Page not found/);
  });

  test("POST without a CSRF token is rejected", async () => {
    const res = await request(app).post("/auth/login").type("form").send({ email: "a@b.co", password: "x" });
    assert.equal(res.status, 403);
  });

  test("registration validates input and keeps the name/email", async () => {
    const agent = await agentFor(app);
    const res = await agent.form("/auth/register", { name: "Weak", email: "weak@example.com", password: "short", confirmPassword: "short" });
    assert.equal(res.headers.location, "/auth/register");
    const page = await agent.get("/auth/register");
    assert.match(page.text, /at least 8 characters/);
    assert.match(page.text, /value="weak@example.com"/);
  });

  test("register seeds default categories and signs the user in", async () => {
    const agent = await registeredAgent(app, { name: "Aisha Khan" });
    const dash = await agent.get("/dashboard");
    assert.equal(dash.status, 200);
    assert.match(dash.text, /Hello, Aisha/);
    const user = await User.findOne({ email: agent.email });
    assert.equal(await Category.countDocuments({ userId: user._id }), 21);
  });

  test("duplicate emails are refused with a helpful message", async () => {
    const first = await registeredAgent(app);
    const agent = await agentFor(app);
    await agent.form("/auth/register", { name: "Dup", email: first.email.toUpperCase(), password: "secret123", confirmPassword: "secret123" });
    const page = await agent.get("/auth/register");
    assert.match(page.text, /already exists/);
  });

  test("login: wrong password fails, right password returns to the requested page", async () => {
    const existing = await registeredAgent(app);
    const agent = await agentFor(app);

    const bad = await agent.form("/auth/login", { email: existing.email, password: "wrongpass1" });
    assert.equal(bad.headers.location, "/auth/login");
    assert.match((await agent.get("/auth/login")).text, /don&#39;t match/);

    await agent.get("/reports"); // remembered as returnTo
    agent.csrf = csrfFrom((await agent.get("/auth/login")).text);
    const ok = await agent.form("/auth/login", { email: existing.email, password: "secret123" });
    assert.equal(ok.headers.location, "/reports");
  });

  test("logout ends the session", async () => {
    const agent = await registeredAgent(app);
    await agent.form("/auth/logout");
    const res = await agent.get("/dashboard");
    assert.equal(res.headers.location, "/auth/login");
  });

  test("password reset flow", async () => {
    const existing = await registeredAgent(app);
    const original = mailer.sendMail;
    let sent;
    mailer.sendMail = async (msg) => { sent = msg; };
    try {
      const agent = await agentFor(app);
      await agent.form("/auth/forgot", { email: existing.email });
      const token = sent.text.match(/\/auth\/reset\/([a-f0-9]{64})/)[1];

      const page = await agent.get(`/auth/reset/${token}`);
      assert.equal(page.status, 200);
      await agent.form(`/auth/reset/${token}`, { password: "newpass123", confirmPassword: "newpass123" });

      // Token is single-use.
      assert.equal((await agent.get(`/auth/reset/${token}`)).headers.location, "/auth/forgot");

      agent.csrf = csrfFrom((await agent.get("/auth/login")).text);
      const login = await agent.form("/auth/login", { email: existing.email, password: "newpass123" });
      assert.equal(login.headers.location, "/dashboard");
    } finally {
      mailer.sendMail = original;
    }
  });
});

describe("transactions", () => {
  let alice;
  let bob;
  before(async () => {
    alice = await registeredAgent(app, { name: "Alice" });
    bob = await registeredAgent(app, { name: "Bob" });
  });

  test("add, list, edit and delete", async () => {
    let res = await alice.form("/transactions", { type: "income", amount: "50000", category: "Salary", date: isoDaysAgo(2), note: "Pay day" });
    assert.equal(res.status, 302);
    await alice.form("/transactions", { type: "expense", amount: "1250.50", category: "Groceries", date: isoDaysAgo(1), note: "Weekly shop" });

    res = await alice.get("/transactions");
    assert.match(res.text, /Pay day/);
    assert.match(res.text, /Weekly shop/);
    assert.match(res.text, /2 transactions in total/);

    const id = await txId(alice.email, "Weekly shop");
    await alice.form(`/transactions/${id}`, { type: "expense", amount: "999", category: "Groceries", date: isoDaysAgo(1), note: "Edited shop" });
    const edited = await Transaction.findById(id);
    assert.equal(edited.amount, 999);
    assert.equal(edited.note, "Edited shop");

    await alice.form(`/transactions/${id}/delete`);
    assert.equal(await Transaction.findById(id), null);
  });

  test("invalid transactions are rejected", async () => {
    const before = await Transaction.countDocuments();
    await alice.form("/transactions", { type: "expense", amount: "-5", category: "Food & Dining", date: "2026-02-30" });
    await alice.form("/transactions", { type: "bogus", amount: "10", category: "Food", date: isoDaysAgo(0) });
    assert.equal(await Transaction.countDocuments(), before);
  });

  test("users cannot see, edit or delete each other's transactions", async () => {
    await alice.form("/transactions", { type: "expense", amount: "42", category: "Shopping", date: isoDaysAgo(0), note: "Alice secret" });
    const id = await txId(alice.email, "Alice secret");

    assert.doesNotMatch((await bob.get("/transactions")).text, /Alice secret/);
    assert.equal((await bob.form(`/transactions/${id}/delete`)).status, 404);
    assert.equal((await bob.form(`/transactions/${id}`, { type: "expense", amount: "1", category: "X", date: isoDaysAgo(0) })).status, 404);
    assert.equal((await Transaction.findById(id)).amount, 42);
  });

  test("malformed ids are a 404, not a crash", async () => {
    assert.equal((await alice.form("/transactions/not-an-id/delete")).status, 404);
  });

  test("filters by type, search text and date range", async () => {
    const agent = await registeredAgent(app);
    await agent.form("/transactions", { type: "income", amount: "100", category: "Freelance", date: isoDaysAgo(40), note: "Logo design" });
    await agent.form("/transactions", { type: "expense", amount: "20", category: "Transport", date: isoDaysAgo(3), note: "Uber ride" });
    await agent.form("/transactions", { type: "expense", amount: "35", category: "Food & Dining", date: isoDaysAgo(1), note: "Pizza" });

    let res = await agent.get("/transactions?type=income");
    assert.match(res.text, /Logo design/);
    assert.doesNotMatch(res.text, /Pizza/);

    res = await agent.get("/transactions?q=uber");
    assert.match(res.text, /Uber ride/);
    assert.doesNotMatch(res.text, /Logo design/);

    res = await agent.get(`/transactions?from=${isoDaysAgo(5)}&to=${isoDaysAgo(0)}`);
    assert.match(res.text, /2 transactions match/);

    res = await agent.get("/transactions?q=(unclosed[regex");
    assert.equal(res.status, 200);
  });

  test("CSV export and import", async () => {
    const agent = await registeredAgent(app);
    await agent.form("/transactions", { type: "expense", amount: "12.5", category: "Groceries", date: "2026-01-15", note: 'Milk, "organic"' });

    const exp = await agent.get("/transactions/export");
    assert.match(exp.headers["content-type"], /text\/csv/);
    assert.match(exp.text, /2026-01-15,expense,Groceries,12\.50,"Milk, ""organic"""/);

    const csv = [
      "Date,Category,Amount,Description",
      "01/02/2026,Salary,30000,Feb salary",
      "2026-02-03,Coffee,-4.20,Latte",
      "not a date,Food,10,bad row",
      "2026-02-04,Food,abc,bad amount",
    ].join("\n");
    await agent.form("/transactions/import", { csv });
    const user = await User.findOne({ email: agent.email });
    const salary = await Transaction.findOne({ userId: user._id, note: "Feb salary" });
    assert.equal(salary.type, "income");
    assert.equal(salary.date.toISOString().slice(0, 10), "2026-02-01");
    const latte = await Transaction.findOne({ userId: user._id, note: "Latte" });
    assert.equal(latte.type, "expense");
    assert.equal(latte.amount, 4.2);
    assert.equal(await Transaction.countDocuments({ userId: user._id }), 3);
    // Unknown categories become real categories.
    assert.ok(await Category.exists({ userId: user._id, name: "Coffee", type: "expense" }));
    assert.match((await agent.get("/transactions")).text, /Skipped 2 rows/);
  });
});

describe("budgets, goals, recurring, reports, settings", () => {
  let agent;
  before(async () => { agent = await registeredAgent(app, { name: "Zara" }); });

  test("budgets track spending this month", async () => {
    const today = isoDaysAgo(0);
    await agent.form("/transactions", { type: "expense", amount: "900", category: "Food & Dining", date: today });
    await agent.form("/budgets", { category: "Food & Dining", amount: "1000" });
    await agent.form("/budgets/overall", { monthlyBudget: "5000" });

    const res = await agent.get("/budgets");
    assert.equal(res.status, 200);
    assert.match(res.text, /90%/);
    assert.match(res.text, /class="progress warn"/);

    // Upsert: setting it again updates instead of duplicating.
    await agent.form("/budgets", { category: "Food & Dining", amount: "800" });
    const again = await agent.get("/budgets");
    assert.match(again.text, /class="progress over"/);
    assert.match(again.text, /over/);

    const dash = await agent.get("/dashboard");
    assert.match(dash.text, /over budget in Food &amp; Dining/);
  });

  test("goals: create, contribute, guard withdrawals, complete", async () => {
    await agent.form("/goals", { name: "New laptop", targetAmount: "1000", savedAmount: "200", color: "#10b981" });
    const Goal = require("../models/Goal");
    const goal = await Goal.findOne({ name: "New laptop" });
    assert.equal(goal.savedAmount, 200);

    await agent.form(`/goals/${goal._id}/contribute`, { amount: "5000", action: "withdraw" });
    assert.equal((await Goal.findById(goal._id)).savedAmount, 200);

    await agent.form(`/goals/${goal._id}/contribute`, { amount: "800", action: "add" });
    assert.equal((await Goal.findById(goal._id)).savedAmount, 1000);
    const page = await agent.get("/goals");
    assert.match(page.text, /reached your “New laptop” goal/);
    assert.match(page.text, /Goal reached!/);
  });

  test("recurring rules back-fill due occurrences exactly once", async () => {
    await agent.form("/recurring", { type: "expense", amount: "10", category: "Subscriptions", note: "Daily app", frequency: "daily", date: isoDaysAgo(4) });
    const user = await User.findOne({ email: agent.email });
    const count = () => Transaction.countDocuments({ userId: user._id, note: "Daily app" });
    assert.equal(await count(), 5);

    await Promise.all([agent.get("/dashboard"), agent.get("/transactions"), agent.get("/recurring")]);
    assert.equal(await count(), 5);

    const rule = await Recurring.findOne({ userId: user._id });
    assert.equal(rule.nextDate.toISOString().slice(0, 10), isoDaysAgo(-1));

    // Pausing then resuming later must not back-fill the paused days.
    await agent.form(`/recurring/${rule._id}/toggle`);
    await Recurring.updateOne({ _id: rule._id }, { nextDate: new Date(`${isoDaysAgo(3)}T00:00:00Z`) });
    await agent.form(`/recurring/${rule._id}/toggle`);
    await agent.get("/dashboard");
    assert.equal(await count(), 6); // only today's occurrence
  });

  test("reports render for every preset and custom ranges", async () => {
    for (const range of ["this-month", "last-month", "3m", "6m", "ytd", "12m"]) {
      const res = await agent.get(`/reports?range=${range}`);
      assert.equal(res.status, 200, range);
    }
    const custom = await agent.get(`/reports?range=custom&from=${isoDaysAgo(10)}&to=${isoDaysAgo(0)}`);
    assert.equal(custom.status, 200);
    assert.match(custom.text, /data-chart="trend"/);
    const bad = await agent.get("/reports?range=custom&from=2026-05-01&to=2026-01-01");
    assert.match(bad.text, /Pick a valid start and end date/);
  });

  test("settings: currency, categories and password", async () => {
    await agent.form("/settings/profile", { name: "Zara K", email: agent.email, currency: "USD" });
    assert.match((await agent.get("/dashboard")).text, /\$/);

    await agent.form("/settings/categories", { name: "Pets", type: "expense", icon: "paw-print", color: "#ff0000" });
    assert.match((await agent.get("/settings")).text, /Pets/);

    await agent.form("/settings/password", { currentPassword: "wrong", newPassword: "another123", confirmPassword: "another123" });
    assert.match((await agent.get("/settings")).text, /current password is incorrect/);
    await agent.form("/settings/password", { currentPassword: "secret123", newPassword: "another123", confirmPassword: "another123" });
    assert.match((await agent.get("/settings")).text, /Password changed/);
  });

  test("deleting the account removes all of the user's data", async () => {
    const victim = await registeredAgent(app);
    await victim.form("/transactions", { type: "expense", amount: "5", category: "Other", date: isoDaysAgo(0) });
    const user = await User.findOne({ email: victim.email });

    await victim.form("/settings/delete-account", { password: "nope" });
    assert.ok(await User.exists({ _id: user._id }));

    const res = await victim.form("/settings/delete-account", { password: "secret123" });
    assert.equal(res.headers.location, "/");
    assert.equal(await User.exists({ _id: user._id }), null);
    assert.equal(await Transaction.countDocuments({ userId: user._id }), 0);
    assert.equal(await Category.countDocuments({ userId: user._id }), 0);
  });
});
