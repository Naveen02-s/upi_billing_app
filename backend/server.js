require("dotenv").config({ path: "./.env" });

const bcrypt = require("bcryptjs");
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const QRCode = require("qrcode");

const Transaction = require("./models/Transaction");
const User = require("./models/User");
const paymentRoutes = require("./routes/payment");
const webhookRoutes = require("./routes/webhook");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URLS = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);
const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;

app.use("/api/webhook", express.raw({ type: "application/json" }), webhookRoutes);
app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || FRONTEND_URLS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS blocked"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use("/api", paymentRoutes);

const roundAmount = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const createReference = (prefix) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `${prefix}-${timestamp}-${random}`;
};

const normalizeStatus = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (["paid", "success", "captured", "done", "completed"].includes(normalizedValue)) {
    return "paid";
  }

  if (["failed", "failure", "error", "rejected"].includes(normalizedValue)) {
    return "failed";
  }

  if (["expired", "timeout"].includes(normalizedValue)) {
    return "expired";
  }

  return "pending";
};

const buildPaymentNote = ({ invoiceNumber, note, customerName }) => {
  const parts = [invoiceNumber];

  if (note) {
    parts.push(note);
  } else if (customerName) {
    parts.push(customerName);
  }

  return parts.join(" | ").slice(0, 80);
};

const buildUpiUrl = ({ upiId, merchantName, amount, note, reference }) => {
  const params = new URLSearchParams({
    pa: upiId,
    pn: merchantName || "Merchant",
    am: amount.toFixed(2),
    cu: "INR",
    tr: reference,
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
};

const parseAmount = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return roundAmount(numericValue);
};

const parseItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const name = String(item?.name || "").trim();
      const quantity = Number(item?.quantity);
      const price = Number(item?.price);

      if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
        return null;
      }

      return {
        name,
        quantity,
        price: roundAmount(price),
        total: roundAmount(quantity * price),
      };
    })
    .filter(Boolean);
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

app.get("/", (_req, res) => {
  res.send("API is running");
});

app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: name || "User",
      email,
      password: hashedPassword,
    });

    return res.json({ message: "Account created successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "Email not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/create-payment", authMiddleware, async (req, res) => {
  try {
    const merchantName = String(req.body.merchantName || "Merchant").trim() || "Merchant";
    const customerName = String(req.body.customerName || "").trim();
    const note = String(req.body.note || "").trim();
    const upiId = String(req.body.upiId || "").trim();
    const items = parseItems(req.body.items);
    const requestedAmount = parseAmount(req.body.amount);

    if (!UPI_ID_PATTERN.test(upiId)) {
      return res.status(400).json({ error: "Enter a valid UPI ID" });
    }

    const amount = items.length
      ? roundAmount(items.reduce((sum, item) => sum + item.total, 0))
      : requestedAmount;

    if (!amount) {
      return res.status(400).json({ error: "Enter an amount greater than zero" });
    }

    const invoiceNumber = createReference("INV");
    const transactionReference = createReference("UPI");
    const paymentNote = buildPaymentNote({ invoiceNumber, note, customerName });
    const upiUrl = buildUpiUrl({
      upiId,
      merchantName,
      amount,
      note: paymentNote,
      reference: transactionReference,
    });
    const qrCode = await QRCode.toDataURL(upiUrl, {
      width: 360,
      margin: 1,
      color: {
        dark: "#10223a",
        light: "#ffffff",
      },
    });

    const transaction = await Transaction.create({
      amount,
      note: paymentNote,
      upiId,
      merchantName,
      customerName,
      invoiceNumber,
      transactionReference,
      paymentUri: upiUrl,
      items,
      status: "pending",
      user: req.user.id,
    });

    return res.json({
      transaction,
      qrCode,
      upiUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.get("/api/transactions", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    return res.json(transactions);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.get("/api/transaction/:id", authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.json(transaction);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.get("/api/transaction/:id/qr", authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (!transaction.paymentUri) {
      return res.status(400).json({ error: "QR is not available for this transaction" });
    }

    const qrCode = await QRCode.toDataURL(transaction.paymentUri, {
      width: 360,
      margin: 1,
      color: {
        dark: "#10223a",
        light: "#ffffff",
      },
    });

    return res.json({
      qrCode,
      upiUrl: transaction.paymentUri,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/payment-webhook", async (req, res) => {
  try {
    if (process.env.WEBHOOK_SECRET) {
      const suppliedSecret = req.headers["x-webhook-secret"];

      if (suppliedSecret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }
    }

    const providerEvent = String(req.body.providerEvent || req.body.event || "").trim();
    const paymentEntity = req.body.payload?.payment?.entity || req.body.payload?.order?.entity || {};
    const notes = paymentEntity.notes || req.body.notes || {};
    const transactionId = req.body.transactionId || notes.transactionId;
    const transactionReference =
      req.body.transactionReference ||
      req.body.reference ||
      notes.transactionReference ||
      paymentEntity.reference;
    const providerPaymentId =
      req.body.providerPaymentId || req.body.paymentId || paymentEntity.id || "";
    const status = normalizeStatus(req.body.status || paymentEntity.status || providerEvent);

    if (!transactionId && !transactionReference) {
      return res.status(400).json({
        error: "transactionId or transactionReference is required",
      });
    }

    const query = transactionId
      ? { _id: transactionId }
      : { transactionReference };

    const updates = {
      status,
      providerEvent: providerEvent || undefined,
      providerPaymentId: providerPaymentId || undefined,
    };

    if (status === "paid") {
      updates.paidAt = new Date();
    }

    const transaction = await Transaction.findOneAndUpdate(query, updates, {
      new: true,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.json({
      received: true,
      transaction,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/simulate/:id", authMiddleware, async (req, res) => {
  try {
    const status = normalizeStatus(req.body.status);
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    transaction.status = status;

    if (status === "paid") {
      transaction.paidAt = new Date();
      transaction.providerEvent = "manual.simulation";
    }

    await transaction.save();

    return res.json({
      message: `Payment marked as ${status}`,
      transaction,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
  });
