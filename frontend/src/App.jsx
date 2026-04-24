import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:5000/api";

function App() {
  const [amount, setAmount] = useState("");
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [currentId, setCurrentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 4) {
      newErrors.password = "Password must be at least 4 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setTransactions([]);
    setCurrentId("");
    setQr("");
    setStatus("");
  };

  const signup = async () => {
    if (!validate()) return;

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
        setAuthError("Account created! Please login.");
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
    if (!validate()) return;

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

  const fetchTransactions = async (authToken) => {
    if (!authToken) return;

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

  const simulatePayment = async (nextStatus) => {
    if (!currentId) return;

    try {
      await fetch(`${API_BASE_URL}/simulate/${currentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!token) return undefined;

    const loadTransactions = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/transactions`, {
          headers: {
            Authorization: `Bearer ${token}`,
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

    const initialTimeout = setTimeout(loadTransactions, 0);
    const interval = setInterval(loadTransactions, 1500);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [token]);

  const createPayment = async () => {
    if (!amount || !token) return;

    try {
      setLoading(true);
      setStatus("pending");
      setQr("");

      const res = await fetch(`${API_BASE_URL}/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          note: "Payment",
          upiId: "test@upi",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to create payment");
      }

      setQr(data.qrCode || "");
      setCurrentId(data.transaction?._id || "");

      if (data.transaction?._id) {
        pollStatus(data.transaction._id);
      }
    } catch (err) {
      setStatus("failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/transaction/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (data.status === "success") {
          setStatus("success");
          void fetchTransactions(token);
          clearInterval(interval);

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
        console.error(err);
        clearInterval(interval);
      }
    }, 2000);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#020617] text-white">
        <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl w-80 space-y-4 border border-white/10">
          <h2 className="text-2xl font-bold text-center">
            {isSignup ? "Create Account" : "Login"}
          </h2>

          <input
            type="email"
            placeholder="Email"
            className={`w-full p-2 rounded bg-black/30 border ${
              errors.email ? "border-red-500" : "border-white/20"
            }`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {errors.email && (
            <p className="text-xs text-red-400">{errors.email}</p>
          )}

          <input
            type="password"
            placeholder="Password"
            className={`w-full p-2 rounded bg-black/30 border ${
              errors.password ? "border-red-500" : "border-white/20"
            }`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {errors.password && (
            <p className="text-xs text-red-400">{errors.password}</p>
          )}

          {authError && (
            <p className="text-sm text-red-400 text-center">{authError}</p>
          )}

          <button
            onClick={isSignup ? signup : login}
            disabled={!email || !password || loadingAuth}
            className={`w-full p-2 rounded-lg font-semibold ${
              !email || !password
                ? "bg-gray-500 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-400 text-black"
            }`}
          >
            {loadingAuth ? "Please wait..." : isSignup ? "Sign Up" : "Login"}
          </button>

          <p className="text-sm text-center text-gray-300">
            {isSignup ? "Already have an account?" : "Don't have an account?"}
            <span
              onClick={() => setIsSignup((currentValue) => !currentValue)}
              className="text-emerald-400 cursor-pointer ml-1"
            >
              {isSignup ? "Login" : "Sign Up"}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 text-transparent bg-clip-text">
            Smart UPI Billing
          </h1>
          <p className="text-gray-400 mt-2">
            Instant QR payments with live tracking
          </p>
        </motion.div>

        <button
          onClick={logout}
          className="ml-auto mb-6 block bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-lg"
        >
          Logout
        </button>

        <div className="grid md:grid-cols-2 gap-6">
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
              onChange={(event) => setAmount(event.target.value)}
              className="w-full p-3 rounded-lg bg-black/40 border border-white/20 text-white placeholder-gray-400 focus:border-emerald-400 outline-none mb-4"
            />

            <button
              onClick={createPayment}
              disabled={loading || status === "pending"}
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
                    <img src={qr} alt="Generated payment QR code" className="w-40" />
                  </div>
                </motion.div>
              )}

              {qr && (
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => simulatePayment("success")}
                    className="w-full bg-green-500 hover:bg-green-400 text-black p-2 rounded-lg"
                  >
                    Simulate Success
                  </button>

                  <button
                    onClick={() => simulatePayment("failed")}
                    className="w-full bg-red-500 hover:bg-red-400 text-white p-2 rounded-lg"
                  >
                    Simulate Failure
                  </button>
                </div>
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
                  Payment Successful
                </div>
              )}

              {status === "failed" && (
                <div className="text-red-400 font-semibold text-lg">
                  Payment Failed
                </div>
              )}

              {!status && <div className="text-gray-400">Idle</div>}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl"
          >
            <h2 className="text-xl font-semibold mb-4">Transactions</h2>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {transactions.map((transaction) => (
                <motion.div
                  key={transaction._id}
                  whileHover={{ scale: 1.02 }}
                  className="flex justify-between items-center bg-black/40 p-3 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">Rs. {transaction.amount}</p>
                    <p className="text-sm text-gray-400">{transaction.note}</p>
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full ${
                      transaction.status === "success"
                        ? "bg-green-500/20 text-green-300"
                        : transaction.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {transaction.status}
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
