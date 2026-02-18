"use client"

import { useState } from "react"

export default function SourceOfFundsScreen() {
  const [employment, setEmployment] = useState<string | null>(null)
  const [incomeRange, setIncomeRange] = useState<string | null>(null)
  const [purpose, setPurpose] = useState<string[]>([])
  const [frequency, setFrequency] = useState<string | null>(null)

  const employmentOptions = [
    { id: "employed", label: "Employed", icon: "💼" },
    { id: "self_employed", label: "Self-Employed", icon: "🏢" },
    { id: "retired", label: "Retired", icon: "🏖️" },
    { id: "student", label: "Student", icon: "🎓" },
    { id: "other", label: "Other", icon: "📋" },
  ]

  const incomeOptions = [
    { id: "under_25k", label: "Under $25,000" },
    { id: "25k_50k", label: "$25,000 - $50,000" },
    { id: "50k_100k", label: "$50,000 - $100,000" },
    { id: "100k_200k", label: "$100,000 - $200,000" },
    { id: "over_200k", label: "Over $200,000" },
  ]

  const purposeOptions = [
    { id: "family_support", label: "Family Support", icon: "👨‍👩‍👧‍👦" },
    { id: "education", label: "Education/School Fees", icon: "📚" },
    { id: "medical", label: "Medical Expenses", icon: "🏥" },
    { id: "property", label: "Property/Investment", icon: "🏠" },
    { id: "business", label: "Business", icon: "💼" },
    { id: "gifts", label: "Gifts/Celebrations", icon: "🎁" },
  ]

  const frequencyOptions = [
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Every few months" },
    { id: "occasionally", label: "Occasionally" },
  ]

  const togglePurpose = (id: string) => {
    if (purpose.includes(id)) {
      setPurpose(purpose.filter((p) => p !== id))
    } else {
      setPurpose([...purpose, id])
    }
  }

  const isComplete = employment && incomeRange && purpose.length > 0 && frequency

  const handleBack = () => console.log("Navigate back")
  const handleContinue = () => console.log("Complete verification", { employment, incomeRange, purpose, frequency })

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Quick Questions</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Step 3 of 3 • Takes ~1 minute</p>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            💼
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: "8px" }}>
          {[1, 2, 3].map((step) => (
            <div key={step} style={{ flex: 1 }}>
              <div
                style={{
                  height: "4px",
                  borderRadius: "2px",
                  background: step <= 3 ? "#00C6AE" : "rgba(255,255,255,0.2)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Why We Ask */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "12px 14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "18px" }}>🔒</span>
          <span style={{ fontSize: "12px", color: "#065F46" }}>
            Required by US financial regulations. Your info is encrypted and private.
          </span>
        </div>

        {/* Employment Status */}
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
            Employment Status
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {employmentOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setEmployment(opt.id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "20px",
                  border: employment === opt.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: employment === opt.id ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: employment === opt.id ? "#00897B" : "#6B7280",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Annual Income */}
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
            Annual Income Range
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {incomeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setIncomeRange(opt.id)}
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: incomeRange === opt.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: incomeRange === opt.id ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: incomeRange === opt.id ? "#00897B" : "#0A2342",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {opt.label}
                {incomeRange === opt.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Transfer Purpose */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Purpose of Transfers
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>Select all that apply</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {purposeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => togglePurpose(opt.id)}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: purpose.includes(opt.id) ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: purpose.includes(opt.id) ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: "500",
                  color: purpose.includes(opt.id) ? "#00897B" : "#6B7280",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transfer Frequency */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            How often will you send money?
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {frequencyOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFrequency(opt.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "20px",
                  border: frequency === opt.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: frequency === opt.id ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: frequency === opt.id ? "#00897B" : "#6B7280",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
          disabled={!isComplete}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isComplete ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: isComplete ? "#FFFFFF" : "#9CA3AF",
            cursor: isComplete ? "pointer" : "not-allowed",
          }}
        >
          Complete Verification
        </button>
        <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "#9CA3AF", textAlign: "center" }}>
          Almost there! You're unlocking Trusted Sender status ⭐
        </p>
      </div>
    </div>
  )
}
