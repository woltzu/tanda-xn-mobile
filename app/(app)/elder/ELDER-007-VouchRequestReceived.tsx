"use client"

import { useState } from "react"

export default function VouchRequestReceivedScreen() {
  const [vouchStrength, setVouchStrength] = useState(15)
  const [reason, setReason] = useState("")
  const [privateFeedback, setPrivateFeedback] = useState("")
  const [showRiskInfo, setShowRiskInfo] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const request = {
    id: "vr-001",
    member: {
      name: "Alex Okonkwo",
      avatar: "A",
      xnScore: 685,
      xnScoreTrend: "+45",
      memberSince: "8 months",
      circlesCompleted: 4,
      defaultRate: 0,
    },
    circle: {
      name: "Lagos Traders Monthly",
      contribution: 200,
      frequency: "monthly",
      members: 8,
    },
    sharedHistory: {
      circlesTogether: 3,
      monthsKnown: 12,
      interactions: 24,
      previousVouch: null,
    },
    message:
      "Hi Elder Franck, I'm applying to join Lagos Traders Monthly but need a vouch to meet the XnScore requirement. We've been in 3 circles together and I've never missed a payment. Would you consider vouching for me?",
    requestedAt: "2 hours ago",
  }

  const elderTier = "Senior"
  const maxVouchPoints = elderTier === "Grand" ? 50 : elderTier === "Senior" ? 25 : 10
  const minChars = 50

  const vouchLevels = [
    { min: 5, max: 10, label: "Light", desc: "Basic endorsement" },
    { min: 11, max: 25, label: "Medium", desc: "Strong confidence" },
    { min: 26, max: 50, label: "Strong", desc: "Full trust (Grand Elder only)" },
  ]

  const getCurrentLevel = () => {
    if (vouchStrength <= 10) return vouchLevels[0]
    if (vouchStrength <= 25) return vouchLevels[1]
    return vouchLevels[2]
  }

  const handleGrant = () => {
    if (reason.length < minChars) return
    setIsProcessing(true)
    setTimeout(() => {
      console.log("Vouch granted", {
        requestId: request.id,
        memberId: request.member.name,
        points: vouchStrength,
        reason,
        privateFeedback,
      })
      setIsProcessing(false)
    }, 1500)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Vouch Request</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              {request.requestedAt}
            </p>
          </div>
          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              padding: "6px 12px",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "600" }}>👑 {elderTier} Elder</span>
          </div>
        </div>

        {/* Notification Banner */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: "700",
              color: "#FFFFFF",
            }}
          >
            {request.member.avatar}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>{request.member.name} requests your vouch</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", opacity: 0.8 }}>For circle: {request.circle.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Member Profile Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              {request.member.avatar}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                {request.member.name}
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                Member for {request.member.memberSince}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
                {request.member.xnScore}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#00C6AE", fontWeight: "600" }}>
                {request.member.xnScoreTrend} ↑
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                {request.member.circlesCompleted}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Circles Done</p>
            </div>
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                {request.member.defaultRate}%
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Default Rate</p>
            </div>
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                {request.sharedHistory.circlesTogether}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Together</p>
            </div>
          </div>
        </div>

        {/* Shared History Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
            📜 Your Shared History
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              {
                label: "Circles together",
                value: `${request.sharedHistory.circlesTogether} circles`,
                icon: "⭕",
              },
              { label: "Known for", value: `${request.sharedHistory.monthsKnown} months`, icon: "📅" },
              {
                label: "Interactions",
                value: `${request.sharedHistory.interactions} transactions`,
                icon: "🤝",
              },
              {
                label: "Previous vouch",
                value: request.sharedHistory.previousVouch || "None",
                icon: "✅",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: idx < 3 ? "1px solid #F5F7FA" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{item.icon}</span>
                  <span style={{ fontSize: "14px", color: "#6B7280" }}>{item.label}</span>
                </div>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Member's Message */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
            💬 Their Message
          </h4>
          <div
            style={{
              background: "#F5F7FA",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: "#0A2342",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              "{request.message}"
            </p>
          </div>
        </div>

        {/* Circle Context */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
            🎯 Circle They Want to Join
          </h4>
          <div
            style={{
              background: "#F5F7FA",
              borderRadius: "12px",
              padding: "14px",
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
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "22px" }}>👥</span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{request.circle.name}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                ${request.circle.contribution}/{request.circle.frequency} • {request.circle.members} members
              </p>
            </div>
          </div>
        </div>

        {/* Vouch Strength Slider */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>⚡ Vouch Strength</h4>
            <span
              style={{
                background: "#00C6AE",
                color: "#FFFFFF",
                padding: "4px 12px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              +{vouchStrength} pts
            </span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min="5"
            max={maxVouchPoints}
            value={vouchStrength}
            onChange={(e) => setVouchStrength(Number.parseInt(e.target.value))}
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "4px",
              background: `linear-gradient(to right, #00C6AE 0%, #00C6AE ${
                ((vouchStrength - 5) / (maxVouchPoints - 5)) * 100
              }%, #E5E7EB ${((vouchStrength - 5) / (maxVouchPoints - 5)) * 100}%, #E5E7EB 100%)`,
              outline: "none",
              WebkitAppearance: "none",
              marginBottom: "12px",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Light (5)</span>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Max ({maxVouchPoints})</span>
          </div>

          {/* Current Level */}
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "10px",
              padding: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "20px" }}>{vouchStrength <= 10 ? "🌱" : vouchStrength <= 25 ? "🌿" : "🌳"}</span>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {getCurrentLevel().label} Vouch
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{getCurrentLevel().desc}</p>
            </div>
          </div>
        </div>

        {/* Reason for Vouching (Required) */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              ✍️ Reason for Vouching <span style={{ color: "#DC2626" }}>*</span>
            </h4>
            <span
              style={{
                fontSize: "12px",
                color: reason.length >= minChars ? "#00C6AE" : "#6B7280",
              }}
            >
              {reason.length}/{minChars} min
            </span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="I vouch for this member because... (Minimum 50 characters)"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
              minHeight: "100px",
              resize: "none",
            }}
          />
        </div>

        {/* Private Feedback (Optional) */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
            🔒 Private Feedback <span style={{ fontWeight: "400", color: "#6B7280" }}>(optional)</span>
          </h4>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Only visible to the member. Use to share helpful advice.
          </p>
          <textarea
            value={privateFeedback}
            onChange={(e) => setPrivateFeedback(e.target.value)}
            placeholder="Any private guidance for this member..."
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
              minHeight: "80px",
              resize: "none",
            }}
          />
        </div>

        {/* Risk Disclaimer */}
        <button
          onClick={() => setShowRiskInfo(!showRiskInfo)}
          style={{
            width: "100%",
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px",
            border: "1px solid #F59E0B",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
              Your Honor Score is at risk
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#92400E" }}>
              Tap to understand the consequences
            </p>
          </div>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#92400E"
            strokeWidth="2"
            style={{ transform: showRiskInfo ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showRiskInfo && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "0 0 14px 14px",
              padding: "16px",
              marginTop: "-10px",
              border: "1px solid #E5E7EB",
              borderTop: "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px" }}>📉</span>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>
                  If they default: <strong style={{ color: "#DC2626" }}>-15 Honor Score</strong>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px" }}>👀</span>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>
                  Vouch is <strong>public</strong> on your Elder profile
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px" }}>⏰</span>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>
                  90-day cooldown before vouching same member again
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTAs */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => console.log("Decline")}
            style={{
              flex: 1,
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "15px",
              fontWeight: "600",
              color: "#6B7280",
              cursor: "pointer",
            }}
          >
            Decline Politely
          </button>
          <button
            onClick={handleGrant}
            disabled={reason.length < minChars || isProcessing}
            style={{
              flex: 2,
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: reason.length >= minChars ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E5E7EB",
              fontSize: "15px",
              fontWeight: "700",
              color: reason.length >= minChars ? "#FFFFFF" : "#9CA3AF",
              cursor: reason.length >= minChars && !isProcessing ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isProcessing ? (
              <>
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#FFFFFF",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Granting...
              </>
            ) : (
              <>Grant Vouch (+{vouchStrength})</>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
