"use client"

import { useState } from "react"

export default function RecipientDetailsScreen() {
  const recipient = {
    name: "",
    country: "Cameroon",
    flag: "🇨🇲",
    currency: "XAF",
  }

  const deliveryMethods = [
    { id: "mobile", label: "Mobile Money", icon: "📱", description: "MTN, Orange Money", speed: "Instant" },
    { id: "bank", label: "Bank Transfer", icon: "🏦", description: "Direct to bank account", speed: "1-2 days" },
    { id: "cash", label: "Cash Pickup", icon: "💵", description: "Pick up at agent", speed: "Same day" },
  ]

  const mobileProviders = [
    { id: "mtn", name: "MTN Mobile Money", logo: "📲" },
    { id: "orange", name: "Orange Money", logo: "🍊" },
  ]

  const [deliveryMethod, setDeliveryMethod] = useState("mobile")
  const [provider, setProvider] = useState("mtn")
  const [recipientName, setRecipientName] = useState(recipient.name)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [saveRecipient, setSaveRecipient] = useState(true)

  const isValid = recipientName.length > 2 && phoneNumber.length >= 9

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Recipient Details</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Sending to {recipient.country}</p>
          </div>
          <span style={{ fontSize: "24px" }}>{recipient.flag}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Delivery Method */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Delivery Method
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {deliveryMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setDeliveryMethod(method.id)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: deliveryMethod === method.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: deliveryMethod === method.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "28px" }}>{method.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {method.label}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{method.description}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      padding: "4px 8px",
                      background: method.speed === "Instant" ? "#F0FDFB" : "#F5F7FA",
                      color: method.speed === "Instant" ? "#00897B" : "#6B7280",
                      fontSize: "10px",
                      fontWeight: "600",
                      borderRadius: "6px",
                    }}
                  >
                    {method.speed}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Money Provider */}
        {deliveryMethod === "mobile" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Mobile Money Provider
            </h3>
            <div style={{ display: "flex", gap: "10px" }}>
              {mobileProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "12px",
                    border: provider === p.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: provider === p.id ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>{p.logo}</span>
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#0A2342" }}>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recipient Information */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Recipient Information
          </h3>

          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "500",
                color: "#6B7280",
                marginBottom: "6px",
              }}
            >
              Full Name (as registered)
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Enter recipient's full name"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "14px",
                color: "#0A2342",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "500",
                color: "#6B7280",
                marginBottom: "6px",
              }}
            >
              {deliveryMethod === "mobile" ? "Mobile Money Number" : "Phone Number"}
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <div
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#0A2342",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{recipient.flag}</span>
                <span>+237</span>
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="6XX XXX XXX"
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "14px",
                  color: "#0A2342",
                }}
              />
            </div>
          </div>
        </div>

        {/* Save Recipient */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px 16px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
              Save this recipient
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Send faster next time</p>
          </div>
          <button
            onClick={() => setSaveRecipient(!saveRecipient)}
            style={{
              width: "48px",
              height: "28px",
              borderRadius: "14px",
              border: "none",
              background: saveRecipient ? "#00C6AE" : "#E5E7EB",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "#FFFFFF",
                position: "absolute",
                top: "3px",
                left: saveRecipient ? "23px" : "3px",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
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
            console.log("Continue with", { recipientName, phoneNumber, deliveryMethod, provider, saveRecipient })
          }
          disabled={!isValid}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isValid ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: isValid ? "#FFFFFF" : "#9CA3AF",
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
