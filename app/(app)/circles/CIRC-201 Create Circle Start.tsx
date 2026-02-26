"use client"

import { useState } from "react"

export default function CreateCircleStartScreen() {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const userXnScore = 72
  const minScoreRequired = 60
  const canCreate = userXnScore >= minScoreRequired

  const circleTypes = [
    {
      id: "traditional",
      name: "Rotating Pot",
      emoji: "🔄",
      description: "Classic ROSCA. Members contribute equally, one member receives the full pot each cycle.",
      features: ["Equal contributions", "Rotating payouts", "Fixed schedule"],
      popular: true,
    },
    {
      id: "goal",
      name: "Shared Goal",
      emoji: "🎯",
      description: "Everyone saves toward a common target. Funds are used together when the goal is reached.",
      features: ["Shared target", "Flexible amounts", "One-time or recurring"],
      popular: false,
    },
    {
      id: "emergency",
      name: "Emergency Pool",
      emoji: "🛡️",
      description: "Members contribute to a communal fund. Anyone can request withdrawals when needed.",
      features: ["Safety net", "Request-based", "Community support"],
      popular: false,
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Create a Circle</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Save together with people you trust</p>
          </div>
        </div>

        {/* XnScore Requirement */}
        <div
          style={{
            background: canCreate ? "rgba(0,198,174,0.2)" : "rgba(217,119,6,0.2)",
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
              background: canCreate ? "#00C6AE" : "#D97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: "700",
              color: "#FFFFFF",
            }}
          >
            {userXnScore}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
              {canCreate ? "You can create circles!" : "Score too low"}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {canCreate
                ? `Your XnScore (${userXnScore}) exceeds minimum (${minScoreRequired})`
                : `Need ${minScoreRequired}+ XnScore to create circles`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Circle Types */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            Choose how money moves
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {circleTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                disabled={!canCreate}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: selectedType === type.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "14px",
                  border: selectedType === type.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  cursor: canCreate ? "pointer" : "not-allowed",
                  textAlign: "left",
                  opacity: canCreate ? 1 : 0.6,
                  position: "relative",
                }}
              >
                {type.popular && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-8px",
                      right: "12px",
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      fontWeight: "700",
                    }}
                  >
                    POPULAR
                  </span>
                )}

                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "14px",
                      background: selectedType === type.id ? "#00C6AE" : "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "26px",
                      flexShrink: 0,
                    }}
                  >
                    {type.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {type.name}
                    </h4>
                    <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.4 }}>
                      {type.description}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {type.features.map((feature, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: selectedType === type.id ? "#00C6AE" : "#E5E7EB",
                            color: selectedType === type.id ? "#FFFFFF" : "#6B7280",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "10px",
                            fontWeight: "500",
                          }}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedType === type.id && (
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "#00C6AE",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <button
          onClick={() => console.log("Learn More")}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            border: "1px solid #E5E7EB",
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
              borderRadius: "10px",
              background: "#F5F7FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              How do savings circles work?
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Learn about tandas and rotating savings
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Trust Note - CORRECTED: Excludes collusion cases */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
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
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Protected by TandaXn:</strong> Contributions are secured against individual member defaults.
            <span style={{ color: "#92400E" }}>
              {" "}
              Note: Protection does not apply in cases of suspected collusion or coordinated fraud.
            </span>
          </p>
        </div>
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
          onClick={() => console.log("Continue with", selectedType)}
          disabled={!selectedType || !canCreate}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: selectedType && canCreate ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: selectedType && canCreate ? "#FFFFFF" : "#9CA3AF",
            cursor: selectedType && canCreate ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
