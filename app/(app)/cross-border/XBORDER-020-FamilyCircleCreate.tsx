"use client"

import { useState } from "react"

export default function FamilyCircleCreateScreen() {
  const [step, setStep] = useState(1)
  const [circleName, setCircleName] = useState("")
  const [beneficiary, setBeneficiary] = useState<any>(null)
  const [goalAmount, setGoalAmount] = useState("400")
  const [frequency, setFrequency] = useState("monthly")
  const [sendDay, setSendDay] = useState("1")

  const savedRecipients = [
    { id: "r1", name: "Mama Françoise", flag: "🇨🇲" },
    { id: "r2", name: "Papa Jean", flag: "🇨🇲" },
  ]

  const frequencies = [
    { id: "weekly", label: "Weekly" },
    { id: "biweekly", label: "Every 2 weeks" },
    { id: "monthly", label: "Monthly" },
  ]

  const canContinue = () => {
    if (step === 1) return circleName.length >= 3 && beneficiary
    if (step === 2) return Number.parseFloat(goalAmount) >= 50
    return false
  }

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1)
    } else {
      // onCreate callback
      console.log("Creating circle:", {
        circleName,
        beneficiary,
        goalAmount: Number.parseFloat(goalAmount),
        frequency,
        sendDay,
      })
    }
  }

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
            onClick={() => (step > 1 ? setStep(step - 1) : null)}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Create Family Circle</h1>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "#00C6AE" }} />
          <div
            style={{
              flex: 1,
              height: "4px",
              borderRadius: "2px",
              background: step >= 2 ? "#00C6AE" : "rgba(255,255,255,0.3)",
            }}
          />
        </div>
        <p style={{ margin: "8px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
          Step {step}: {step === 1 ? "Circle Details" : "Schedule & Amount"}
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {step === 1 ? (
          <>
            {/* Circle Name */}
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
                Circle Name
              </label>
              <input
                type="text"
                value={circleName}
                onChange={(e) => setCircleName(e.target.value)}
                placeholder="e.g., Mama & Papa Support"
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                This name will be visible to all circle members
              </p>
            </div>

            {/* Beneficiary */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
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
                Who receives the money?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {savedRecipients.map((recipient) => (
                  <button
                    key={recipient.id}
                    onClick={() => setBeneficiary(recipient)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "12px",
                      border: beneficiary?.id === recipient.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: beneficiary?.id === recipient.id ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        background: beneficiary?.id === recipient.id ? "#00C6AE" : "#F5F7FA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        color: beneficiary?.id === recipient.id ? "#FFFFFF" : "#0A2342",
                        fontWeight: "600",
                      }}
                    >
                      {recipient.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <span style={{ fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {recipient.name} {recipient.flag}
                    </span>
                    {beneficiary?.id === recipient.id && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#00C6AE"
                        strokeWidth="3"
                        style={{ marginLeft: "auto" }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    /* Navigate to add recipient */
                  }}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "2px dashed #E5E7EB",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span style={{ fontSize: "14px", color: "#6B7280" }}>Add New Recipient</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Monthly Goal */}
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
                Monthly Goal Amount
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                }}
              >
                <span style={{ fontSize: "24px", fontWeight: "600", color: "#0A2342" }}>$</span>
                <input
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  placeholder="400"
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    fontSize: "28px",
                    fontWeight: "700",
                    color: "#0A2342",
                    outline: "none",
                  }}
                />
              </div>
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Split among all circle members each month
              </p>
            </div>

            {/* Frequency */}
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
                How often should the circle send?
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                {frequencies.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFrequency(f.id)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "10px",
                      border: frequency === f.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: frequency === f.id ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#0A2342",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Send Day */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
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
                Day to send each month
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["1", "5", "10", "15", "20", "25", "last"].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSendDay(day)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: sendDay === day ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: sendDay === day ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0A2342",
                    }}
                  >
                    {day === "last"
                      ? "Last day"
                      : `${day}${day === "1" ? "st" : day === "2" ? "nd" : day === "3" ? "rd" : "th"}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {Number.parseFloat(goalAmount) >= 50 && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  background: "#0A2342",
                  borderRadius: "14px",
                }}
              >
                <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                  Circle Summary
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.9)", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: "600" }}>{circleName || "Your circle"}</span> will send{" "}
                  <span style={{ color: "#00C6AE", fontWeight: "600" }}>${goalAmount}</span> {frequency} to{" "}
                  <span style={{ fontWeight: "600" }}>{beneficiary?.name}</span> on the{" "}
                  {sendDay === "last" ? "last day" : `${sendDay}${sendDay === "1" ? "st" : "th"}`} of each month.
                </p>
              </div>
            )}
          </>
        )}
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
          onClick={handleNext}
          disabled={!canContinue()}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canContinue() ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canContinue() ? "#FFFFFF" : "#9CA3AF",
            cursor: canContinue() ? "pointer" : "not-allowed",
          }}
        >
          {step === 2 ? "Create Circle & Invite Members" : "Continue"}
        </button>
      </div>
    </div>
  )
}
