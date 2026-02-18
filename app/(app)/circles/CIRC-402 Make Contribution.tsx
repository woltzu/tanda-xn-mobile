"use client"

import { useState } from "react"

export default function MakeContributionScreen() {
  const circle = {
    name: "Family Savings",
    amount: 200,
    currentCycle: 3,
    dueDate: "Jan 10, 2025",
  }
  const walletBalance = 450
  const paymentMethods = [
    { id: "wallet", name: "TandaXn Wallet", balance: 450, icon: "💳", default: true },
    { id: "bank", name: "Bank Account •••• 4532", icon: "🏦" },
    { id: "card", name: "Visa •••• 8821", icon: "💳" },
  ]

  const [selectedMethod, setSelectedMethod] = useState("wallet")
  const [isProcessing, setIsProcessing] = useState(false)

  const hasEnoughBalance = selectedMethod === "wallet" ? walletBalance >= circle.amount : true

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Make Contribution</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Circle Info */}
        <div
          style={{
            background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontSize: "28px",
            }}
          >
            🔄
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700" }}>{circle.name}</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", opacity: 0.8 }}>
            Cycle {circle.currentCycle} • Due {circle.dueDate}
          </p>

          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Contribution Amount</p>
            <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>${circle.amount}</p>
          </div>
        </div>

        {/* Payment Method */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Pay From</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "24px" }}>{method.icon}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{method.name}</p>
                  {method.balance !== undefined && (
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      Balance: ${method.balance.toLocaleString()}
                    </p>
                  )}
                </div>
                {selectedMethod === method.id && (
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Low Balance Warning */}
          {selectedMethod === "wallet" && !hasEnoughBalance && (
            <div
              style={{
                marginTop: "12px",
                padding: "14px",
                background: "#FEF3C7",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>Insufficient balance</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#B45309" }}>
                  You need ${(circle.amount - walletBalance).toFixed(2)} more
                </p>
              </div>
              <button
                onClick={() => console.log("Add Funds")}
                style={{
                  background: "#D97706",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Add Funds
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Summary</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Contribution</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>${circle.amount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Processing Fee</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>$0.00</span>
            </div>
            <div
              style={{
                borderTop: "1px solid #E5E7EB",
                paddingTop: "10px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>${circle.amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <p
          style={{
            margin: "16px 0 0 0",
            fontSize: "11px",
            color: "#9CA3AF",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          By contributing, you agree to the circle's terms. Contributions are non-refundable once the cycle begins.
        </p>
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
            console.log("Processing payment")
          }}
          disabled={!hasEnoughBalance || isProcessing}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: hasEnoughBalance && !isProcessing ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: hasEnoughBalance && !isProcessing ? "#FFFFFF" : "#9CA3AF",
            cursor: hasEnoughBalance && !isProcessing ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isProcessing ? (
            <>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid #FFFFFF",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Processing...
            </>
          ) : (
            `Pay $${circle.amount}`
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
