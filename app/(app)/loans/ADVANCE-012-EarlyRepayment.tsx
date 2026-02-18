"use client"

import { useState } from "react"

export default function EarlyRepaymentScreen() {
  const advance = {
    id: "ADV-2025-0120-001",
    originalAmount: 300,
    originalFee: 15,
    originalTotal: 315,
    currentBalance: 310,
    feeIfPaidNow: 10,
    feeSavings: 5,
    daysRemaining: 20,
    withholdingDate: "Feb 15, 2025",
  }

  const walletBalance = 450

  const paymentMethods = [
    { id: "wallet", name: "TandaXn Wallet", balance: 450, icon: "💳" },
    { id: "bank", name: "Chase ••••4521", type: "Bank", icon: "🏦" },
  ]

  const [selectedMethod, setSelectedMethod] = useState("wallet")
  const [confirmed, setConfirmed] = useState(false)

  const payoffAmount = advance.originalAmount + advance.feeIfPaidNow
  const hasEnoughBalance = selectedMethod === "wallet" && walletBalance >= payoffAmount

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "160px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Early Repayment</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Pay off your advance today</p>
          </div>
        </div>

        {/* Payoff Amount */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", opacity: 0.8 }}>Pay off amount</p>
          <p style={{ margin: 0, fontSize: "42px", fontWeight: "700" }}>${payoffAmount}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Savings Highlight */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "2px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#065F46" }}>
                Save ${advance.feeSavings} in fees!
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#047857" }}>
                Plus earn +2 bonus XnScore points for early repayment
              </p>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Compare Your Options
          </h3>

          <div style={{ display: "flex", gap: "12px" }}>
            {/* Wait Option */}
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "#6B7280", fontWeight: "600" }}>
                WAIT FOR PAYOUT
              </p>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>
                Pay on {advance.withholdingDate}
              </p>
              <p style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700", color: "#6B7280" }}>
                ${advance.originalTotal}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Full fee: ${advance.originalFee}</p>
            </div>

            {/* Pay Today Option */}
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F0FDFB",
                borderRadius: "12px",
                textAlign: "center",
                border: "2px solid #00C6AE",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "#00897B", fontWeight: "600" }}>PAY TODAY ✓</p>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#00897B" }}>Save ${advance.feeSavings}</p>
              <p style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
                ${payoffAmount}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#00897B" }}>Reduced fee: ${advance.feeIfPaidNow}</p>
            </div>
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
          <label
            style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Pay From
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                  border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>{method.icon}</span>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{method.name}</p>
                    {method.balance && (
                      <p
                        style={{
                          margin: "2px 0 0 0",
                          fontSize: "12px",
                          color: method.balance >= payoffAmount ? "#00C6AE" : "#DC2626",
                        }}
                      >
                        Balance: ${method.balance.toFixed(2)}
                        {method.balance < payoffAmount && " (insufficient)"}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: selectedMethod === method.id ? "none" : "2px solid #D1D5DB",
                    background: selectedMethod === method.id ? "#00C6AE" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedMethod === method.id && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {selectedMethod === "wallet" && !hasEnoughBalance && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                background: "#FEE2E2",
                borderRadius: "8px",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#DC2626" }}>
                ⚠️ Insufficient wallet balance. Add ${(payoffAmount - walletBalance).toFixed(2)} or choose another
                payment method.
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Checkbox */}
        <button
          onClick={() => setConfirmed(!confirmed)}
          style={{
            width: "100%",
            padding: "14px",
            background: confirmed ? "#F0FDFB" : "#FFFFFF",
            borderRadius: "12px",
            border: confirmed ? "2px solid #00C6AE" : "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            textAlign: "left",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              border: confirmed ? "none" : "2px solid #D1D5DB",
              background: confirmed ? "#00C6AE" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            {confirmed && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#0A2342", lineHeight: 1.5 }}>
            I understand that paying ${payoffAmount} today will close this advance immediately and I will save $
            {advance.feeSavings} in fees.
          </p>
        </button>

        {/* Benefits */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            Benefits of early repayment:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "💰", text: `Save $${advance.feeSavings} in advance fees` },
              { icon: "⭐", text: "+2 bonus XnScore points" },
              { icon: "🔓", text: "Free up your payout for other uses" },
              { icon: "📈", text: "Improve eligibility for larger advances" },
            ].map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", color: "#4B5563" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
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
          onClick={() => console.log("Confirm repayment", { amount: payoffAmount, method: selectedMethod })}
          disabled={!confirmed || (selectedMethod === "wallet" && !hasEnoughBalance)}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: confirmed && (selectedMethod !== "wallet" || hasEnoughBalance) ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: confirmed && (selectedMethod !== "wallet" || hasEnoughBalance) ? "#FFFFFF" : "#9CA3AF",
            cursor: confirmed && (selectedMethod !== "wallet" || hasEnoughBalance) ? "pointer" : "not-allowed",
          }}
        >
          Pay ${payoffAmount} & Close Advance
        </button>
      </div>
    </div>
  )
}
