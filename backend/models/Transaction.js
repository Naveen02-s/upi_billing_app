const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  note: {
    type: String,
    trim: true,
  },
  upiId: {
    type: String,
    required: true,
    trim: true,
  },
  merchantName: {
    type: String,
    trim: true,
    default: "Merchant",
  },
  customerName: {
    type: String,
    trim: true,
    default: "",
  },
  invoiceNumber: {
    type: String,
    trim: true,
  },
  transactionReference: {
    type: String,
    trim: true,
  },
  paymentUri: {
    type: String,
    trim: true,
  },
  providerPaymentId: {
    type: String,
    trim: true,
  },
  razorpay_order_id: {
    type: String,
    trim: true,
    index: true,
    unique: true,
    sparse: true,
  },
  razorpay_payment_id: {
    type: String,
    trim: true,
  },
  razorpay_signature: {
    type: String,
    trim: true,
  },
  failureReason: {
    type: String,
    trim: true,
  },
  providerEvent: {
    type: String,
    trim: true,
  },
  paidAt: Date,
  failedAt: Date,
  webhookEventIds: {
    type: [String],
    default: [],
  },
  items: {
    type: [itemSchema],
    default: [],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["pending", "paid", "failed", "expired"],
    default: "pending",
  },
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
