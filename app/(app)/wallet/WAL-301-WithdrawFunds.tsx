"use client"

import { useState } from "react"

export default function WithdrawFundsScreen() {
  const availableBalance = 850.0
  const linkedAccounts = [
    { id: "bank1", type: "bank", name: "Chase Bank", last4: "4532", primary: true },
    { id: "bank2", type: "bank", name: "Bank of America", last4: "7890", primary: false },
  ]

  const [amount, setAmount] = useState("")
  const [selectedAccount, setSelectedAccount] = useState(linkedAccounts.find((a) => a.primary)?.id || null)

  const parsedAmount = Number.parseFloat(amount) || 0
  const quickAmounts = [100, 250, 500]
  const canWithdraw = parsedAmount >= 10 && parsedAmount <= availableBalance && selectedAccount

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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Withdraw Funds</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Available: ${availableBalance.toFixed(2)}
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
            Amount to Withdraw
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
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                disabled={amt > availableBalance}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: amount === amt.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: amount === amt.toString() ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "14px",
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
                padding: "12px",
                borderRadius: "10px",
                border: amount === availableBalance.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                background: amount === availableBalance.toString() ? "#F0FDFB" : "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                color: "#00C6AE",
                cursor: "pointer",
              }}
            >
              All
            </button>
          </div>
          {parsedAmount > availableBalance && (
            <p style={{ margin: 0, fontSize: "12px", color: "#DC2626" }}>Amount exceeds available balance</p>
          )}
        </div>

        {/* Select Account */}
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
            Withdraw To
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {linkedAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => setSelectedAccount(account.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedAccount === account.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedAccount === account.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#0A2342",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{account.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>•••• {account.last4}</p>
                </div>
                {account.primary && (
                  <span
                    style={{
                      background: "#F0FDFB",
                      color: "#00897B",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600",
                    }}
                  >
                    Primary
                  </span>
                )}
                {selectedAccount === account.id && (
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
          <button
            onClick={() => console.log("Add bank account")}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "12px",
              background: "none",
              border: "1px dashed #D1D5DB",
              borderRadius: "10px",
              color: "#6B7280",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Bank Account
          </button>
        </div>

        {/* Timeline Info */}
        <div
          style={{
            background: "#F5F7FA",
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
            stroke="#6B7280"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Withdrawals typically arrive within 1-3 business days. Weekend and holiday withdrawals may take longer.
          </p>
        </div>
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
          onClick={() =>
            canWithdraw && console.log("Continue with withdrawal:", { selectedAccount, amount: parsedAmount })
          }
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
