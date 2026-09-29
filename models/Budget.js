const mongoose = require("mongoose");

// A monthly spending limit for one expense category. Applies to every month.
const budgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("Budget", budgetSchema);
