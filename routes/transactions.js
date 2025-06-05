const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/auth/login");
  next();
}

router.get("/", requireLogin, async (req, res) => {
  const transactions = await Transaction.find({
    userId: req.session.userId,
  }).sort({ date: 1 });

  // Monthly aggregation
  const summary = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.session.userId) } },
    {
      $group: {
        _id: { year: { $year: "$date" }, month: { $month: "$date" } },
        income: {
          $sum: {
            $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
          },
        },
        expense: {
          $sum: {
            $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
          },
        },
      },
    },
    {
      $project: {
        year: "$_id.year",
        month: "$_id.month",
        income: 1,
        expense: 1,
        savings: { $subtract: ["$income", "$expense"] },
      },
    },
    { $sort: { year: -1, month: -1 } },
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;

  transactions.forEach((tx) => {
    if (tx.type === "income") totalIncome += tx.amount;
    else if (tx.type === "expense") totalExpenses += tx.amount;
  });

  const totalBalance = totalIncome - totalExpenses;

  res.render("dashboard", { transactions, summary, totalIncome, totalExpenses, totalBalance });
});

router.post("/add", requireLogin, async (req, res) => {
  const { type, amount, category, date, note } = req.body;
  await new Transaction({
    userId: req.session.userId,
    type,
    amount: parseFloat(amount),
    category,
    date,
    note,
  }).save();
  res.redirect("/transactions");
});

router.post("/delete/:id", requireLogin, async (req, res) => {
  await Transaction.findByIdAndDelete(req.params.id);
  res.redirect("/transactions");
});

module.exports = router;
