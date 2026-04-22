const Transaction = require("../models/Transaction");
const QRCode = require("qrcode");

exports.createPayment = async (req, res) => {
  try {
    const { amount, note, upiId } = req.body;

    const txn = await Transaction.create({ amount, note, upiId });

    // 🔗 Create UPI payment link
    const upiUrl = `upi://pay?pa=${upiId}&pn=Merchant&am=${amount}&cu=INR&tn=${note}`;

    // 📱 Generate QR code
    const qrCode = await QRCode.toDataURL(upiUrl);

    res.json({
      message: "QR generated",
      transaction: txn,
      qrCode: qrCode,
      upiUrl: upiUrl
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const txn = await Transaction.findById(id);

    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(txn);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const txn = await Transaction.findByIdAndUpdate(
      id,
      { status: "success" },
      { new: true }
    );

    res.json(txn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};