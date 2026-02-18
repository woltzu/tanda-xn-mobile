"use client"

import { useState } from "react"

export default function AddBankAccountScreen() {
  const [routingNumber, setRoutingNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [confirmAccount, setConfirmAccount] = useState("")
  const [accountType, setAccountType] = useState("checking")
  const [nickname, setNickname] = useState("")

  const canContinue = routingNumber.length === 9 && accountNumber.length >= 8 && accountNumber === confirmAccount

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
            onClick={() => console.log("Back")}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Add Bank Account</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Quick Link Option */}
        <button
          onClick={() => console.log("Use Plaid")}
          style={{
            width: "100%",
            padding: "16px",
            background: "#00C6AE",
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Instant Link with Plaid</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              Securely connect in seconds
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div style={{ textAlign: "center", margin: "16px 0", color: "#6B7280", fontSize: "13px" }}>
          — or enter manually —
        </div>

        {/* Manual Entry Form */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* Routing Number */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              Routing Number
            </label>
            <input
              type="text"
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="9 digits"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </div>

          {/* Account Number */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              Account Number
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
              placeholder="8-17 digits"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </div>

          {/* Confirm Account Number */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              Confirm Account Number
            </label>
            <input
              type="text"
              value={confirmAccount}
              onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
              placeholder="Re-enter account number"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border:
                  accountNumber && confirmAccount && accountNumber !== confirmAccount
                    ? "2px solid #DC2626"
                    : "1px solid #E5E7EB",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
            {accountNumber && confirmAccount && accountNumber !== confirmAccount && (
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#DC2626" }}>Account numbers don't match</p>
            )}
          </div>

          {/* Account Type */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              Account Type
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              {["checking", "savings"].map((type) => (
                <button
                  key={type}
                  onClick={() => setAccountType(type)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: accountType === type ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: accountType === type ? "#F0FDFB" : "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0A2342",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              Nickname (Optional)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g., Main Checking"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Security Note */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Your bank information is encrypted and secure. We'll verify your account with two small deposits.
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
          onClick={() => console.log("Continue", { routingNumber, accountNumber, accountType, nickname })}
          disabled={!canContinue}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canContinue ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canContinue ? "#FFFFFF" : "#9CA3AF",
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
