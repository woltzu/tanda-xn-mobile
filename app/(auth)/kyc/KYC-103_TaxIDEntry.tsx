"use client"

import type React from "react"

import { useState } from "react"

export default function TaxIDEntry() {
  const [type, setType] = useState<"ssn" | "itin">("ssn")
  const [taxId, setTaxId] = useState("")
  const [confirmTaxId, setConfirmTaxId] = useState("")
  const [showTaxId, setShowTaxId] = useState(false)
  const [errors, setErrors] = useState<{ taxId?: string; confirm?: string }>({})

  const interestAmount = 47.83
  const isSSN = type === "ssn"

  // Format tax ID as user types
  const formatTaxId = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9)
    if (digits.length <= 3) return digits
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }

  const handleTaxIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTaxId(e.target.value)
    setTaxId(formatted)
    if (errors.taxId) setErrors({ ...errors, taxId: undefined })
  }

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTaxId(e.target.value)
    setConfirmTaxId(formatted)
    if (errors.confirm) setErrors({ ...errors, confirm: undefined })
  }

  const validate = () => {
    const newErrors: { taxId?: string; confirm?: string } = {}
    const digits = taxId.replace(/\D/g, "")

    // Check length
    if (digits.length !== 9) {
      newErrors.taxId = `Please enter a valid 9-digit ${isSSN ? "SSN" : "ITIN"}`
    }

    // ITIN must start with 9
    if (!isSSN && digits.length === 9 && digits[0] !== "9") {
      newErrors.taxId = "ITIN must start with 9"
    }

    // SSN cannot start with 9 (those are ITINs)
    if (isSSN && digits.length === 9 && digits[0] === "9") {
      newErrors.taxId = "SSN cannot start with 9. Did you mean ITIN?"
    }

    // Check match
    if (taxId !== confirmTaxId) {
      newErrors.confirm = "Numbers don't match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      console.log("Submitted:", taxId.replace(/\D/g, ""))
    }
  }

  const isValid = taxId.replace(/\D/g, "").length === 9 && taxId === confirmTaxId

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Enter Your {isSSN ? "SSN" : "ITIN"}</h1>
        </div>

        {/* Type Toggle */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "10px",
            padding: "4px",
          }}
        >
          <button
            onClick={() => setType("ssn")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: isSSN ? "#FFFFFF" : "transparent",
              color: isSSN ? "#0A2342" : "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>🇺🇸</span> SSN
          </button>
          <button
            onClick={() => setType("itin")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: !isSSN ? "#FFFFFF" : "transparent",
              color: !isSSN ? "#0A2342" : "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>📋</span> ITIN
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px" }}>
        {/* Context Card */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            💰
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#065F46" }}>
              Unlocking ${interestAmount.toFixed(2)}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#047857" }}>
              Almost there! Just enter your {isSSN ? "SSN" : "ITIN"}
            </p>
          </div>
        </div>

        {/* Tax ID Input */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "8px",
            }}
          >
            {isSSN ? "Social Security Number" : "Individual Taxpayer Identification Number"}
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showTaxId ? "text" : "password"}
              value={taxId}
              onChange={handleTaxIdChange}
              placeholder={isSSN ? "XXX-XX-XXXX" : "9XX-XX-XXXX"}
              style={{
                width: "100%",
                padding: "16px",
                paddingRight: "50px",
                borderRadius: "12px",
                border: errors.taxId ? "2px solid #EF4444" : "1px solid #E5E7EB",
                fontSize: "18px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <button
              onClick={() => setShowTaxId(!showTaxId)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              {showTaxId ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {errors.taxId && <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.taxId}</p>}
        </div>

        {/* Confirm Tax ID */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "8px",
            }}
          >
            Confirm {isSSN ? "SSN" : "ITIN"}
          </label>
          <input
            type={showTaxId ? "text" : "password"}
            value={confirmTaxId}
            onChange={handleConfirmChange}
            placeholder={isSSN ? "XXX-XX-XXXX" : "9XX-XX-XXXX"}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: errors.confirm
                ? "2px solid #EF4444"
                : taxId && confirmTaxId && taxId === confirmTaxId
                  ? "2px solid #059669"
                  : "1px solid #E5E7EB",
              fontSize: "18px",
              fontFamily: "monospace",
              letterSpacing: "2px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          {errors.confirm && (
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.confirm}</p>
          )}
          {taxId && confirmTaxId && taxId === confirmTaxId && !errors.confirm && (
            <p
              style={{
                margin: "6px 0 0 0",
                fontSize: "12px",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Numbers match!
            </p>
          )}
        </div>

        {/* ITIN Hint */}
        {!isSSN && (
          <div
            style={{
              background: "#EFF6FF",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "14px" }}>💡</span>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#1E40AF", lineHeight: 1.5 }}>
                <strong>ITIN format:</strong> Always starts with <strong>9</strong> and follows the pattern 9XX-XX-XXXX
              </p>
            </div>
          </div>
        )}

        {/* Privacy & Security */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            How we protect your information
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "🔐", text: "Encrypted with bank-level security (AES-256)" },
              { icon: "📋", text: "Used only for required IRS tax reporting" },
              { icon: "🚫", text: "Never sold or shared with third parties" },
              {
                icon: "🛡️",
                text: isSSN ? "Protected by federal privacy laws" : "IRS cannot share with immigration (Section 6103)",
              },
            ].map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", color: "#4B5563" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION */}
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
          onClick={handleSubmit}
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
          Verify & Unlock Interest
        </button>
      </div>
    </div>
  )
}
