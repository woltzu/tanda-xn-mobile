"use client"

import { useState } from "react"

export default function RequestElderVouchScreen() {
  const targetCircle = {
    name: "Lagos Traders Monthly",
    requiredXnScore: 700,
    memberXnScore: 665,
    gap: 35,
  }

  const availableElders = [
    {
      id: "e1",
      name: "Elder Amara Osei",
      avatar: "A",
      tier: "Senior",
      honorScore: 820,
      sharedCircles: 3,
      monthsKnown: 12,
      lastCircle: "Ghana Monthly",
      maxVouchPoints: 25,
      responseRate: 92,
    },
    {
      id: "e2",
      name: "Elder Kofi Mensah",
      avatar: "K",
      tier: "Grand",
      honorScore: 945,
      sharedCircles: 2,
      monthsKnown: 8,
      lastCircle: "Business Owners",
      maxVouchPoints: 50,
      responseRate: 87,
    },
    {
      id: "e3",
      name: "Elder Priya Sharma",
      avatar: "P",
      tier: "Junior",
      honorScore: 680,
      sharedCircles: 1,
      monthsKnown: 4,
      lastCircle: "Tech Savers",
      maxVouchPoints: 10,
      responseRate: 95,
    },
  ]

  const pendingRequests = [{ elderId: "e4", elderName: "Elder James", status: "pending", sentAt: "2 days ago" }]

  const [selectedElder, setSelectedElder] = useState<(typeof availableElders)[0] | null>(null)
  const [customMessage, setCustomMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case "Grand":
        return { bg: "#7C3AED", color: "#FFFFFF", icon: "🌳" }
      case "Senior":
        return { bg: "#00C6AE", color: "#FFFFFF", icon: "🌿" }
      case "Junior":
        return { bg: "#6B7280", color: "#FFFFFF", icon: "🌱" }
      default:
        return { bg: "#6B7280", color: "#FFFFFF", icon: "👤" }
    }
  }

  const handleSubmit = () => {
    if (!selectedElder || customMessage.length < 20) return
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setShowSuccess(true)
    }, 1500)
  }

  const handleBack = () => {
    console.log("Go back")
  }

  if (showSuccess) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>Request Sent!</h2>
        <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: "#6B7280", maxWidth: "280px" }}>
          {selectedElder?.name} has been notified. You&apos;ll receive a response within 48 hours.
        </p>
        <button
          onClick={handleBack}
          style={{
            padding: "14px 32px",
            borderRadius: "12px",
            border: "none",
            background: "#0A2342",
            color: "#FFFFFF",
            fontSize: "15px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "160px",
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
            onClick={handleBack}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Request Vouch</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Get an Elder to vouch for you
            </p>
          </div>
        </div>

        {/* Context Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <p style={{ margin: "0 0 6px 0", fontSize: "13px", opacity: 0.8 }}>Joining circle requires</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>{targetCircle.name}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
                Min XnScore: {targetCircle.requiredXnScore}
              </p>
            </div>
            <div
              style={{
                background: "#FEF3C7",
                padding: "8px 12px",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#D97706" }}>
                Need +{targetCircle.gap} pts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div
            style={{
              background: "#FEF3C7",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>⏳</span>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
                {pendingRequests.length} pending request(s)
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#92400E" }}>
                {pendingRequests[0].elderName} - sent {pendingRequests[0].sentAt}
              </p>
            </div>
          </div>
        )}

        {/* Select Elder */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>Select an Elder</h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>
          Elders you&apos;ve been in circles with
        </p>

        {availableElders.map((elder) => {
          const tierStyle = getTierStyle(elder.tier)
          const isSelected = selectedElder?.id === elder.id

          return (
            <button
              key={elder.id}
              onClick={() => setSelectedElder(elder)}
              style={{
                width: "100%",
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "12px",
                border: isSelected ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${tierStyle.bg} 0%, ${tierStyle.bg}dd 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#FFFFFF",
                    position: "relative",
                  }}
                >
                  {elder.avatar}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      fontSize: "14px",
                    }}
                  >
                    {tierStyle.icon}
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{elder.name}</h4>
                    <span
                      style={{
                        background: tierStyle.bg,
                        color: tierStyle.color,
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                      }}
                    >
                      {elder.tier}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>
                    Honor Score: {elder.honorScore} • Can give up to +{elder.maxVouchPoints} pts
                  </p>

                  {/* Shared History */}
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: "#F5F7FA",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        color: "#0A2342",
                      }}
                    >
                      {elder.sharedCircles} circles together
                    </span>
                    <span
                      style={{
                        background: "#F5F7FA",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        color: "#0A2342",
                      }}
                    >
                      {elder.monthsKnown} months known
                    </span>
                    <span
                      style={{
                        background: "#F0FDFB",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        color: "#00897B",
                      }}
                    >
                      {elder.responseRate}% response rate
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}

        {/* Custom Message */}
        {selectedElder && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              marginTop: "20px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              Your Message to {selectedElder.name.split(" ")[1]}
            </h4>
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>
              Explain why you&apos;d like their vouch
            </p>

            {/* Pre-filled Context */}
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                ℹ️ Context auto-included: &quot;We completed {selectedElder.sharedCircles} circles together, last one
                being {selectedElder.lastCircle}&quot;
              </p>
            </div>

            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Please consider vouching for me because... (min 20 characters)"
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  color: customMessage.length >= 20 ? "#00C6AE" : "#6B7280",
                }}
              >
                {customMessage.length}/20 min
              </span>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Max vouch: +{selectedElder.maxVouchPoints} pts</span>
            </div>
          </div>
        )}

        {/* Tips */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginTop: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "700", color: "#0A2342" }}>
            💡 Tips for Getting Vouched
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              "Mention specific circles you completed together",
              "Highlight your payment track record",
              "Be genuine about why you need the vouch",
              "Don't spam multiple Elders at once",
            ].map((tip, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#00C6AE" }}>✓</span>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>{tip}</span>
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
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={handleSubmit}
          disabled={!selectedElder || customMessage.length < 20 || isSubmitting}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background:
              selectedElder && customMessage.length >= 20
                ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)"
                : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "700",
            color: selectedElder && customMessage.length >= 20 ? "#FFFFFF" : "#9CA3AF",
            cursor: selectedElder && customMessage.length >= 20 && !isSubmitting ? "pointer" : "not-allowed",
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
                  width: "18px",
                  height: "18px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Sending...
            </>
          ) : (
            <>Send Vouch Request</>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
