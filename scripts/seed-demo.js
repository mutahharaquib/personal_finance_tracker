// Creates (or resets) a demo account with ~6 months of realistic data.
//   npm run seed:demo
// Log in with demo@fintrac.app / demo1234
require("dotenv").config();

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Category = require("../models/Category");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const Recurring = require("../models/Recurring");
const { seedDefaults } = require("../services/categories");
const { todayUTC, startOfMonth, addMonths, addDays } = require("../utils/dates");

const EMAIL = "demo@fintrac.app";
const PASSWORD = "demo1234";

// Deterministic pseudo-random numbers so every run looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100;

const EXPENSES = [
  { category: "Food & Dining", notes: ["Lunch with team", "Biryani night", "Coffee", "Pizza Friday", "Chai & snacks"], min: 80, max: 900, perMonth: 12 },
  { category: "Groceries", notes: ["Weekly groceries", "Vegetables", "Supermarket run", "Milk & bread"], min: 300, max: 2500, perMonth: 5 },
  { category: "Transport", notes: ["Metro card top-up", "Uber", "Auto rickshaw", "Petrol"], min: 50, max: 1200, perMonth: 8 },
  { category: "Shopping", notes: ["New shoes", "T-shirts", "Headphones", "Amazon order"], min: 400, max: 4000, perMonth: 2 },
  { category: "Entertainment", notes: ["Movie tickets", "Concert", "Bowling", "Gaming"], min: 200, max: 1500, perMonth: 2 },
  { category: "Health", notes: ["Pharmacy", "Doctor visit", "Gym supplements"], min: 150, max: 2000, perMonth: 1 },
  { category: "Personal Care", notes: ["Haircut", "Skincare"], min: 150, max: 800, perMonth: 1 },
];

async function main() {
  await connectDB(process.env.MONGO_URI);

  const existing = await User.findOne({ email: EMAIL });
  if (existing) {
    const userId = existing._id;
    await Promise.all([Transaction, Category, Budget, Goal, Recurring].map((M) => M.deleteMany({ userId })));
    await User.deleteOne({ _id: userId });
  }

  const user = await User.create({
    name: "Demo User",
    email: EMAIL,
    password: await bcrypt.hash(PASSWORD, 12),
    currency: "INR",
    monthlyBudget: 35000,
  });
  const userId = user._id;
  await seedDefaults(userId);

  const today = todayUTC();
  const firstMonth = addMonths(startOfMonth(today), -5);
  const txs = [];

  for (let m = 0; m < 6; m++) {
    const month = addMonths(firstMonth, m);
    const lastDay = m === 5 ? today.getUTCDate() : 28;
    const day = (d) => addDays(month, Math.min(d, lastDay) - 1);

    txs.push({ type: "income", category: "Salary", amount: 62000, note: "Monthly salary", date: day(1) });
    txs.push({ type: "expense", category: "Rent", amount: 15000, note: "Apartment rent", date: day(3) });
    txs.push({ type: "expense", category: "Subscriptions", amount: 649, note: "Netflix", date: day(5) });
    txs.push({ type: "expense", category: "Bills & Utilities", amount: between(1200, 2600), note: "Electricity bill", date: day(9) });
    txs.push({ type: "expense", category: "Bills & Utilities", amount: 799, note: "Internet", date: day(12) });
    if (rand() > 0.4) txs.push({ type: "income", category: "Freelance", amount: between(4000, 15000), note: pick(["Logo design", "Website fix", "Tutoring"]), date: day(Math.ceil(rand() * 26)) });

    for (const e of EXPENSES) {
      const n = Math.max(0, Math.round(e.perMonth * (m === 5 ? lastDay / 30 : 1) * (0.7 + rand() * 0.6)));
      for (let i = 0; i < n; i++) {
        txs.push({ type: "expense", category: e.category, amount: between(e.min, e.max), note: pick(e.notes), date: day(1 + Math.floor(rand() * lastDay)) });
      }
    }
  }
  await Transaction.insertMany(txs.filter((t) => t.date <= today).map((t) => ({ ...t, userId })));

  await Budget.insertMany([
    { userId, category: "Food & Dining", amount: 6000 },
    { userId, category: "Groceries", amount: 7000 },
    { userId, category: "Transport", amount: 4000 },
    { userId, category: "Shopping", amount: 3000 },
    { userId, category: "Entertainment", amount: 2000 },
  ]);

  await Goal.insertMany([
    { userId, name: "Emergency fund", targetAmount: 150000, savedAmount: 64000, deadline: addMonths(today, 10), color: "#10b981" },
    { userId, name: "New laptop", targetAmount: 80000, savedAmount: 52000, deadline: addMonths(today, 4), color: "#6366f1" },
    { userId, name: "Goa trip", targetAmount: 25000, savedAmount: 25000, color: "#f59e0b" },
  ]);

  const nextMonth = addMonths(startOfMonth(today), 1);
  await Recurring.insertMany([
    { userId, type: "income", category: "Salary", amount: 62000, note: "Monthly salary", frequency: "monthly", nextDate: nextMonth },
    { userId, type: "expense", category: "Rent", amount: 15000, note: "Apartment rent", frequency: "monthly", nextDate: addDays(nextMonth, 2) },
    { userId, type: "expense", category: "Subscriptions", amount: 649, note: "Netflix", frequency: "monthly", nextDate: addDays(nextMonth, 4) },
    { userId, type: "expense", category: "Bills & Utilities", amount: 799, note: "Internet", frequency: "monthly", nextDate: addDays(nextMonth, 11) },
    { userId, type: "expense", category: "Subscriptions", amount: 1499, note: "Amazon Prime", frequency: "yearly", nextDate: addMonths(today, 7) },
  ]);

  console.log(`Demo account ready: ${EMAIL} / ${PASSWORD} (${txs.length} transactions)`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
