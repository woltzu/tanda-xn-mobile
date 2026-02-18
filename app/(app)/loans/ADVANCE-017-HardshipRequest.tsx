"use client"

import { useState } from "react"

export default function HardshipRequestScreen() {
  const advance = {
    id: "ADV-2025-0120-001",
    amountDue: 315,
    withholdingDate: "Feb 15, 2025",
    daysUntil: 10,
  }

  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [additionalInfo, setAdditionalInfo] = useState("")

  const hardshipOptions = [
    {
      id: "defer",
      icon: "📅",
      title: "Defer Payment",
      description: "Push withholding to your next payout cycle",
      detail: "Extends by 1 payout cycle (typically 2-4 weeks)",
    },
    {
      id: "reduce",
      icon: "📉",
      title: "Reduced Payment",
      description: "Split across multiple payouts",
      detail: "Pay 50% now, 50% next payout",
    },
    {
      id: "extend",
      icon: "⏳",
      title: "Extend Term",
      description: "Smaller amounts over longer period",
      detail: "Spread repayment across 2-3 payouts",
    },
  ]

  const hardshipReasons = [
    { id: "job_loss", icon: "💼", label: "Job loss or reduced income" },
    { id: "medical", icon: "🏥", label: "Medical emergency or illness" },
    { id: "family", icon: "👨‍👩‍👧", label: "Family emergency" },
    { id: "disaster", icon: "🌪️", label: "Natural disaster" },
    { id: "other", icon: "📝", label: "Other circumstances" },
  ]

  const canSubmit = selectedOption && selectedReason

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Hardship Assistance</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>We're here to help</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Empathy Message */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>💚</span>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>
                We understand life happens
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#047857", lineHeight: 1.5 }}>
                If you're experiencing financial difficulty, we want to work with you. Your request will be reviewed
                within 24 hours, and your XnScore won't be affected during review.
              </p>
            </div>
          </div>
        </div>

        {/* Current Advance */}
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
            Current Advance
          </h3>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Amount Due</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                ${advance.amountDue}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Due Date</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#D97706" }}>
                {advance.withholdingDate}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{advance.daysUntil} days</p>
            </div>
          </div>
        </div>

        {/* Hardship Options */}
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
            What type of assistance do you need?
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {hardshipOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedOption === option.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedOption === option.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "24px" }}>{option.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{option.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{option.description}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#00C6AE", fontWeight: "500" }}>
                    {option.detail}
                  </p>
                </div>
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: selectedOption === option.id ? "none" : "2px solid #D1D5DB",
                    background: selectedOption === option.id ? "#00C6AE" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {selectedOption === option.id && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Reason Selection */}
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
            What's causing your hardship?
          </label>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {hardshipReasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.id)}
                style={{
                  padding: "10px 14px",
                  background: selectedReason === reason.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "20px",
                  border: selectedReason === reason.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "14px" }}>{reason.icon}</span>
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#0A2342" }}>{reason.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Additional Info */}
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
            Additional details (optional)
          </label>
          <textarea
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Share any additional context that might help us understand your situation..."
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        {/* What to Expect */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            What happens next
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "📨", text: "We'll review your request within 24 hours" },
              { icon: "🛡️", text: "Your XnScore won't be affected during review" },
              { icon: "📱", text: "We'll notify you of our decision via app & email" },
              { icon: "💬", text: "Our support team may reach out for more info" },
            ].map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", color: "#4B5563" }}>{item.text}</span>
              </div>
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
          onClick={() =>
            console.log("Submit hardship request", { option: selectedOption, reason: selectedReason, additionalInfo })
          }
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canSubmit ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canSubmit ? "#FFFFFF" : "#9CA3AF",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          Submit Hardship Request
        </button>
      </div>
    </div>
  )
}
