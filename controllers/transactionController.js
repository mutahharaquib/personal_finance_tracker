const Transaction = require("../models/Transaction");

exports.getSummary = async (req, res) => {
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
};

exports.addTransaction = async (req, res) => {
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
};

exports.deleteTransaction = async (req, res) => {
  await Transaction.findByIdAndDelete(req.params.id);
  res.redirect("/transactions");
};