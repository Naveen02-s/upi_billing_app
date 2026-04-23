import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";


function App() {
  const [amount, setAmount] = useState("");
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);

  const fetchTransactions = async () => {
    const res = await fetch("http://localhost:5000/api/transactions");
    const data = await res.json();
    setTransactions(data);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const createPayment = async () => {
    setLoading(true);
    setStatus("pending");
    setQr("");

    const res = await fetch("http://localhost:5000/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        note: "Payment",
        upiId: "test@upi",
      }),
    });

    const data = await res.json();
    setQr(data.qrCode);
    pollStatus(data.transaction._id);
    setLoading(false);
  };

  const pollStatus = (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/transaction/${id}`);
        const data = await res.json();

        if (data.status === "success") {
          setStatus("success");
          fetchTransactions();
          clearInterval(interval);

          // Auto close QR after success
          setTimeout(() => {
            setQr("");
            setStatus("");
            setAmount("");
          }, 2000);
        } else if (data.status === "failed") {
          setStatus("failed");
          clearInterval(interval);

          setTimeout(() => {
            setQr("");
            setStatus("");
          }, 2000);
        } else {
          setStatus("pending");
        }
      } catch (err) {
        console.log(err);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 text-transparent bg-clip-text">
            💳 Smart UPI Billing
          </h1>
          <p className="text-gray-400 mt-2">
            Instant QR payments + live tracking
          </p>
        </motion.div>

        {/* GRID */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* PAYMENT CARD */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl"
          >
            <h2 className="text-xl font-semibold mb-4">Create Payment</h2>

            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/40 border border-white/20 text-white placeholder-gray-400 focus:border-emerald-400 outline-none mb-4"
            />

            <button
              onClick={createPayment}
              disabled={status === "pending"}
              className="w-full bg-emerald-500 disabled:opacity-50 hover:bg-emerald-400 text-black font-semibold p-3 rounded-lg"
            >
              Generate QR
            </button>

            {loading && (
              <p className="text-yellow-400 mt-3 text-center animate-pulse">
                Generating QR...
              </p>
            )}

            <AnimatePresence>
              {qr && (
                <motion.div
                  key="qr"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="mt-6 flex justify-center"
                >
                  <div className="bg-white p-3 rounded-xl">
                    <img src={qr} className="w-40" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              key={status}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center mt-5"
            >
              {status === "pending" && (
                <div className="flex items-center justify-center gap-2 text-yellow-400">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                  <span>Waiting for payment...</span>
                </div>
              )}

              {status === "success" && (
                <div className="text-green-400 font-semibold text-lg">
                  ✅ Payment Successful
                </div>
              )}

              {status === "failed" && (
                <div className="text-red-400 font-semibold text-lg">
                  ❌ Payment Failed
                </div>
              )}

              {!status && <div className="text-gray-400">Idle</div>}
            </motion.div>
          </motion.div>

          {/* TRANSACTIONS */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl"
          >
            <h2 className="text-xl font-semibold mb-4">📊 Transactions</h2>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {transactions.map((t) => (
                <motion.div
                  key={t._id}
                  whileHover={{ scale: 1.02 }}
                  className="flex justify-between items-center bg-black/40 p-3 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">₹{t.amount}</p>
                    <p className="text-sm text-gray-400">{t.note}</p>
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full ${
                      t.status === "success"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {t.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default App;
