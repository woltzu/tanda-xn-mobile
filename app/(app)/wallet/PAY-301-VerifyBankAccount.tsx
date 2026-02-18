"use client"

import { useState } from "react"

export default function VerifyBankAccountScreen() {
  const account = {
    name: "Chase Bank",
    last4: "4532",
    type: "Checking",
  }

  const [amount1, setAmount1] = useState("")
  const [amount2, setAmount2] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  const canVerify = amount1.length > 0 && amount2.length > 0

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Verify Account</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Account Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#0A2342",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>{account.name}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
              {account.type} •••• {account.last4}
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ background: "#FEF3C7", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#92400E" }}>
                Check your bank statement
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#B45309", lineHeight: 1.5 }}>
                We sent two small deposits to your account. Enter the exact amounts below to verify ownership.
              </p>
            </div>
          </div>
        </div>

        {/* Deposit Amounts */}
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
            style={{
              display: "block",
              marginBottom: "16px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
            }}
          >
            Enter the two deposit amounts
          </label>

          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>First deposit</p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "16px", color: "#6B7280" }}>$0.</span>
                <input
                  type="text"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="00"
                  maxLength={2}
                  style={{
                    width: "40px",
                    border: "none",
                    background: "transparent",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#0A2342",
                    outline: "none",
                  }}
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Second deposit</p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "16px", color: "#6B7280" }}>$0.</span>
                <input
                  type="text"
                  value={amount2}
                  onChange={(e) => setAmount2(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="00"
                  maxLength={2}
                  style={{
                    width: "40px",
                    border: "none",
                    background: "transparent",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#0A2342",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          </div>

          <p style={{ margin: "12px 0 0 0", fontSize: "12px", color: "#6B7280", textAlign: "center" }}>
            Example: If you see $0.12 and $0.34, enter "12" and "34"
          </p>
        </div>

        {/* Didn't receive */}
        <button
          onClick={() => console.log("Resend deposits")}
          style={{
            width: "100%",
            padding: "14px",
            background: "none",
            border: "none",
            color: "#00C6AE",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Didn't receive deposits? Resend
        </button>

        {/* Timeline */}
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
            Micro-deposits typically appear within 1-2 business days. Check your recent transactions.
          </p>
        </div>
      </div>

      {/* Verify Button */}
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
            setIsVerifying(true)
            console.log("Verify", { amount1, amount2 })
          }}
          disabled={!canVerify || isVerifying}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canVerify && !isVerifying ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canVerify && !isVerifying ? "#FFFFFF" : "#9CA3AF",
            cursor: canVerify && !isVerifying ? "pointer" : "not-allowed",
          }}
        >
          {isVerifying ? "Verifying..." : "Verify Account"}
        </button>
      </div>
    </div>
  )
}
