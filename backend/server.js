require("dotenv").config({ path: "./.env" });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Transaction = require("./models/Transaction");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const app = express();

// Middleware
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// 🔐 AUTH MIDDLEWARE
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Routes
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

app.use("/api/auth", authRoutes);
app.use(express.json());
app.use("/api", transactionRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// ✅ Connect DB FIRST, then start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected ✅");

    app.listen(5000, () => {
      console.log("Server running on port 5000 🚀");
    });
  })
  .catch((err) => {
    console.log("MongoDB Error ❌:", err.message);
  });

app.post("/api/simulate/:id", async (req, res) => {
  try {
    const { status } = req.body; // "success" or "failed"
    const id = req.params.id;

    if (!status) {
      return res.status(400).json({ error: "Status required" });
    }

    const txn = await Transaction.findById(id);

    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    txn.status = status; // 🔥 dynamic update
    await txn.save();

    res.json({ message: `Payment marked as ${status}`, txn });
  } catch (err) {
    console.error("SIMULATE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔐 LOGIN ROUTE
app.post("/api/login", async (req, res) => {
  console.log("BODY:", req.body);
  try {
    console.log("LOGIN API HIT");

    const { email, password } = req.body;

    // 🔍 find user
    const user = await User.findOne({ email });
    console.log("User:", user);

    if (!user) {
      return res.status(400).json({ error: "Email not found" });
    }

    // 🔐 compare password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match:", isMatch);

    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect password" });
    }

    // 🎟️ token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET
    );

    res.json({ token });

  } catch (err) {
    console.log("FULL ERROR:", err); // 🔥 THIS WILL SHOW REAL PROBLEM
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/create-payment", authMiddleware, async (req, res) => {
  const { amount } = req.body;

  const txn = await Transaction.create({
    amount,
    status: "pending",
    user: req.user.id, // 🔥 attach user
  });

  res.json({
    transaction: txn,
    qrCode: "https://api.qrserver.com/v1/create-qr-code/?data=demo",
  });
});

app.get("/api/transactions", authMiddleware, async (req, res) => {
  const txns = await Transaction.find({ user: req.user.id });
  res.json(txns);
});

app.post("/api/simulate/:id", authMiddleware, async (req, res) => {
  const { status } = req.body;

  const txn = await Transaction.findById(req.params.id);

  txn.status = status;
  await txn.save();

  res.json(txn);
});

app.listen(5000, () => console.log("Server running on 5000"));
