import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

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

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout"));
    document.body.appendChild(script);
  });

// ✅ EXTRACTED COMPONENT
const TransactionsList = ({ transactions }) => {
  if (transactions.length === 0) {
    return <p className="text-gray-500 text-sm">No transactions yet</p>;
  }

  return (
    <div className="space-y-3">
      {transactions.map((txn) => {
        const status = normalizeStatus(txn.status);

        return (
          <div
            key={txn._id || txn.id}
            className="flex justify-between items-center border-b pb-2"
          >
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
  );
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [merchantName, setMerchantName] = useState(
    localStorage.getItem("merchantName") || ""
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

  const fetchTransactions = useCallback(async () => {
    if (!token) return;

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
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchTransactions();
    }
  }, [fetchTransactions, token]);

  useEffect(() => {
    if (!token) return undefined;

    const interval = setInterval(fetchTransactions, 5000);
    return () => clearInterval(interval);
  }, [fetchTransactions, token]);

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
      const res = await fetch(`${API_BASE_URL}/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ merchantName, upiId, amount, customerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create order");

      setQr("");
      setUpiUrl("");
      await loadRazorpayScript();

      const razorpay = new window.Razorpay({
        key: data.key,
        amount: data.order.amount,
        currency: data.order.currency,
        name: merchantName,
        description: "UPI Billing Payment",
        order_id: data.order.id,
        prefill: {
          name: customerName,
        },
        notes: {
          merchantName,
          upiId,
          transactionId: data.transaction?._id,
        },
        handler: () => {
          fetchTransactions();
        },
        modal: {
          ondismiss: () => {
            fetchTransactions();
          },
        },
      });

      razorpay.open();
      fetchTransactions();
    } finally {
      setLoading(false);
    }
  };

  const copyPaymentLink = async () => {
    await navigator.clipboard.writeText(upiUrl);
    setCopyState("Copied!");
  };

  // LOGIN UI (unchanged)
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

          <input className="input" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />

          {authError && <p className="text-red-500 text-sm">{authError}</p>}

          <div className="flex justify-center">
            <button onClick={isSignup ? signup : login} className="btn-primary mt-4">
              {loadingAuth ? "Please wait..." : isSignup ? "Sign Up" : "Login"}
            </button>
          </div>

          <p onClick={() => setIsSignup(!isSignup)} className="text-center text-sm mt-4 cursor-pointer text-gray-600">
            {isSignup ? "Already have account?" : "Create new account"}
          </p>
        </motion.div>
      </div>
    );
  }

  // DASHBOARD
  return (
    <div className="min-h-screen p-4 sm:p-6 relative overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f8fafc] to-[#e0f2fe]">
      
      {/* Glow */}
      <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-indigo-400 opacity-20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-400 opacity-20 blur-[120px] rounded-full"></div>

      <div className="max-w-6xl mx-auto">

        {/* Navbar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 bg-white px-6 py-4 rounded-2xl shadow-sm border">
          <div>
            <h1 className="text-xl font-bold">UPI Billing</h1>
            <p className="text-sm text-gray-500">Dashboard</p>
          </div>
          <button className="btn-secondary" onClick={logout}>Logout</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">

            {/* FORM */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Create Payment</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input className="input" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Merchant Name"/>
                <input className="input" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="UPI ID"/>
                <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer Name"/>
                <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount"/>
              </div>

              <div className="flex justify-center mt-4">
                <button onClick={createPayment} className="btn-primary">
                  {loading ? "Generating..." : "Generate QR"}
                </button>
              </div>
            </div>

            {/* QR */}
            <div className="card text-center min-h-[250px] flex items-center justify-center">
              {qr ? <img src={qr} className="w-40 mx-auto" /> : <p className="text-gray-400">QR will appear here</p>}
            </div>

          </div>

          {/* DESKTOP */}
          <div className="hidden lg:block card h-fit">
            <h2 className="text-lg font-semibold mb-4">Transactions</h2>
            <TransactionsList transactions={transactions} />
          </div>

        </div>

        {/* MOBILE */}
        <div className="lg:hidden mt-6 card">
          <h2 className="text-lg font-semibold mb-4">Transactions</h2>
          <TransactionsList transactions={transactions} />
        </div>

      </div>
    </div>
  );
}
