const Category = require("../models/Category");
const { DEFAULT_CATEGORIES } = require("../config/constants");

async function seedDefaults(userId) {
  await Category.insertMany(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
    { ordered: false }
  ).catch((err) => {
    // Duplicate keys just mean the defaults (or some of them) already exist.
    if (err.code !== 11000 && !err.writeErrors) throw err;
  });
}

// Returns the user's categories, seeding the defaults for accounts that have none
// (e.g. users created before categories existed).
async function getCategories(userId) {
  let categories = await Category.find({ userId }).sort({ type: 1, name: 1 }).lean();
  if (categories.length === 0) {
    await seedDefaults(userId);
    categories = await Category.find({ userId }).sort({ type: 1, name: 1 }).lean();
  }
  return categories;
}

// Lookup of "type:name" -> category, with a neutral fallback for names that were
// imported or deleted.
function categoryLookup(categories) {
  const map = new Map(categories.map((c) => [`${c.type}:${c.name}`, c]));
  return (type, name) => map.get(`${type}:${name}`) || { name, type, icon: "tag", color: "#64748b" };
}

module.exports = { seedDefaults, getCategories, categoryLookup };
