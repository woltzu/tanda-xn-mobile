"use client"

import { useState } from "react"

export default function AddFundsMobileMoneyScreen() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("")

  const amount = 200
  const providers = [
    { id: "wave", name: "Wave", icon: "🌊", fee: 1, available: true, countries: ["Senegal", "Côte d'Ivoire"] },
    { id: "mpesa", name: "M-Pesa", icon: "📱", fee: 1.5, available: true, countries: ["Kenya", "Tanzania"] },
    { id: "orangemoney", name: "Orange Money", icon: "🟠", fee: 1, available: true, countries: ["Senegal", "Mali"] },
    { id: "mtn", name: "MTN Mobile Money", icon: "🟡", fee: 1.2, available: true, countries: ["Ghana", "Uganda"] },
  ]

  const selectedProviderData = providers.find((p) => p.id === selectedProvider)
  const fee = selectedProviderData ? (amount * selectedProviderData.fee) / 100 : 0
  const total = amount + fee
  const canContinue = selectedProvider && phoneNumber.length >= 10

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Mobile Money</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Adding ${amount.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Select Provider */}
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
            Select Provider
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                disabled={!provider.available}
                style={{
                  padding: "16px",
                  background: selectedProvider === provider.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedProvider === provider.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: provider.available ? "pointer" : "not-allowed",
                  opacity: provider.available ? 1 : 0.5,
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>{provider.icon}</span>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{provider.name}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{provider.fee}% fee</p>
              </button>
            ))}
          </div>
        </div>

        {/* Phone Number */}
        {selectedProvider && (
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
              {selectedProviderData?.name} Phone Number
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "16px", color: "#6B7280" }}>+</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="1 234 567 8900"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  fontSize: "18px",
                  fontWeight: "500",
                  color: "#0A2342",
                  outline: "none",
                }}
              />
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Enter the phone number linked to your {selectedProviderData?.name} account
            </p>
          </div>
        )}

        {/* Summary */}
        {selectedProvider && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Amount</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>${amount.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                  Fee ({selectedProviderData?.fee}%)
                </span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>${fee.toFixed(2)}</span>
              </div>
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.2)",
                  paddingTop: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Total</span>
                <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* How It Works */}
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
          <div>
            <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
              <strong>How it works:</strong> {"You'll"} receive a payment request on your phone. Confirm it in your
              mobile money app to complete the deposit.
            </p>
          </div>
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
          onClick={() => console.log("Send payment request", selectedProvider, phoneNumber, total)}
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
          Send Payment Request
        </button>
      </div>
    </div>
  )
}
