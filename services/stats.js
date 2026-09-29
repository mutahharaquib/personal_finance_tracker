const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const { addMonths, addDays, startOfMonth, DAY_MS } = require("../utils/dates");

const oid = (id) => new mongoose.Types.ObjectId(String(id));

function rangeMatch(userId, from, to) {
  const match = { userId: oid(userId) };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lt = to;
  }
  return match;
}

// { income, expense, net, count } for the range (both ends optional; `to` exclusive).
async function totals(userId, from, to) {
  const [row] = await Transaction.aggregate([
    { $match: rangeMatch(userId, from, to) },
    {
      $group: {
        _id: null,
        income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
        expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
        count: { $sum: 1 },
      },
    },
  ]);
  const income = row ? row.income : 0;
  const expense = row ? row.expense : 0;
  return { income, expense, net: income - expense, count: row ? row.count : 0 };
}

// [{ category, total, count }] sorted by total, descending.
async function byCategory(userId, from, to, type = "expense") {
  const rows = await Transaction.aggregate([
    { $match: { ...rangeMatch(userId, from, to), type } },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, total: r.total, count: r.count }));
}

// Income/expense per calendar month for [from, to), zero-filled.
async function monthlySeries(userId, from, to) {
  const rows = await Transaction.aggregate([
    { $match: rangeMatch(userId, from, to) },
    {
      $group: {
        _id: { y: { $year: "$date" }, m: { $month: "$date" } },
        income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
        expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
      },
    },
  ]);
  const byKey = new Map(rows.map((r) => [`${r._id.y}-${r._id.m}`, r]));
  const series = [];
  for (let month = startOfMonth(from); month < to; month = addMonths(month, 1)) {
    const r = byKey.get(`${month.getUTCFullYear()}-${month.getUTCMonth() + 1}`);
    const income = r ? r.income : 0;
    const expense = r ? r.expense : 0;
    series.push({ month, income, expense, net: income - expense });
  }
  return series;
}

// Income/expense per day in [from, to), zero-filled.
async function dailySeries(userId, from, to) {
  const rows = await Transaction.aggregate([
    { $match: rangeMatch(userId, from, to) },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
        expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
      },
    },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const series = [];
  const days = Math.round((to - from) / DAY_MS);
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const r = byDay.get(day.toISOString().slice(0, 10));
    series.push({ day, income: r ? r.income : 0, expense: r ? r.expense : 0 });
  }
  return series;
}

module.exports = { totals, byCategory, monthlySeries, dailySeries, oid };
