import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value) || 0);

const normalizeStatus = (value) => {
  const v = String(value || "").toLowerCase();
  if (["paid", "success", "captured", "done"].includes(v)) return "paid";
  if (["failed", "error"].includes(v)) return "failed";
  return "pending";
};

const statusStyles = {
  idle: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [merchantName, setMerchantName] = useState(
    localStorage.getItem("merchantName") || "",
  );

  const [upiId, setUpiId] = useState(localStorage.getItem("upiId") || "");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");

  const [qr, setQr] = useState("");
  const [upiUrl, setUpiUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState("");
  const [transactions, setTransactions] = useState([]);

  const [upiSuggestions, setUpiSuggestions] = useState(
  JSON.parse(localStorage.getItem("upiSuggestions")) || []
);

const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    localStorage.setItem("merchantName", merchantName);
  }, [merchantName]);

  useEffect(() => {
    localStorage.setItem("upiId", upiId);
  }, [upiId]);

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log(err);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
  };

  const login = async () => {
    try {
      setLoadingAuth(true);
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      } else setAuthError(data.error);
    } catch {
      setAuthError("Error");
    } finally {
      setLoadingAuth(false);
    }
  };

  const signup = async () => {
    try {
      setLoadingAuth(true);
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: "User" }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsSignup(false);
      } else setAuthError(data.error);
    } catch {
      setAuthError("Error");
    } finally {
      setLoadingAuth(false);
    }
  };

  const createPayment = async () => {
    if (!merchantName || !upiId || !amount) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ merchantName, upiId, amount }),
      });
      const data = await res.json();
      setQr(data.qrCode);
      setUpiUrl(data.upiUrl);
      fetchTransactions();
    } finally {
      setLoading(false);
    }
  };

  const copyPaymentLink = async () => {
    await navigator.clipboard.writeText(upiUrl);
    setCopyState("Copied!");
  };

  // ================= LOGIN UI =================
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-500">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">
            {isSignup ? "Create Account" : "Welcome Back"}
          </h2>

          <input
            className="input"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          {authError && <p className="text-red-500 text-sm">{authError}</p>}

          <button
            onClick={isSignup ? signup : login}
            className="btn-primary w-full mt-4"
          >
            {loadingAuth ? "Please wait..." : isSignup ? "Sign Up" : "Login"}
          </button>

          <p
            onClick={() => setIsSignup(!isSignup)}
            className="text-center text-sm mt-4 cursor-pointer text-gray-600"
          >
            {isSignup ? "Already have account?" : "Create new account"}
          </p>
        </motion.div>
      </div>
    );
  }

  // ================= DASHBOARD =================
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navbar */}
        <div className="flex justify-between items-center mb-6 bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-xl font-bold">UPI Billing</h1>
            <p className="text-sm text-gray-500">Dashboard</p>
          </div>

          <button className="btn-secondary" onClick={logout}>
            Logout
          </button>
        </div>

        {/* Form Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <hr style={{ margin: "12px 0 20px", borderColor: "#eee" }} />
          {/* LEFT - FORM */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Create Payment</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label>Merchant Name</label>
                  <input
                    className="input"
                    placeholder="Merchant Name"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                  />
                </div>
                <div>
                  <label>UPI ID</label>
                  <input
                    className="input"
                    placeholder="UPI ID"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                </div>

                <div>
                  <label>Customer Name</label>
                  <input
                    className="input"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div>
                  <label>Amount</label>
                  <input
                    className="input"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button onClick={createPayment} className="btn-primary mt-4">
                  {loading ? "Generating..." : "Generate QR"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT - QR PANEL */}
          <div className="card flex flex-col items-center justify-center text-center min-h-[300px]">
            {qr ? (
              <>
                <img src={qr} className="w-44 mb-4" />
                <p className="text-gray-500">Scan & Pay</p>
              </>
            ) : (
              <p className="text-gray-400">QR will appear here</p>
            )}
          </div>
        </div>
        <div className="card mt-6">
          <h2 className="text-lg font-semibold mb-4">Transactions</h2>

          {transactions.length === 0 ? (
            <p className="text-gray-500 text-sm">No transactions yet</p>
          ) : (
            <div>
              {transactions.map((txn) => {
                const status = normalizeStatus(txn.status);

                return (
                  <div key={txn._id} className="txn">
                    <div>
                      <p className="font-medium">
                        ₹{txn.amount} • {txn.customerName || "Customer"}
                      </p>
                      <p className="text-xs text-gray-500">{txn.upiId}</p>
                    </div>

                    <span className={`status ${status}`}>{status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
