require("dotenv").config({ path: "./.env" });

const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Transaction = require("./models/Transaction");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

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
    const { amount, note, upiId } = req.body;

    const transaction = await Transaction.create({
      amount,
      note,
      upiId,
      status: "pending",
      user: req.user.id,
    });

    return res.json({
      transaction,
      qrCode: "https://api.qrserver.com/v1/create-qr-code/?data=demo",
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

app.post("/api/simulate/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status required" });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    transaction.status = status;
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
