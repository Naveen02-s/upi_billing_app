const express = require("express");
const router = express.Router();

const {
  createPayment,
  getTransaction,
  updateStatus,
  getAllTransactions
} = require("../controllers/transactionController");

// routes
router.post("/create-payment", createPayment);
router.get("/transaction/:id", getTransaction);
router.put("/transaction/:id", updateStatus);
router.get("/transactions", getAllTransactions);

// export LAST
module.exports = router;