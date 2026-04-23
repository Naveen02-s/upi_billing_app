import React, { useState, useEffect } from "react";

function App() {
  const [amount, setAmount] = useState("");
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);

  // FETCH TRANSACTIONS
  const fetchTransactions = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/transactions");
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // CREATE PAYMENT
  const createPayment = async () => {
    try {
      setLoading(true);
      setError("");
      setStatus("pending");
      setQr("");

      const res = await fetch("http://localhost:5000/api/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          note: "Payment",
          upiId: "test@upi",
        }),
      });

      const data = await res.json();

      if (!data.qrCode) {
        setError(data.error || "Payment failed");
        return;
      }

      setQr(data.qrCode);
      startPolling(data.transaction._id);
    } catch (err) {
      setError("Payment failed");
    } finally {
      setLoading(false);
    }
  };

  // POLLING STATUS
  const startPolling = (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/transaction/${id}`
        );
        const data = await res.json();

        if (data.status === "success") {
          setStatus("success");
          fetchTransactions();
          clearInterval(interval);
        } else {
          setStatus("pending");
        }
      } catch (err) {
        console.log(err);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827] text-white p-6">

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 text-transparent bg-clip-text">
            💳 Smart UPI Billing
          </h1>
          <p className="text-gray-300 mt-2">
            Instant QR payments + live tracking
          </p>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* PAYMENT CARD */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-xl rounded-2xl p-6 shadow-lg shadow-black/40">

            <h2 className="text-xl font-semibold mb-4">
              Create Payment
            </h2>

            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none mb-4"
            />

            <button
              onClick={createPayment}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black transition-all p-3 rounded-lg font-semibold shadow-lg shadow-emerald-500/10"
            >
              Generate QR
            </button>

            {loading && (
              <p className="text-yellow-300 mt-3 text-center animate-pulse">
                Generating QR...
              </p>
            )}

            {error && (
              <p className="text-red-400 mt-2 text-center">
                {error}
              </p>
            )}

            {/* QR */}
            {qr && (
              <div className="mt-6 flex justify-center">
                <div className="bg-white p-3 rounded-xl shadow-lg animate-fade-in">
                  <img src={qr} className="w-44 h-44" />
                </div>
              </div>
            )}

            {/* STATUS */}
            <div className="text-center mt-5">
              <span
                className={`px-4 py-2 rounded-full text-sm border ${
                  status === "success"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                }`}
              >
                {status || "idle"}
              </span>
            </div>

          </div>

          {/* TRANSACTIONS */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-xl rounded-2xl p-6 shadow-lg shadow-black/40">

            <h2 className="text-xl font-semibold mb-4">
              📊 Transaction History
            </h2>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">

              {transactions.map((t) => (
                <div
                  key={t._id}
                  className="flex justify-between items-center bg-black/30 border border-white/10 p-3 rounded-lg hover:bg-black/40 transition"
                >
                  <div>
                    <p className="font-semibold">₹{t.amount}</p>
                    <p className="text-sm text-gray-300">{t.note}</p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs border ${
                      t.status === "success"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default App;