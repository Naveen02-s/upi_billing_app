const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  amount: Number,
  note: String,
  upiId: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
