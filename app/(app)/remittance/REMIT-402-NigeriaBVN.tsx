"use client"

import { useState } from "react"

export default function NigeriaBVNScreen() {
  const recipient = {
    name: "David Okonkwo",
    phone: "+234 8XX XXX XXX",
  }

  const [bvn, setBvn] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; name: string; bankName: string } | null>(
    null,
  )
  const [consentGiven, setConsentGiven] = useState(false)

  const isValidFormat = bvn.length === 11 && /^\d+$/.test(bvn)

  const handleValidate = async () => {
    setIsValidating(true)
    // Simulate BVN validation
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setValidationResult({
      valid: true,
      name: recipient.name,
      bankName: "First Bank of Nigeria",
    })
    setIsValidating(false)
  }

  const handleBack = () => console.log("Navigate back")
  const handleWhyNeeded = () => console.log("Show why BVN is needed")
  const handleContinue = () => console.log("Continue with BVN:", bvn)

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Nigeria Requirement</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>BVN verification for {recipient.name}</p>
          </div>
          <span style={{ fontSize: "28px" }}>🇳🇬</span>
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
          <span style={{ fontSize: "12px", flex: 1 }}>
            Nigerian regulations require recipient's BVN for all transfers
          </span>
          <button
            onClick={handleWhyNeeded}
            style={{
              padding: "4px 10px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: "6px",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Why?
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* BVN Input */}
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
            Recipient's BVN
          </label>

          <input
            type="text"
            value={bvn}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 11)
              setBvn(value)
              setValidationResult(null)
            }}
            placeholder="Enter 11-digit BVN"
            maxLength={11}
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
            }}
          />

          {/* Character Count */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "8px",
            }}
          >
            <span style={{ fontSize: "12px", color: "#6B7280" }}>{bvn.length}/11 digits</span>
            {isValidFormat && !validationResult && (
              <button
                onClick={handleValidate}
                disabled={isValidating}
                style={{
                  padding: "4px 12px",
                  background: "#00C6AE",
                  border: "none",
                  borderRadius: "6px",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {isValidating ? "Validating..." : "Validate"}
              </button>
            )}
          </div>

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
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#00897B" }}>BVN Verified</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>
                  Linked to {validationResult.bankName}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* What is BVN */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>What is BVN?</h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}>
            The Bank Verification Number is an 11-digit identifier issued by the Central Bank of Nigeria. It's linked to
            your recipient's bank account and biometric data.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              "Ask your recipient to check their bank app",
              "They can also dial *565*0# on their phone",
              "Or visit any Nigerian bank branch",
            ].map((tip, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#0A2342",
                  }}
                >
                  {idx + 1}
                </div>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Consent */}
        <button
          onClick={() => setConsentGiven(!consentGiven)}
          style={{
            width: "100%",
            padding: "14px 16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              border: consentGiven ? "none" : "2px solid #E5E7EB",
              background: consentGiven ? "#00C6AE" : "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            {consentGiven && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            I confirm that I have the recipient's consent to provide their BVN for this transfer, in compliance with
            Nigerian data protection regulations.
          </span>
        </button>

        {/* Security Note */}
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
            BVN is encrypted and used only for this transfer
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
          disabled={!validationResult?.valid || !consentGiven}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: validationResult?.valid && consentGiven ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: validationResult?.valid && consentGiven ? "#FFFFFF" : "#9CA3AF",
            cursor: validationResult?.valid && consentGiven ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
