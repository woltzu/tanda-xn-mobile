"use client"

import { useState } from "react"

export default function AddMobileMoneyScreen() {
  const providers = [
    { id: "wave", name: "Wave", icon: "🌊", countries: ["Senegal", "Côte d'Ivoire", "Mali"] },
    { id: "mpesa", name: "M-Pesa", icon: "📱", countries: ["Kenya", "Tanzania", "DRC"] },
    { id: "orangemoney", name: "Orange Money", icon: "🟠", countries: ["Senegal", "Mali", "Côte d'Ivoire"] },
    { id: "mtn", name: "MTN MoMo", icon: "🟡", countries: ["Ghana", "Uganda", "Rwanda"] },
  ]

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [countryCode, setCountryCode] = useState("+1")

  const canContinue = selectedProvider && phoneNumber.length >= 9

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Add Mobile Money</h1>
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
            style={{
              display: "block",
              marginBottom: "12px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
            }}
          >
            Select Provider
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                style={{
                  padding: "16px",
                  background: selectedProvider === provider.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedProvider === provider.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "center",
                  position: "relative",
                }}
              >
                {selectedProvider === provider.id && (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "20px",
                      height: "20px",
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
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>{provider.icon}</span>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{provider.name}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "#6B7280" }}>
                  {provider.countries.slice(0, 2).join(", ")}
                </p>
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
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              Phone Number
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "16px",
                  background: "#FFFFFF",
                  minWidth: "90px",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="+1">+1 🇺🇸</option>
                <option value="+221">+221 🇸🇳</option>
                <option value="+225">+225 🇨🇮</option>
                <option value="+254">+254 🇰🇪</option>
                <option value="+233">+233 🇬🇭</option>
                <option value="+256">+256 🇺🇬</option>
              </select>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="Phone number"
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Enter the phone number linked to your {providers.find((p) => p.id === selectedProvider)?.name} account
            </p>
          </div>
        )}

        {/* How It Works */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>How It Works</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { step: 1, text: "We'll send a verification code to your phone" },
              { step: 2, text: "Enter the code to confirm ownership" },
              { step: 3, text: "Your mobile money account is linked!" },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "12px",
                    color: "#0A2342",
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Mobile money is a fast and easy way to add funds, especially if you're outside the US.
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
          onClick={() => console.log("Send Code", { provider: selectedProvider, phone: countryCode + phoneNumber })}
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
          Send Verification Code
        </button>
      </div>
    </div>
  )
}
