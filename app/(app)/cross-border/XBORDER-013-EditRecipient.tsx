"use client"

import { useState } from "react"

export default function EditRecipientScreen() {
  const recipient = {
    id: "r1",
    firstName: "Mama",
    lastName: "Françoise",
    country: "CM",
    countryName: "Cameroon",
    flag: "🇨🇲",
    method: "mobile_money",
    provider: "mtn",
    providerName: "MTN MoMo",
    phone: "+237 699 123 456",
  }

  const providers = [
    { id: "mtn", name: "MTN MoMo" },
    { id: "orange", name: "Orange Money" },
  ]

  const [firstName, setFirstName] = useState(recipient.firstName)
  const [lastName, setLastName] = useState(recipient.lastName)
  const [provider, setProvider] = useState(recipient.provider)
  const [phone, setPhone] = useState(recipient.phone)

  const hasChanges =
    firstName !== recipient.firstName ||
    lastName !== recipient.lastName ||
    provider !== recipient.provider ||
    phone !== recipient.phone
  const canSave = firstName && lastName && provider && phone.length >= 8

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Edit Recipient</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Country (Read-only) */}
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
              fontSize: "12px",
              fontWeight: "600",
              color: "#6B7280",
            }}
          >
            COUNTRY
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
            }}
          >
            <span style={{ fontSize: "24px" }}>{recipient.flag}</span>
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{recipient.countryName}</span>
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "#9CA3AF" }}>Cannot change</span>
          </div>
        </div>

        {/* Name */}
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
            Recipient Name
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                outline: "none",
              }}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Provider */}
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
            Mobile Money Provider
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                style={{
                  padding: "12px 20px",
                  borderRadius: "10px",
                  border: provider === p.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: provider === p.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+237 6XX XXX XXXX"
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

      {/* Save Button */}
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
          disabled={!hasChanges || !canSave}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: hasChanges && canSave ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: hasChanges && canSave ? "#FFFFFF" : "#9CA3AF",
            cursor: hasChanges && canSave ? "pointer" : "not-allowed",
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}
