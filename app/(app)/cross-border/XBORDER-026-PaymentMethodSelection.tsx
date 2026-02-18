"use client"

import { useState } from "react"

export default function PaymentMethodSelectionScreen() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const methods = [
    {
      id: "wallet",
      name: "TandaXn Wallet",
      icon: "💰",
      balance: 2500,
      fee: 0,
      speed: "Instant",
      recommended: true,
    },
    {
      id: "bank",
      name: "Bank Account",
      icon: "🏦",
      lastFour: "4521",
      bankName: "Chase",
      fee: 0,
      speed: "1-2 business days",
    },
    {
      id: "debit",
      name: "Debit Card",
      icon: "💳",
      lastFour: "8923",
      cardBrand: "Visa",
      fee: 2.9,
      feeType: "percent",
      speed: "Instant",
    },
  ]

  const transferAmount = 200

  const calculateFee = (method: any) => {
    if (method.feeType === "percent") {
      return ((transferAmount * method.fee) / 100).toFixed(2)
    }
    return method.fee.toFixed(2)
  }

  const handleBack = () => console.log("Back")
  const handleSelectMethod = (method: any) => {
    setSelectedMethod(method.id)
    console.log("Selected method:", method)
  }
  const handleAddNew = () => console.log("Add new payment method")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Pay With</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>Sending ${transferAmount}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Payment Methods */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {methods.map((method) => {
            const fee = calculateFee(method)
            const isWallet = method.id === "wallet"
            const hasInsufficientBalance = isWallet && method.balance < transferAmount

            return (
              <button
                key={method.id}
                onClick={() => !hasInsufficientBalance && handleSelectMethod(method)}
                disabled={hasInsufficientBalance}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  border: method.recommended ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  cursor: hasInsufficientBalance ? "not-allowed" : "pointer",
                  opacity: hasInsufficientBalance ? 0.6 : 1,
                  textAlign: "left",
                  position: "relative",
                }}
              >
                {method.recommended && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-8px",
                      right: "12px",
                      padding: "2px 8px",
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      fontSize: "9px",
                      fontWeight: "700",
                      borderRadius: "4px",
                    }}
                  >
                    RECOMMENDED
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    {method.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{method.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      {isWallet
                        ? `Balance: $${method.balance.toLocaleString()}`
                        : (method as any).bankName
                          ? `${(method as any).bankName} •••• ${method.lastFour}`
                          : `${(method as any).cardBrand} •••• ${method.lastFour}`}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        fontWeight: "600",
                        color: Number.parseFloat(fee) === 0 ? "#00C6AE" : "#0A2342",
                      }}
                    >
                      {Number.parseFloat(fee) === 0 ? "No fee" : `+$${fee}`}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{method.speed}</p>
                  </div>
                </div>
                {hasInsufficientBalance && (
                  <p style={{ margin: "10px 0 0 0", fontSize: "12px", color: "#DC2626" }}>
                    Insufficient balance. Add ${(transferAmount - method.balance).toFixed(2)} more.
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {/* Add New */}
        <button
          onClick={handleAddNew}
          style={{
            width: "100%",
            padding: "16px",
            marginTop: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "2px dashed #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>Add Payment Method</span>
        </button>

        {/* Security Note */}
        <div
          style={{
            marginTop: "20px",
            padding: "14px",
            background: "#F5F7FA",
            borderRadius: "12px",
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
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Your payment information is encrypted and securely stored. We never share your details with third parties.
          </p>
        </div>
      </div>
    </div>
  )
}
