const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const Goal = require("../models/Goal");
const Recurring = require("../models/Recurring");
const stats = require("../services/stats");
const { categoryLookup } = require("../services/categories");
const { todayUTC, startOfMonth, addMonths, addDays, daysInMonth } = require("../utils/dates");
const { monthLabel, percent } = require("../utils/format");

exports.show = async (req, res) => {
  const userId = req.user._id;
  const today = todayUTC();
  const month = startOfMonth(today);
  const nextMonth = addMonths(month, 1);
  const prevMonth = addMonths(month, -1);
  const dayOfMonth = today.getUTCDate();
  const monthDays = daysInMonth(month);

  const [allTime, thisMonth, lastMonthToDate, series, expenseByCat, recent, budgets, goals, upcoming] =
    await Promise.all([
      stats.totals(userId),
      stats.totals(userId, month, nextMonth),
      // Same number of days into last month, for a fair comparison.
      stats.totals(userId, prevMonth, addDays(prevMonth, Math.min(dayOfMonth, daysInMonth(prevMonth)))),
      stats.monthlySeries(userId, addMonths(month, -5), nextMonth),
      stats.byCategory(userId, month, nextMonth, "expense"),
      Transaction.find({ userId }).sort({ date: -1, createdAt: -1 }).limit(8).lean(),
      Budget.find({ userId }).lean(),
      Goal.find({ userId }).sort({ createdAt: -1 }).limit(3),
      Recurring.find({ userId, active: true }).sort({ nextDate: 1 }).limit(5).lean(),
    ]);

  const lookup = categoryLookup(res.locals.categories);
  const spentBy = new Map(expenseByCat.map((c) => [c.category, c.total]));

  const budgetRows = budgets
    .map((b) => {
      const spent = spentBy.get(b.category) || 0;
      return { ...b, spent, pct: percent(spent, b.amount), meta: lookup("expense", b.category) };
    })
    .sort((a, b) => b.pct - a.pct);

  // Short, plain-language observations about this month.
  const insights = [];
  if (expenseByCat.length && thisMonth.expense > 0) {
    const top = expenseByCat[0];
    insights.push({
      icon: "chart-pie",
      tone: "info",
      text: `${top.category} is your biggest expense this month — ${percent(top.total, thisMonth.expense)}% of spending.`,
    });
  }
  if (lastMonthToDate.expense > 0 && thisMonth.expense > 0) {
    const change = percent(thisMonth.expense - lastMonthToDate.expense, lastMonthToDate.expense);
    if (Math.abs(change) >= 5) {
      insights.push({
        icon: change > 0 ? "trending-up" : "trending-down",
        tone: change > 0 ? "warning" : "success",
        text: `You've spent ${Math.abs(change)}% ${change > 0 ? "more" : "less"} than at this point last month.`,
      });
    }
  }
  const over = budgetRows.filter((b) => b.spent > b.amount);
  if (over.length) {
    insights.push({
      icon: "triangle-alert",
      tone: "danger",
      text: `You're over budget in ${over.map((b) => b.category).join(", ")}.`,
    });
  }
  const monthlyBudget = req.user.monthlyBudget || 0;
  if (monthlyBudget > 0 && thisMonth.expense > 0) {
    const projected = (thisMonth.expense / dayOfMonth) * monthDays;
    if (projected > monthlyBudget) {
      insights.push({
        icon: "gauge",
        tone: "warning",
        text: `At this pace you'll spend ${res.locals.fmt(projected)} this month — above your ${res.locals.fmt(monthlyBudget)} budget.`,
      });
    }
  }

  res.render("dashboard", {
    title: "Dashboard",
    monthName: monthLabel(month),
    allTime,
    thisMonth,
    savingsRate: thisMonth.income > 0 ? Math.round((thisMonth.net / thisMonth.income) * 100) : null,
    monthlyBudget,
    monthProgress: percent(dayOfMonth, monthDays),
    recent: recent.map((t) => ({ ...t, meta: lookup(t.type, t.category) })),
    budgetRows: budgetRows.slice(0, 4),
    goals,
    upcoming: upcoming.map((r) => ({ ...r, meta: lookup(r.type, r.category) })),
    insights,
    chart: {
      cashflow: {
        labels: series.map((s) => monthLabel(s.month, "short")),
        income: series.map((s) => s.income),
        expense: series.map((s) => s.expense),
      },
      categories: expenseByCat.slice(0, 8).map((c) => ({
        label: c.category,
        value: c.total,
        color: lookup("expense", c.category).color,
      })),
    },
  });
};
