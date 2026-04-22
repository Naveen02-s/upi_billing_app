const Transaction = require("../models/Transaction");

app.post("/create-payment", async (req, res) => {
  try {
    const { amount, note, upiId } = req.body;

    const txn = await Transaction.create({
      amount,
      note,
      upiId,
    });

    res.json({
      message: "Transaction created",
      data: txn,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});