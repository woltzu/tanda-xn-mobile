"use client"

import { useState } from "react"

export default function BrazilCPFScreen() {
  const recipient = {
    name: "João Silva",
    phone: "+55 11 9XXXX-XXXX",
  }
  const deliveryMethod = "PIX" // PIX, bank_transfer, cash

  const [cpf, setCpf] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    name: string
    status: string
  } | null>(null)

  // Format CPF as XXX.XXX.XXX-XX
  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }

  const rawCPF = cpf.replace(/\D/g, "")
  const isValidFormat = rawCPF.length === 11

  const handleValidate = async () => {
    setIsValidating(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setValidationResult({
      valid: true,
      name: recipient.name,
      status: "Regular",
    })
    setIsValidating(false)
  }

  const handleBack = () => console.log("Navigate back")
  const handleContinue = () => console.log("Continue with CPF:", rawCPF)

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Brazil Requirement</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>CPF verification for {recipient.name}</p>
          </div>
          <span style={{ fontSize: "28px" }}>🇧🇷</span>
        </div>

        {/* PIX Badge */}
        {deliveryMethod === "PIX" && (
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
            <span style={{ fontSize: "20px" }}>⚡</span>
            <span style={{ fontSize: "12px" }}>CPF is required for PIX instant transfers</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* CPF Input */}
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
            Recipient's CPF
          </label>

          <input
            type="text"
            value={cpf}
            onChange={(e) => {
              setCpf(formatCPF(e.target.value))
              setValidationResult(null)
            }}
            placeholder="000.000.000-00"
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "12px",
              border: validationResult?.valid ? "2px solid #00C6AE" : "1px solid #E5E7EB",
              fontSize: "24px",
              fontWeight: "600",
              color: "#0A2342",
              textAlign: "center",
              letterSpacing: "2px",
              fontFamily: "monospace",
              boxSizing: "border-box",
              background: validationResult?.valid ? "#F0FDFB" : "#FFFFFF",
            }}
          />

          {/* Progress indicator */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "4px",
              marginTop: "12px",
            }}
          >
            {[...Array(11)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: "20px",
                  height: "6px",
                  borderRadius: "3px",
                  background: i < rawCPF.length ? "#00C6AE" : "#E5E7EB",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </div>

          <p
            style={{
              margin: "10px 0 0 0",
              fontSize: "12px",
              color: "#6B7280",
              textAlign: "center",
            }}
          >
            {rawCPF.length}/11 digits
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
              {isValidating ? "Validating with Receita Federal..." : "Validate CPF"}
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
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#00897B" }}>CPF Verified</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>
                  Status: {validationResult.status}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* What is CPF */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>What is CPF?</h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}>
            CPF (Cadastro de Pessoas Físicas) is Brazil's 11-digit individual taxpayer registry identification. It's
            required by the Brazilian Central Bank for all financial transactions.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "💳", text: "Check recipient's bank card or statement" },
              { icon: "📱", text: "Ask them to check their banking app" },
              { icon: "📄", text: "Available on official documents (RG, CNH)" },
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
                <span style={{ fontSize: "18px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PIX Benefits */}
        {deliveryMethod === "PIX" && (
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#00897B" }}>
              ⚡ PIX Benefits
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                "Instant transfer - arrives in seconds",
                "Available 24/7, including weekends",
                "Lower fees than traditional bank transfers",
                "Direct to recipient's bank account",
              ].map((benefit, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontSize: "12px", color: "#065F46" }}>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
            CPF is encrypted and used only for this transfer
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
          Continue
        </button>
      </div>
    </div>
  )
}
