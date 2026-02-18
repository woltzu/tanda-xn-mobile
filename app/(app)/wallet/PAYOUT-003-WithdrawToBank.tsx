"use client"

import { useState } from "react"

export default function WithdrawToBankScreen() {
  const availableBalance = 2074
  const linkedAccounts = [
    { id: "bank1", name: "Chase Bank", last4: "4532", type: "Checking", primary: true },
    { id: "bank2", name: "Bank of America", last4: "7890", type: "Savings", primary: false },
  ]

  const [amount, setAmount] = useState("")
  const [selectedAccount, setSelectedAccount] = useState(linkedAccounts.find((a) => a.primary)?.id || null)
  const [speed, setSpeed] = useState("standard")

  const parsedAmount = Number.parseFloat(amount) || 0
  const fee = speed === "instant" ? Math.min(parsedAmount * 0.015, 15) : 0
  const total = parsedAmount - fee
  const canWithdraw = parsedAmount >= 10 && parsedAmount <= availableBalance && selectedAccount

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleContinue = () => {
    console.log("Continue with withdrawal", { amount: parsedAmount, accountId: selectedAccount, speed, fee, total })
  }

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
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={handleBack}
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Withdraw to Bank</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Available: ${availableBalance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount Input */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Amount
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "16px",
              background: "#F5F7FA",
              borderRadius: "12px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "28px", fontWeight: "600", color: "#0A2342" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              max={availableBalance}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "36px",
                fontWeight: "700",
                color: "#0A2342",
                outline: "none",
                width: "100%",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[100, 500, 1000].map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                disabled={amt > availableBalance}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: amt <= availableBalance ? "pointer" : "not-allowed",
                  opacity: amt <= availableBalance ? 1 : 0.5,
                }}
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => setAmount(availableBalance.toString())}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #00C6AE",
                background: "#F0FDFB",
                fontSize: "13px",
                fontWeight: "600",
                color: "#00C6AE",
                cursor: "pointer",
              }}
            >
              All
            </button>
          </div>
        </div>

        {/* Transfer Speed */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Transfer Speed
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={() => setSpeed("standard")}
              style={{
                width: "100%",
                padding: "14px",
                background: speed === "standard" ? "#F0FDFB" : "#F5F7FA",
                borderRadius: "12px",
                border: speed === "standard" ? "2px solid #00C6AE" : "1px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: speed === "standard" ? "#00C6AE" : "#E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={speed === "standard" ? "#FFFFFF" : "#6B7280"}
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Standard</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>1-3 business days • Free</p>
              </div>
              {speed === "standard" && (
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
            <button
              onClick={() => setSpeed("instant")}
              style={{
                width: "100%",
                padding: "14px",
                background: speed === "instant" ? "#F0FDFB" : "#F5F7FA",
                borderRadius: "12px",
                border: speed === "instant" ? "2px solid #00C6AE" : "1px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: speed === "instant" ? "#00C6AE" : "#E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={speed === "instant" ? "#FFFFFF" : "#6B7280"}
                  strokeWidth="2"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Instant</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Minutes • 1.5% fee (max $15)</p>
              </div>
              {speed === "instant" && (
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
          </div>
        </div>

        {/* To Account */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            To Account
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {linkedAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccount(account.id)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: selectedAccount === account.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                  border: selectedAccount === account.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#0A2342",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{account.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                    {account.type} •••• {account.last4}
                  </p>
                </div>
                {selectedAccount === account.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {parsedAmount > 0 && (
          <div style={{ background: "#0A2342", borderRadius: "14px", padding: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Amount</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
                  ${parsedAmount.toFixed(2)}
                </span>
              </div>
              {fee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Instant fee</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#D97706" }}>-${fee.toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.2)",
                  paddingTop: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>You'll receive</span>
                <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Continue Button */}
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
          onClick={handleContinue}
          disabled={!canWithdraw}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canWithdraw ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canWithdraw ? "#FFFFFF" : "#9CA3AF",
            cursor: canWithdraw ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
