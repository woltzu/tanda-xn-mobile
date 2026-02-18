"use client"

import { useState } from "react"

export default function ReportMemberScreen() {
  const member = {
    id: "user_789",
    name: "Samuel Osei",
    avatar: "S",
    xnScore: 75,
  }

  const circle = {
    name: "Diaspora Family Fund",
    elder: {
      name: "Grace M.",
      avatar: "G",
    },
  }

  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [details, setDetails] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reasons = [
    {
      id: "missed_payment",
      emoji: "💸",
      title: "Missed Payment",
      description: "Member hasn't made their contribution",
    },
    {
      id: "late_payment",
      emoji: "⏰",
      title: "Repeated Late Payments",
      description: "Consistently pays after the due date",
    },
    {
      id: "harassment",
      emoji: "🚫",
      title: "Harassment or Abuse",
      description: "Inappropriate behavior in chat or meetings",
    },
    {
      id: "fraud",
      emoji: "⚠️",
      title: "Suspected Fraud",
      description: "Suspicious activity or false information",
    },
    {
      id: "unresponsive",
      emoji: "📵",
      title: "Unresponsive",
      description: "Not responding to messages or calls",
    },
    {
      id: "other",
      emoji: "📝",
      title: "Other Issue",
      description: "Something else not listed above",
    },
  ]

  const canSubmit = selectedReason && details.length >= 20

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    console.log("Report submitted:", { memberId: member.id, reason: selectedReason, details })
  }

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Report Member</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Member Being Reported */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280", fontWeight: "600" }}>REPORTING</p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#0A2342",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "600",
                fontSize: "18px",
              }}
            >
              {member.avatar}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{circle.name}</p>
            </div>
            <span
              style={{
                background: "#F5F7FA",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#6B7280",
              }}
            >
              ⭐ {member.xnScore}
            </span>
          </div>
        </div>

        {/* Report to Elder Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#00C6AE",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            {circle.elder.avatar}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
              Report goes to: {circle.elder.name}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
              Circle Elder will review within 48 hours
            </p>
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
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What's the issue?
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {reasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedReason === reason.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedReason === reason.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "24px" }}>{reason.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{reason.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{reason.description}</p>
                </div>
                {selectedReason === reason.id && (
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Describe what happened
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Please provide specific details including dates if possible
          </p>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Explain the issue in detail..."
            maxLength={500}
            style={{
              width: "100%",
              minHeight: "120px",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: details.length < 20 ? "#D97706" : "#6B7280",
              }}
            >
              {details.length < 20 ? `${20 - details.length} more characters needed` : "✓ Enough detail"}
            </span>
            <span style={{ fontSize: "11px", color: "#6B7280" }}>{details.length}/500</span>
          </div>
        </div>

        {/* Warning */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D97706"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>Please be truthful</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#B45309", lineHeight: 1.4 }}>
              False reports may negatively impact your XnScore. Reports are reviewed by the Circle Elder.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
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
          disabled={!canSubmit || isSubmitting}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canSubmit && !isSubmitting ? "#DC2626" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canSubmit && !isSubmitting ? "#FFFFFF" : "#9CA3AF",
            cursor: canSubmit && !isSubmitting ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isSubmitting ? (
            <>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid #FFFFFF",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Submitting...
            </>
          ) : (
            "Submit Report"
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
