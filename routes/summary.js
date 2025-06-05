const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/auth/login");
  next();
}

router.get("/summary", requireLogin, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.session.userId });

  const summary = [];
  const map = new Map();

  transactions.forEach(tx => {
    const date = new Date(tx.date);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    if (!map.has(key)) {
      map.set(key, { income: 0, expense: 0, year: date.getFullYear(), month: date.getMonth() + 1 });
    }
    const entry = map.get(key);
    if (tx.type === "income") entry.income += tx.amount;
    else entry.expense += tx.amount;
  });

  for (let val of map.values()) {
    val.savings = val.income - val.expense;
    summary.push(val);
  }

  summary.sort((a, b) => a.year - b.year || a.month - b.month);
  res.render("summary", { summary });
});

module.exports = router;