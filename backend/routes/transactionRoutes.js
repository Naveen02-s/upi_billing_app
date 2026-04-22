const express = require("express");
const router = express.Router();

const { createPayment, getTransaction, updateStatus } = require("../controllers/transactionController");

router.post("/create-payment", createPayment);
router.get("/transaction/:id", getTransaction);

module.exports = router;


router.put("/transaction/:id", updateStatus);