import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const normalizeStatus = (value) => {
  const v = String(value || "").toLowerCase();
  if (["paid", "success", "captured", "done", "completed"].includes(v)) return "paid";
  if (["failed", "failure", "error", "rejected"].includes(v)) return "failed";
  if (["expired", "timeout"].includes(v)) return "expired";
  return "pending";
};

const statusStyles = {
  idle: "bg-slate-100 text-slate-700 border-slate-200",
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  paid: "bg-emerald-100 text-emerald-900 border-emerald-200",
  failed: "bg-rose-100 text-rose-900 border-rose-200",
  expired: "bg-slate-200 text-slate-700 border-slate-300",
};

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [merchantName, setMerchantName] = useState(localStorage.getItem("merchantName") || "");
  const [upiId, setUpiId] = useState(localStorage.getItem("merchantUpiId") || "");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [qr, setQr] = useState("");
  const [upiUrl, setUpiUrl] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState("");

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setTransactions([]);
    setCurrentTransaction(null);
    setQr("");
    setUpiUrl("");
    setPaymentError("");
  };

  useEffect(() => localStorage.setItem("merchantName", merchantName), [merchantName]);
  useEffect(() => localStorage.setItem("merchantUpiId", upiId), [upiId]);

  const fetchTransactions = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/transactions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401 || res.status === 403) return logout();
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    if (token) fetchTransactions(token);
  }, [token]);

  const validateAuth = () => {
    const e = {};
    if (!email) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    if (!password) e.password = "Required";
    else if (password.length < 4) e.password = "Min 4 chars";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const signup = async () => {
    if (!validateAuth()) return;
    try {
      setLoadingAuth(true);
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: "User" }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthError("Account created");
        setIsSignup(false);
      } else setAuthError(data.error);
    } catch {
      setAuthError("Error");
    } finally {
      setLoadingAuth(false);
    }
  };

  const login = async () => {
    if (!validateAuth()) return;
    try {
      setLoadingAuth(true);
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
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
        body: JSON.stringify({ merchantName, customerName, note, upiId, amount }),
      });
      const data = await res.json();
      setQr(data.qrCode);
      setUpiUrl(data.upiUrl);
      setCurrentTransaction(data.transaction);
      fetchTransactions(token);
    } catch {
      setPaymentError("Error");
    } finally {
      setLoading(false);
    }
  };

  const copyPaymentLink = async () => {
    if (!upiUrl) return;
    try {
      await navigator.clipboard.writeText(upiUrl);
      setCopyState("Copied");
    } catch {
      setCopyState("Failed");
    }
  };

  const currentStatus = currentTransaction
    ? normalizeStatus(currentTransaction.status)
    : "idle";

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="w-full max-w-md p-6 bg-white/5 rounded-lg">
          <h2 className="text-xl mb-4">{isSignup ? "Sign Up" : "Login"}</h2>

          <input
            className="w-full mb-3 p-2 rounded bg-black/20"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full mb-3 p-2 rounded bg-black/20"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {authError && <p className="text-red-400">{authError}</p>}

          <button onClick={isSignup ? signup : login} className="w-full bg-cyan-400 p-2 rounded mt-2">
            {loadingAuth ? "..." : isSignup ? "Sign Up" : "Login"}
          </button>

          <button onClick={() => setIsSignup(!isSignup)} className="mt-3 text-sm">
            {isSignup ? "Login instead" : "Create account"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button onClick={logout}>Logout</button>

      <div className="mt-4">
        <input placeholder="Merchant" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
        <input placeholder="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
        <input placeholder="Customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />

        <button onClick={createPayment}>
          {loading ? "..." : "Generate QR"}
        </button>
      </div>

      {qr && (
        <div>
          <img src={qr} alt="QR" />
          <button onClick={copyPaymentLink}>Copy Link</button>
        </div>
      )}
    </div>
  );
}

export default App;