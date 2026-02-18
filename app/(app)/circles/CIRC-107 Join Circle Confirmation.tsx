"use client"

import { useState } from "react"

export default function JoinCircleConfirmationScreen() {
  const [agreedToRules, setAgreedToRules] = useState(false)
  const [agreedToCommitment, setAgreedToCommitment] = useState(false)

  const circle = {
    id: "circle_456",
    name: "Diaspora Family Fund",
    type: "family",
    emoji: "👨‍👩‍👧‍👦",
    contribution: 200,
    frequency: "monthly",
    totalMembers: 12,
    currentMembers: 8,
    potAmount: 2400,
    startDate: "Jan 20, 2025",
    estimatedPayoutPosition: 9,
    elder: {
      name: "Grace M.",
      avatar: "G",
      xnScore: 92,
    },
    gracePeriod: 2,
    latePenalty: 10,
  }

  const userXnScore = 72
  const canJoin = agreedToRules && agreedToCommitment

  const getFrequencyLabel = () => {
    switch (circle.frequency) {
      case "daily":
        return "day"
      case "weekly":
        return "week"
      case "biweekly":
        return "2 weeks"
      case "monthly":
        return "month"
      default:
        return circle.frequency
    }
  }

  const getTotalCommitment = () => {
    return circle.contribution * circle.totalMembers
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
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Join Circle</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Review and confirm</p>
          </div>
        </div>

        {/* Circle Summary Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontSize: "32px",
            }}
          >
            {circle.emoji}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "700" }}>{circle.name}</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", opacity: 0.8 }}>
            {circle.currentMembers}/{circle.totalMembers} members • Starts {circle.startDate}
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
            }}
          >
            <div
              style={{
                flex: 1,
                background: "rgba(0,198,174,0.2)",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>${circle.contribution}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>per {getFrequencyLabel()}</p>
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>${circle.potAmount.toLocaleString()}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>payout amount</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Your Position */}
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
            Your Estimated Position
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "14px",
              background: "#F0FDFB",
              borderRadius: "12px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#00C6AE",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "18px",
              }}
            >
              #{circle.estimatedPayoutPosition}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Position {circle.estimatedPayoutPosition} of {circle.totalMembers}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Based on your XnScore of {userXnScore}
              </p>
            </div>
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
            💡 Higher XnScore = earlier payout position
          </p>
        </div>

        {/* Your Commitment */}
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
            Your Commitment
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Contribution per cycle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>${circle.contribution}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Total commitment</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                ${getTotalCommitment().toLocaleString()}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Grace period</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{circle.gracePeriod} days</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#FEF3C7",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#92400E" }}>Late payment penalty</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#D97706" }}>{circle.latePenalty}%</span>
            </div>
          </div>
        </div>

        {/* Circle Elder */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Circle Elder</h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#0A2342",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "600",
                fontSize: "16px",
              }}
            >
              {circle.elder.avatar}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{circle.elder.name}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Oversees this circle</p>
            </div>
            <span
              style={{
                background: "#F0FDFB",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#00C6AE",
              }}
            >
              ⭐ {circle.elder.xnScore}
            </span>
          </div>
        </div>

        {/* Agreements */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Confirm Your Commitment
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={() => setAgreedToRules(!agreedToRules)}
              style={{
                width: "100%",
                padding: "14px",
                background: agreedToRules ? "#F0FDFB" : "#F5F7FA",
                borderRadius: "10px",
                border: agreedToRules ? "2px solid #00C6AE" : "1px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  border: agreedToRules ? "none" : "2px solid #D1D5DB",
                  background: agreedToRules ? "#00C6AE" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              >
                {agreedToRules && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: "13px", color: "#0A2342", lineHeight: 1.4 }}>
                I have read and agree to the{" "}
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log("View rules")
                  }}
                  style={{ color: "#00C6AE", fontWeight: "600", textDecoration: "underline" }}
                >
                  circle rules
                </span>
                , including payment obligations and penalties
              </span>
            </button>

            <button
              onClick={() => setAgreedToCommitment(!agreedToCommitment)}
              style={{
                width: "100%",
                padding: "14px",
                background: agreedToCommitment ? "#F0FDFB" : "#F5F7FA",
                borderRadius: "10px",
                border: agreedToCommitment ? "2px solid #00C6AE" : "1px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  border: agreedToCommitment ? "none" : "2px solid #D1D5DB",
                  background: agreedToCommitment ? "#00C6AE" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              >
                {agreedToCommitment && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: "13px", color: "#0A2342", lineHeight: 1.4 }}>
                I commit to making ${circle.contribution} contributions every {getFrequencyLabel()} for the full
                duration of this circle
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Join Button */}
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
          onClick={() => console.log("Join circle")}
          disabled={!canJoin}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canJoin ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canJoin ? "#FFFFFF" : "#9CA3AF",
            cursor: canJoin ? "pointer" : "not-allowed",
            boxShadow: canJoin ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
          }}
        >
          Join {circle.name}
        </button>
      </div>
    </div>
  )
}
