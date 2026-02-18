"use client"

import { useState } from "react"

export default function IndiaPANScreen() {
  const recipient = {
    name: "Rajesh Kumar",
    phone: "+91 98XXX XXXXX",
  }
  const transferAmount = 800 // USD
  const threshold = 600 // USD

  const [pan, setPan] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; name: string; status: string } | null>(
    null,
  )

  // PAN format: 5 letters + 4 digits + 1 letter
  const formatPAN = (value: string) => {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10)
  }

  const isValidFormat = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)

  const handleValidate = async () => {
    setIsValidating(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setValidationResult({
      valid: true,
      name: recipient.name,
      status: "Active",
    })
    setIsValidating(false)
  }

  const handleBack = () => console.log("Navigate back")
  const handleContinue = () => console.log("Continue with PAN:", pan)
  const handleSkipWithLowerAmount = () => console.log("Reduce to $600")

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>India Requirement</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>PAN verification for {recipient.name}</p>
          </div>
          <span style={{ fontSize: "28px" }}>🇮🇳</span>
        </div>

        {/* Amount Notice */}
        <div
          style={{
            background: "rgba(249,115,22,0.2)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: "12px", flex: 1 }}>PAN is required for transfers over ${threshold} to India</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Transfer Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            💸
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>You're sending</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              ${transferAmount.toLocaleString()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>Threshold</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#F97316" }}>${threshold}</p>
          </div>
        </div>

        {/* PAN Input */}
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
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "8px",
            }}
          >
            Recipient's PAN Card Number
          </label>

          <input
            type="text"
            value={pan}
            onChange={(e) => {
              setPan(formatPAN(e.target.value))
              setValidationResult(null)
            }}
            placeholder="AAAAA0000A"
            maxLength={10}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: validationResult?.valid ? "2px solid #00C6AE" : "1px solid #E5E7EB",
              fontSize: "20px",
              fontWeight: "600",
              color: "#0A2342",
              textAlign: "center",
              letterSpacing: "4px",
              fontFamily: "monospace",
              boxSizing: "border-box",
              background: validationResult?.valid ? "#F0FDFB" : "#FFFFFF",
              textTransform: "uppercase",
            }}
          />

          {/* Format Guide */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "4px",
              marginTop: "10px",
            }}
          >
            {["A", "A", "A", "A", "A", "0", "0", "0", "0", "A"].map((char, idx) => (
              <div
                key={idx}
                style={{
                  width: "24px",
                  height: "28px",
                  borderRadius: "4px",
                  background: pan[idx] ? "#00C6AE" : "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: "600",
                  color: pan[idx] ? "#FFFFFF" : "#9CA3AF",
                }}
              >
                {pan[idx] || char}
              </div>
            ))}
          </div>

          <p
            style={{
              margin: "10px 0 0 0",
              fontSize: "11px",
              color: "#6B7280",
              textAlign: "center",
            }}
          >
            Format: 5 letters + 4 digits + 1 letter
          </p>

          {/* Validate Button */}
          {isValidFormat && !validationResult && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              style={{
                width: "100%",
                marginTop: "16px",
                padding: "12px",
                background: "#00C6AE",
                border: "none",
                borderRadius: "10px",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {isValidating ? "Validating with Income Tax..." : "Validate PAN"}
            </button>
          )}

          {/* Validation Result */}
          {validationResult?.valid && (
            <div
              style={{
                marginTop: "16px",
                padding: "14px",
                background: "#F0FDFB",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#00897B" }}>PAN Verified</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>
                  Status: {validationResult.status}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* How to Find PAN */}
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
            How to find PAN
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "💳", text: "Check the PAN card itself" },
              { icon: "📱", text: "Ask recipient to check their Income Tax app" },
              { icon: "📄", text: "It's on Form 16, tax returns, or bank statements" },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alternative Option */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
            💡 Don't have recipient's PAN?
          </h4>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#B45309", lineHeight: 1.5 }}>
            You can send up to ${threshold} without PAN verification. Would you like to reduce your transfer amount?
          </p>
          <button
            onClick={handleSkipWithLowerAmount}
            style={{
              padding: "10px 16px",
              background: "#D97706",
              border: "none",
              borderRadius: "8px",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Send ${threshold} instead
          </button>
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
          disabled={!validationResult?.valid}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: validationResult?.valid ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: validationResult?.valid ? "#FFFFFF" : "#9CA3AF",
            cursor: validationResult?.valid ? "pointer" : "not-allowed",
          }}
        >
          Continue with PAN
        </button>
      </div>
    </div>
  )
}
