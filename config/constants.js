// Categories every new account starts with. Users can add their own in Settings.
// `icon` values are Lucide icon names (https://lucide.dev/icons).
const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", type: "expense", icon: "utensils", color: "#f97316" },
  { name: "Groceries", type: "expense", icon: "shopping-cart", color: "#84cc16" },
  { name: "Transport", type: "expense", icon: "car", color: "#0ea5e9" },
  { name: "Shopping", type: "expense", icon: "shopping-bag", color: "#ec4899" },
  { name: "Bills & Utilities", type: "expense", icon: "receipt", color: "#eab308" },
  { name: "Rent", type: "expense", icon: "house", color: "#8b5cf6" },
  { name: "Entertainment", type: "expense", icon: "film", color: "#f43f5e" },
  { name: "Health", type: "expense", icon: "heart-pulse", color: "#ef4444" },
  { name: "Education", type: "expense", icon: "graduation-cap", color: "#6366f1" },
  { name: "Travel", type: "expense", icon: "plane", color: "#14b8a6" },
  { name: "Subscriptions", type: "expense", icon: "repeat", color: "#a855f7" },
  { name: "Personal Care", type: "expense", icon: "sparkles", color: "#d946ef" },
  { name: "Gifts & Donations", type: "expense", icon: "gift", color: "#f59e0b" },
  { name: "Other", type: "expense", icon: "circle-ellipsis", color: "#64748b" },
  { name: "Salary", type: "income", icon: "briefcase", color: "#10b981" },
  { name: "Freelance", type: "income", icon: "laptop", color: "#06b6d4" },
  { name: "Business", type: "income", icon: "store", color: "#3b82f6" },
  { name: "Investments", type: "income", icon: "trending-up", color: "#22c55e" },
  { name: "Gifts Received", type: "income", icon: "gift", color: "#f59e0b" },
  { name: "Refunds", type: "income", icon: "rotate-ccw", color: "#0891b2" },
  { name: "Other Income", type: "income", icon: "circle-plus", color: "#64748b" },
];

// Icons offered when creating a custom category.
const CATEGORY_ICONS = [
  "tag", "utensils", "coffee", "shopping-cart", "shopping-bag", "car", "bus", "fuel",
  "house", "receipt", "wifi", "phone", "film", "heart-pulse", "dumbbell", "graduation-cap",
  "plane", "repeat", "sparkles", "gift", "baby", "paw-print", "briefcase", "laptop",
  "store", "trending-up", "coins", "landmark", "wallet", "piggy-bank", "wrench", "circle-ellipsis",
];

const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)", locale: "en-IN" },
  { code: "USD", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", locale: "de-DE" },
  { code: "GBP", label: "British Pound (£)", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham (د.إ)", locale: "en-AE" },
  { code: "SAR", label: "Saudi Riyal (﷼)", locale: "en-SA" },
  { code: "CAD", label: "Canadian Dollar ($)", locale: "en-CA" },
  { code: "AUD", label: "Australian Dollar ($)", locale: "en-AU" },
  { code: "SGD", label: "Singapore Dollar ($)", locale: "en-SG" },
  { code: "JPY", label: "Japanese Yen (¥)", locale: "ja-JP" },
  { code: "CNY", label: "Chinese Yuan (¥)", locale: "zh-CN" },
  { code: "PKR", label: "Pakistani Rupee (₨)", locale: "en-PK" },
  { code: "BDT", label: "Bangladeshi Taka (৳)", locale: "en-BD" },
];

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];

const GOAL_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#ef4444", "#14b8a6"];

module.exports = { DEFAULT_CATEGORIES, CATEGORY_ICONS, CURRENCIES, FREQUENCIES, GOAL_COLORS };
