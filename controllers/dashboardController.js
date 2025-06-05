const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");

exports.getDashboard = async (req, res) => {
  const transactions = await Transaction.find({
    userId: req.session.userId,
  }).sort({ date: 1 });

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
    else totalExpenses += tx.amount;
  });

  const totalBalance = totalIncome - totalExpenses;

  res.render("dashboard", { transactions, summary, totalIncome, totalExpenses, totalBalance });
};