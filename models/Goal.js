const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    targetAmount: { type: Number, required: true, min: 0.01 },
    savedAmount: { type: Number, default: 0, min: 0 },
    deadline: Date,
    color: { type: String, default: "#6366f1" },
  },
  { timestamps: true }
);

goalSchema.virtual("progress").get(function () {
  return Math.min(100, (this.savedAmount / this.targetAmount) * 100);
});

goalSchema.virtual("completed").get(function () {
  return this.savedAmount >= this.targetAmount;
});

module.exports = mongoose.model("Goal", goalSchema);
