"use client"

import { useState } from "react"

export default function WithdrawalReviewScreen() {
  const withdrawal = {
    amount: 500,
    account: { name: "Chase Bank", last4: "4532" },
    estimatedArrival: "Jan 3-5, 2025",
    fee: 0,
  }

  const [isProcessing, setIsProcessing] = useState(false)
  const total = withdrawal.amount - withdrawal.fee

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => console.log("Go back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Review Withdrawal</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount Card */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            textAlign: "center",
            color: "#FFFFFF",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", opacity: 0.7 }}>You're withdrawing</p>
          <p style={{ margin: 0, fontSize: "42px", fontWeight: "700" }}>${withdrawal.amount.toFixed(2)}</p>
        </div>

        {/* Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Withdrawal Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>To Account</span>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  {withdrawal.account.name}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  •••• {withdrawal.account.last4}
                </p>
              </div>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Amount</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                ${withdrawal.amount.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Fee</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>$0.00</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>You'll receive</span>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${total.toFixed(2)}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Estimated Arrival</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {withdrawal.estimatedArrival}
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Free withdrawals to verified bank accounts. Your funds are protected during transfer.
          </p>
        </div>
      </div>

      {/* Confirm Button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <button
          onClick={() => {
            setIsProcessing(true)
            console.log("Withdrawal confirmed")
          }}
          disabled={isProcessing}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isProcessing ? "#E5E7EB" : "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: isProcessing ? "#9CA3AF" : "#FFFFFF",
            cursor: isProcessing ? "not-allowed" : "pointer",
          }}
        >
          {isProcessing ? "Processing..." : "Confirm Withdrawal"}
        </button>
      </div>
    </div>
  )
}
