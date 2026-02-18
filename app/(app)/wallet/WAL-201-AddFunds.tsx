"use client"
import { ArrowLeft, Plus } from "lucide-react"
import { useState } from "react"

export default function AddFundsScreen() {
  const [amount, setAmount] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const currentBalance = 850.0
  const paymentMethods = [
    {
      id: "bank",
      name: "Bank Transfer",
      subtitle: "Free • 1-3 business days",
      icon: "🏦",
      fee: 0,
      available: true,
    },
    {
      id: "card",
      name: "Debit Card",
      subtitle: "2.9% fee • Instant",
      icon: "💳",
      fee: 2.9,
      available: true,
    },
    {
      id: "mobile",
      name: "Mobile Money",
      subtitle: "Wave, M-Pesa • 1% fee",
      icon: "📱",
      fee: 1,
      available: true,
    },
  ]

  const quickAmounts = [50, 100, 200, 500]
  const parsedAmount = Number.parseFloat(amount) || 0

  const getFee = () => {
    if (!selectedMethod) return 0
    const method = paymentMethods.find((m) => m.id === selectedMethod)
    return method ? (parsedAmount * method.fee) / 100 : 0
  }

  const getTotal = () => parsedAmount + getFee()
  const canContinue = parsedAmount >= 10 && selectedMethod

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
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
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Add Funds</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Current balance: ${currentBalance.toFixed(2)}
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
            Amount to Add
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
              min="10"
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
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: amount === amt.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: amount === amt.toString() ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Minimum: $10</p>
        </div>

        {/* Payment Methods */}
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
            Payment Method
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                disabled={!method.available}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: method.available ? "pointer" : "not-allowed",
                  opacity: method.available ? 1 : 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{method.icon}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{method.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{method.subtitle}</p>
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

          <button
            onClick={() => console.log("Add payment method")}
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
            <Plus size={16} />
            Add New Payment Method
          </button>
        </div>

        {/* Summary */}
        {parsedAmount > 0 && selectedMethod && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Amount</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
                  ${parsedAmount.toFixed(2)}
                </span>
              </div>
              {getFee() > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Processing Fee</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>${getFee().toFixed(2)}</span>
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
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Total</span>
                <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${getTotal().toFixed(2)}</span>
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
          onClick={() => console.log("Continue", { selectedMethod, amount: parsedAmount })}
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
