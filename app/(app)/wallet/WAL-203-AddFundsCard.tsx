"use client"

import { useState } from "react"

export default function AddFundsCardScreen() {
  const [selectedCard, setSelectedCard] = useState("card1")
  const [cvv, setCvv] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const amount = 200
  const fee = 5.8
  const total = amount + fee

  const savedCards = [
    { id: "card1", last4: "8821", brand: "Visa", expiry: "12/27" },
    { id: "card2", last4: "4532", brand: "Mastercard", expiry: "08/26" },
  ]

  const canPay = selectedCard && cvv.length >= 3

  const getCardIcon = (brand: string) => {
    return "💳"
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Card Payment</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Instant deposit</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount Summary */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", opacity: 0.7 }}>{"You'll receive"}</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>${amount.toFixed(2)}</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", opacity: 0.7 }}>
            Total charge: ${total.toFixed(2)} (includes ${fee.toFixed(2)} fee)
          </p>
        </div>

        {/* Select Card */}
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
            Select Card
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {savedCards.map((card) => (
              <button
                key={card.id}
                onClick={() => setSelectedCard(card.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedCard === card.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedCard === card.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{getCardIcon(card.brand)}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {card.brand} •••• {card.last4}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Expires {card.expiry}</p>
                </div>
                {selectedCard === card.id && (
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
            onClick={() => console.log("Add new card")}
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
            Add New Card
          </button>
        </div>

        {/* CVV Input */}
        {selectedCard && (
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
              style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
            >
              Security Code (CVV)
            </label>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                type="password"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="•••"
                maxLength={4}
                style={{
                  width: "100px",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "20px",
                  textAlign: "center",
                  letterSpacing: "4px",
                  outline: "none",
                }}
              />
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", flex: 1 }}>
                3 or 4 digit code on the back of your card
              </p>
            </div>
          </div>
        )}

        {/* Fee Info */}
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
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Card payments have a 2.9% processing fee. For free deposits, use bank transfer instead.
          </p>
        </div>
      </div>

      {/* Pay Button */}
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
          disabled={!canPay || isProcessing}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canPay && !isProcessing ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canPay && !isProcessing ? "#FFFFFF" : "#9CA3AF",
            cursor: canPay && !isProcessing ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isProcessing ? (
            <>Processing...</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Pay ${total.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
