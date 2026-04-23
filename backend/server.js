require("dotenv").config({ path: "./.env" });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Transaction = require("./models/Transaction");

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

// Routes
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

app.use("/api/auth", authRoutes);
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
