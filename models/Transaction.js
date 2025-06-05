const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  type: String, // income or expense
  amount: Number,
  category: String,
  date: Date,
  note: String
});
module.exports = mongoose.model('Transaction', transactionSchema);