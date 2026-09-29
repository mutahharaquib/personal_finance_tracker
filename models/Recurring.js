const mongoose = require("mongoose");
const { FREQUENCIES } = require("../config/constants");

// A rule that posts a transaction automatically (salary, rent, subscriptions…).
const recurringSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    note: { type: String, trim: true, maxlength: 200, default: "" },
    frequency: { type: String, enum: FREQUENCIES, required: true },
    // Day the next transaction will be posted (UTC midnight).
    nextDate: { type: Date, required: true },
    endDate: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Recurring", recurringSchema);
