const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const Razorpay = require("razorpay");

const Transaction = require("../models/Transaction");

const router = express.Router();

const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;
let razorpay;

const getRazorpay = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }

  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }

  return razorpay;
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
};

const parseAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const toPaise = (amount) => Math.round(amount * 100);

const createReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `PLINK-${timestamp}-${random}`.slice(0, 40);
};

router.post("/create-payment", authMiddleware, async (req, res) => {
  try {
    const amount = parseAmount(req.body.amount);
    const merchantName = String(req.body.merchantName || "Merchant").trim() || "Merchant";
    const upiId = String(req.body.upiId || "").trim();
    const customerName = String(req.body.customerName || "").trim();

    if (!amount) {
      return res.status(400).json({ error: "Enter an amount greater than zero" });
    }

    if (!UPI_ID_PATTERN.test(upiId)) {
      return res.status(400).json({ error: "Enter a valid UPI ID" });
    }

    const razorpay = getRazorpay();
    const referenceId = createReference();
    const description = `UPI Billing payment for ${merchantName}`;
    const paymentLink = await razorpay.paymentLink.create({
      amount: toPaise(amount),
      currency: "INR",
      description,
      reference_id: referenceId,
      customer: customerName ? { name: customerName } : undefined,
      notes: {
        merchantName,
        upiId,
        customerName,
        referenceId,
        userId: req.user.id,
      },
    });
    const paymentLinkUrl = paymentLink.short_url;
    const qrCode = await QRCode.toDataURL(paymentLinkUrl, {
      width: 360,
      margin: 1,
      color: {
        dark: "#10223a",
        light: "#ffffff",
      },
    });

    const transaction = await Transaction.create({
      amount,
      merchantName,
      upiId,
      customerName,
      status: "pending",
      razorpayPaymentLinkId: paymentLink.id,
      paymentLinkUrl,
      paymentUri: paymentLinkUrl,
      transactionReference: referenceId,
      providerEvent: "payment_link.created",
      user: req.user.id,
    });

    return res.status(201).json({
      transaction,
      qrCode,
      paymentLinkUrl,
      razorpayPaymentLinkId: paymentLink.id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Could not create Razorpay payment link" });
  }
});

module.exports = router;
