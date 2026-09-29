const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  type: { type: String, enum: ["income", "expense"], required: true },
  icon: { type: String, default: "tag" },
  color: { type: String, default: "#64748b" },
});

categorySchema.index({ userId: 1, type: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
