const Recurring = require("../models/Recurring");
const Transaction = require("../models/Transaction");
const { todayUTC, advance } = require("../utils/dates");

// Safety cap so a years-old daily rule can't generate an unbounded batch at once.
const MAX_POSTINGS_PER_RULE = 400;

// Posts every transaction that has come due for the user's active recurring rules.
// Each step advances `nextDate` with a compare-and-set so concurrent requests
// can never post the same occurrence twice.
async function processDueRecurring(userId) {
  const today = todayUTC();
  const rules = await Recurring.find({ userId, active: true, nextDate: { $lte: today } });
  let posted = 0;

  for (const rule of rules) {
    let due = rule.nextDate;
    for (let i = 0; i < MAX_POSTINGS_PER_RULE && due <= today; i++) {
      if (rule.endDate && due > rule.endDate) {
        await Recurring.updateOne({ _id: rule._id }, { active: false });
        break;
      }
      const next = advance(due, rule.frequency);
      const claimed = await Recurring.updateOne({ _id: rule._id, nextDate: due }, { nextDate: next });
      if (claimed.modifiedCount === 0) break; // another request got here first

      await Transaction.create({
        userId,
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        note: rule.note,
        date: due,
        recurringId: rule._id,
      });
      posted++;
      due = next;
    }
  }
  return posted;
}

module.exports = { processDueRecurring };
