const crypto = require("crypto");
const express = require("express");

const Transaction = require("../models/Transaction");

const router = express.Router();

const verifyWebhookSignature = (rawBody, signature) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Razorpay webhook secret is not configured");
  }

  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getPaymentEntity = (body) => body.payload?.payment?.entity || {};

const applyPaymentUpdate = async ({ event, eventId, payment }) => {
  const orderId = payment.order_id;

  if (!orderId) {
    return { ignored: true, reason: "Payment does not belong to a Razorpay order" };
  }

  if (event === "payment.captured") {
    const transaction = await Transaction.findOneAndUpdate(
      {
        razorpay_order_id: orderId,
        status: { $ne: "paid" },
        ...(eventId ? { webhookEventIds: { $ne: eventId } } : {}),
      },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          providerEvent: event,
          providerPaymentId: payment.id,
          razorpay_payment_id: payment.id,
        },
        ...(eventId ? { $addToSet: { webhookEventIds: eventId } } : {}),
      },
      { new: true },
    );

    if (transaction) {
      return { updated: true, transaction };
    }
  }

  if (event === "payment.failed") {
    const transaction = await Transaction.findOneAndUpdate(
      {
        razorpay_order_id: orderId,
        status: { $nin: ["paid", "failed"] },
        ...(eventId ? { webhookEventIds: { $ne: eventId } } : {}),
      },
      {
        $set: {
          status: "failed",
          failedAt: new Date(),
          providerEvent: event,
          providerPaymentId: payment.id,
          razorpay_payment_id: payment.id,
          failureReason: payment.error_description || payment.error_reason || "Payment failed",
        },
        ...(eventId ? { $addToSet: { webhookEventIds: eventId } } : {}),
      },
      { new: true },
    );

    if (transaction) {
      return { updated: true, transaction };
    }
  }

  const transaction = await Transaction.findOne({ razorpay_order_id: orderId });

  if (!transaction) {
    return { ignored: true, reason: "Transaction not found for Razorpay order" };
  }

  return { duplicate: true, transaction };
};

router.post("/", async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const signature = req.headers["x-razorpay-signature"];

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const body = JSON.parse(rawBody.toString("utf8"));
    const event = body.event;
    const eventId = req.headers["x-razorpay-event-id"];

    if (!["payment.captured", "payment.failed"].includes(event)) {
      return res.json({ received: true, ignored: true });
    }

    const result = await applyPaymentUpdate({
      event,
      eventId,
      payment: getPaymentEntity(body),
    });

    return res.json({
      received: true,
      ...result,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Webhook processing failed" });
  }
});

module.exports = router;
