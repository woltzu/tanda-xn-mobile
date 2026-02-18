"use client"

import { useState } from "react"

export default function PhilippinesIDScreen() {
  const recipient = {
    name: "Maria Santos",
    phone: "+63 9XX XXX XXXX",
  }
  const acceptedIds = [
    { id: "passport", name: "Philippine Passport", icon: "🛂", primary: true },
    { id: "umid", name: "UMID", icon: "🆔", description: "Unified Multi-Purpose ID" },
    { id: "drivers", name: "Driver's License", icon: "🪪", description: "LTO Issued" },
    { id: "sss", name: "SSS ID", icon: "💳", description: "Social Security System" },
    { id: "philhealth", name: "PhilHealth ID", icon: "🏥" },
    { id: "postal", name: "Postal ID", icon: "📮" },
    { id: "voters", name: "Voter's ID", icon: "🗳️" },
  ]

  const [selectedIdType, setSelectedIdType] = useState<string | null>(null)
  const [idNumber, setIdNumber] = useState("")
  const [expiryDate, setExpiryDate] = useState("")

  const isValid = selectedIdType && idNumber.length >= 8

  const handleBack = () => console.log("Navigate back")
  const handleContinue = () => console.log("Continue with ID:", { selectedIdType, idNumber, expiryDate })

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Philippines Requirement</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Recipient ID for {recipient.name}</p>
          </div>
          <span style={{ fontSize: "28px" }}>🇵🇭</span>
        </div>

        {/* Info Banner */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span style={{ fontSize: "12px" }}>BSP requires valid ID for cash pickup and bank deposits</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* ID Type Selection */}
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
            Select ID Type
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {acceptedIds.map((id) => (
              <button
                key={id.id}
                onClick={() => setSelectedIdType(id.id)}
                style={{
                  padding: "12px",
                  background: selectedIdType === id.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                  border: selectedIdType === id.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "24px" }}>{id.icon}</span>
                <p
                  style={{
                    margin: "6px 0 0 0",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: selectedIdType === id.id ? "#00897B" : "#0A2342",
                  }}
                >
                  {id.name}
                </p>
                {id.description && (
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: "10px",
                      color: "#6B7280",
                    }}
                  >
                    {id.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ID Details */}
        {selectedIdType && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>ID Details</h3>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                ID Number
              </label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                placeholder="Enter ID number"
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "16px",
                  fontFamily: "monospace",
                  letterSpacing: "2px",
                  color: "#0A2342",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                Expiry Date (if applicable)
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="MM/YYYY"
                maxLength={7}
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
              <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                Leave blank if ID doesn't have an expiry date
              </p>
            </div>
          </div>
        )}

        {/* Important Notes */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>📋 Important</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              "Recipient must present this ID when picking up money",
              "Name on ID must match the recipient name exactly",
              "ID must not be expired",
            ].map((note, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#D97706" }} />
                <span style={{ fontSize: "12px", color: "#B45309" }}>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginTop: "20px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>
            ID details are encrypted and shared only with authorized partners
          </p>
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
          onClick={handleContinue}
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
