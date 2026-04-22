import { useState } from "react";

function App() {
  const [amount, setAmount] = useState("");
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("");

  const createPayment = async () => {
    const res = await fetch("http://localhost:5000/api/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        note: "Lunch",
        upiId: "test@upi",
      }),
    });

    const data = await res.json();

    console.log("Backend Response:", data); // 👈 IMPORTANT DEBUG

    setQr(data.qrCode); // ✅ FIX HERE
    setStatus("pending");

    startPolling(data.transaction._id);
  };

  const startPolling = (id) => {
    const interval = setInterval(async () => {
      const res = await fetch(`http://localhost:5000/api/transaction/${id}`);
      const data = await res.json();

      if (data.status === "success") {
        setStatus("success");
        clearInterval(interval);
      }
    }, 3000);
  };

  return (
    <div style={{ textAlign: "center", marginTop: "60px" }}>
      <h1>UPI Billing App</h1>

      <input
        type="number"
        placeholder="Enter amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <br />
      <br />

      <button onClick={createPayment}>Generate QR</button>

      <br />
      <br />

      {qr && <img src={qr} alt="QR" width="200" />}

      <h2>Status: {status}</h2>
    </div>
  );
}

export default App;
