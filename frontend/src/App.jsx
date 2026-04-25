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
  const normalizedValue = String(value || "").toLowerCase();

  if (["paid", "success", "captured", "done", "completed"].includes(normalizedValue)) {
    return "paid";
  }

  if (["failed", "failure", "error", "rejected"].includes(normalizedValue)) {
    return "failed";
  }

  if (["expired", "timeout"].includes(normalizedValue)) {
    return "expired";
  }

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

  useEffect(() => {
    localStorage.setItem("merchantName", merchantName);
  }, [merchantName]);

  useEffect(() => {
    localStorage.setItem("merchantUpiId", upiId);
  }, [upiId]);

  const fetchTransactions = async (authToken = token) => {
    if (!authToken) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/transactions`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetchTransactions(token);
  }, [token]);

  useEffect(() => {
    if (!token || !currentTransaction?._id) {
      return undefined;
    }

    if (normalizeStatus(currentTransaction.status) !== "pending") {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/transaction/${currentTransaction._id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Unable to fetch status");
        }

        setCurrentTransaction(data);

        if (normalizeStatus(data.status) !== "pending") {
          void fetchTransactions(token);
        }
      } catch (err) {
        console.error(err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [token, currentTransaction?._id, currentTransaction?.status]);

  const validateAuth = () => {
    const nextErrors = {};

    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = "Enter a valid email";
    }

    if (!password) {
      nextErrors.password = "Password is required";
    } else if (password.length < 4) {
      nextErrors.password = "Password must be at least 4 characters";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const signup = async () => {
    if (!validateAuth()) {
      return;
    }

    try {
      setAuthError("");
      setLoadingAuth(true);

      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, name: "User" }),
      });

      const data = await res.json();

      if (res.ok) {
        setAuthError("Account created. Please log in.");
        setIsSignup(false);
      } else {
        setAuthError(data.error || "Unable to create account");
      }
    } catch {
      setAuthError("Something went wrong");
    } finally {
      setLoadingAuth(false);
    }
  };

  const login = async () => {
    if (!validateAuth()) {
      return;
    }

    try {
      setAuthError("");
      setLoadingAuth(true);

      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      } else {
        setAuthError(data.error || "Unable to login");
      }
    } catch {
      setAuthError("Something went wrong");
    } finally {
      setLoadingAuth(false);
    }
  };

  const createPayment = async () => {
    if (!token) {
      return;
    }

    if (!merchantName.trim()) {
      setPaymentError("Enter the merchant name.");
      return;
    }

    if (!upiId.trim()) {
      setPaymentError("Enter the merchant UPI ID.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setPaymentError("Enter an amount greater than zero.");
      return;
    }

    try {
      setLoading(true);
      setPaymentError("");
      setQr("");
      setCurrentTransaction(null);
      setUpiUrl("");

      const res = await fetch(`${API_BASE_URL}/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          merchantName,
          customerName,
          note,
          upiId,
          amount,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to create payment");
      }

      setQr(data.qrCode || "");
      setUpiUrl(data.upiUrl || "");
      setCurrentTransaction(data.transaction || null);
      setCopyState("");
      await fetchTransactions(token);
    } catch (err) {
      setPaymentError(err.message || "Unable to create payment");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionQr = async (transaction) => {
    if (!transaction?._id) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/transaction/${transaction._id}/qr`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to load QR");
      }

      setQr(data.qrCode || "");
      setUpiUrl(data.upiUrl || transaction.paymentUri || "");
      setCurrentTransaction(transaction);
      setAmount(String(transaction.amount || ""));
      setCustomerName(transaction.customerName || "");
      setNote(transaction.note || "");
    } catch (err) {
      setQr("");
      setUpiUrl(transaction.paymentUri || "");
      setCurrentTransaction(transaction);
    }
  };

  const copyPaymentLink = async () => {
    if (!upiUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(upiUrl);
      setCopyState("Payment link copied");
    } catch {
      setCopyState("Unable to copy link");
    }
  };

  const currentStatus = currentTransaction ? normalizeStatus(currentTransaction.status) : "idle";

  if (!token) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#082032_0%,#0f172a_40%,#0b1120_100%)] px-4 py-8 text-slate-50">
        <div className="mx-auto grid min-h-[92vh] max-w-5xl gap-8 rounded-lg border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur md:grid-cols-[1.2fr_0.8fr] md:p-8">
          <div className="flex flex-col justify-between rounded-md border border-white/10 bg-[linear-gradient(180deg,rgba(21,94,117,0.38),rgba(15,23,42,0.2))] p-6">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-cyan-200">UPI Billing</p>
              <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight text-white">
                Generate a UPI QR, collect payment, and watch the live status update.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-200/80">
                Save the merchant UPI ID on this device, create a payment request in seconds, and
                let the backend reflect real payment updates.
              </p>
            </div>

            <div className="mt-8 grid gap-3 text-sm text-slate-100/80 sm:grid-cols-3">
              <div className="rounded-md border border-white/10 bg-black/15 p-4">
                Saved merchant UPI ID
              </div>
              <div className="rounded-md border border-white/10 bg-black/15 p-4">
                Direct amount-based QR
              </div>
              <div className="rounded-md border border-white/10 bg-black/15 p-4">
                Live backend status
              </div>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-[#07111f]/80 p-6 shadow-xl">
            <h2 className="text-2xl font-semibold text-white">{isSignup ? "Create account" : "Login"}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {isSignup ? "Set up your billing workspace." : "Open your billing dashboard."}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className={`w-full rounded-md border bg-white/5 px-3 py-3 text-white outline-none ${
                    fieldErrors.email ? "border-rose-400" : "border-white/10"
                  }`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {fieldErrors.email && <p className="mt-2 text-xs text-rose-300">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Password</label>
                <input
                  type="password"
                  placeholder="Minimum 4 characters"
                  className={`w-full rounded-md border bg-white/5 px-3 py-3 text-white outline-none ${
                    fieldErrors.password ? "border-rose-400" : "border-white/10"
                  }`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {fieldErrors.password && (
                  <p className="mt-2 text-xs text-rose-300">{fieldErrors.password}</p>
                )}
              </div>

              {authError && (
                <p className="rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-amber-200">
                  {authError}
                </p>
              )}

              <button
                onClick={isSignup ? signup : login}
                disabled={loadingAuth}
                className="w-full rounded-md bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAuth ? "Please wait..." : isSignup ? "Create account" : "Login"}
              </button>

              <button
                onClick={() => setIsSignup((currentValue) => !currentValue)}
                className="w-full rounded-md border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/5"
              >
                {isSignup ? "Already have an account? Login" : "Need an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#edf6f6_0%,#f8fafc_32%,#eef2f7_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Smart UPI Billing</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Create a real UPI payment request and track its status live.
            </h1>
          </div>

          <button
            onClick={logout}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Merchant name</label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(event) => setMerchantName(event.target.value)}
                  placeholder="Naveen Stores"
                  className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none transition focus:border-teal-600"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700">Merchant UPI ID</label>
                  <span className="text-xs font-medium text-teal-700">Saved on this device</span>
                </div>
                <input
                  type="text"
                  value={upiId}
                  onChange={(event) => setUpiId(event.target.value)}
                  placeholder="merchant@upi"
                  className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none transition focus:border-teal-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Customer name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Walk-in customer"
                  className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none transition focus:border-teal-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Amount</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="100.00"
                  className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none transition focus:border-teal-600"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="April bill"
                className="w-full rounded-md border border-slate-300 px-3 py-3 outline-none transition focus:border-teal-600"
              />
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-500">Payment amount</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">{formatCurrency(amount)}</p>
              </div>

              <div className="md:w-[280px]">
                <button
                  onClick={createPayment}
                  disabled={loading}
                  className="w-full rounded-md bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Generating QR..." : "Generate payment QR"}
                </button>
                {paymentError && <p className="mt-3 text-sm text-rose-600">{paymentError}</p>}
              </div>
            </div>
          </motion.section>

          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Current payment</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    The status updates automatically when your payment provider sends the backend a real
                    payment event.
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                    statusStyles[currentStatus]
                  }`}
                >
                  {currentStatus}
                </span>
              </div>

              {qr ? (
                <div className="mt-6 space-y-5">
                  <div className="mx-auto flex w-fit items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-4">
                    <img src={qr} alt="Generated UPI QR code" className="h-64 w-64 rounded-sm" />
                  </div>

                  <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span>Invoice</span>
                      <strong>{currentTransaction?.invoiceNumber || "Pending"}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Reference</span>
                      <strong>{currentTransaction?.transactionReference || "Pending"}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Amount</span>
                      <strong>{formatCurrency(currentTransaction?.amount)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Customer</span>
                      <strong>{currentTransaction?.customerName || "Walk-in customer"}</strong>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href={upiUrl}
                      className="rounded-md bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Open UPI app
                    </a>
                    <button
                      onClick={copyPaymentLink}
                      className="rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Copy payment link
                    </button>
                  </div>

                  {copyState && <p className="text-sm text-teal-700">{copyState}</p>}
                </div>
              ) : (
                <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-500">
                  Enter an amount and generate the QR. The merchant UPI ID stays prefilled after you save
                  it once on this device.
                </div>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Recent payments</h2>
                  <p className="mt-1 text-sm text-slate-500">Latest payment requests and live states.</p>
                </div>
                <button
                  onClick={() => fetchTransactions(token)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {transactions.length ? (
                  transactions.map((transaction) => {
                    const transactionStatus = normalizeStatus(transaction.status);

                    return (
                      <button
                        key={transaction._id}
                        onClick={() => void loadTransactionQr(transaction)}
                        className="flex w-full flex-col gap-3 rounded-md border border-slate-200 p-4 text-left transition hover:border-teal-300 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {transaction.invoiceNumber || "Payment request"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {transaction.note || transaction.customerName || "UPI payment"}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                              statusStyles[transactionStatus]
                            }`}
                          >
                            {transactionStatus}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                          <span>{transaction.customerName || "Walk-in customer"}</span>
                          <strong className="text-slate-900">{formatCurrency(transaction.amount)}</strong>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Your payment requests will appear here.
                  </div>
                )}
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
