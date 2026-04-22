const express = require("express");
const router = express.Router();

const { createPayment } = require("../controllers/transactionController");

router.post("/create-payment", createPayment);

module.exports = router;