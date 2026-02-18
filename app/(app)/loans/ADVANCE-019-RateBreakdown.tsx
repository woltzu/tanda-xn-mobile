"use client"

export default function AdvanceRejectedScreen() {
  const rejection = {
    advanceType: "Flex Advance",
    requestedAmount: 1000,
    reason: "xnscore_low", // xnscore_low, no_upcoming_payout, existing_advance, new_user
    currentXnScore: 68,
    requiredXnScore: 75,
    alternativeProduct: {
      name: "Quick Advance",
      maxAmount: 400,
      minScore: 65,
    },
  }

  const improvements = [
    { action: "Complete current circle", points: "+3", timeframe: "2 weeks" },
    { action: "Make 2 on-time contributions", points: "+2", timeframe: "This month" },
    { action: "Refer a friend who joins", points: "+2", timeframe: "Anytime" },
  ]

  const getRejectionMessage = (reason: string) => {
    switch (reason) {
      case "xnscore_low":
        return {
          title: "XnScore Below Requirement",
          description: `${rejection.advanceType} requires XnScore ${rejection.requiredXnScore}+. You're at ${rejection.currentXnScore}.`,
        }
      case "no_upcoming_payout":
        return {
          title: "No Upcoming Payout",
          description: "Advances are secured by your circle payouts. Join a circle to become eligible.",
        }
      case "existing_advance":
        return {
          title: "Active Advance Exists",
          description: "You can only have one active advance at a time. Repay your current advance first.",
        }
      case "new_user":
        return {
          title: "Build Your History First",
          description: "Complete at least one circle contribution to establish your XnScore.",
        }
      default:
        return {
          title: "Not Eligible",
          description: "You don't currently qualify for this advance.",
        }
    }
  }

  const message = getRejectionMessage(rejection.reason)
  const progressPercent = (rejection.currentXnScore / rejection.requiredXnScore) * 100
  const pointsNeeded = rejection.requiredXnScore - rejection.currentXnScore

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Advance Request</h1>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(217,119,6,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700" }}>{message.title}</h2>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              opacity: 0.9,
              maxWidth: "280px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {message.description}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* XnScore Progress (if applicable) */}
        {rejection.reason === "xnscore_low" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <div>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Your XnScore</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "28px", fontWeight: "700", color: "#D97706" }}>
                  {rejection.currentXnScore}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Required</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
                  {rejection.requiredXnScore}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ height: "12px", background: "#E5E7EB", borderRadius: "6px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(progressPercent, 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #D97706 0%, #00C6AE 100%)",
                    borderRadius: "6px",
                  }}
                />
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", textAlign: "center" }}>
              You need <strong style={{ color: "#00C6AE" }}>{pointsNeeded} more points</strong> to unlock{" "}
              {rejection.advanceType}
            </p>
          </div>
        )}

        {/* How to Improve */}
        {rejection.reason === "xnscore_low" && (
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
              How to reach {rejection.requiredXnScore} XnScore
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {improvements.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "#F0FDFB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#00C6AE",
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{item.action}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{item.timeframe}</p>
                    </div>
                  </div>
                  <span
                    style={{
                      background: "#F0FDFB",
                      color: "#00C6AE",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                  >
                    {item.points}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => console.log("View improvements")}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #00C6AE",
                background: "#FFFFFF",
                fontSize: "13px",
                fontWeight: "600",
                color: "#00C6AE",
                cursor: "pointer",
              }}
            >
              See All Ways to Improve →
            </button>
          </div>
        )}

        {/* Alternative Product */}
        {rejection.alternativeProduct && (
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "2px solid #00C6AE",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#00897B", fontWeight: "600" }}>
                  YOU QUALIFY FOR
                </p>
                <p style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700", color: "#065F46" }}>
                  {rejection.alternativeProduct.name}
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#047857" }}>
                  Up to ${rejection.alternativeProduct.maxAmount} • Min XnScore {rejection.alternativeProduct.minScore}
                </p>
              </div>
            </div>

            <button
              onClick={() => console.log("Try alternative")}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background: "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Apply for {rejection.alternativeProduct.name}
            </button>
          </div>
        )}

        {/* Encouragement */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
            border: "1px solid #E5E7EB",
          }}
        >
          <span style={{ fontSize: "32px" }}>🌱</span>
          <p style={{ margin: "8px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Keep building your XnScore!
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Every on-time contribution moves you closer to unlocking better advance options with lower rates.
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
          onClick={() => console.log("Go home")}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#0A2342",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}
