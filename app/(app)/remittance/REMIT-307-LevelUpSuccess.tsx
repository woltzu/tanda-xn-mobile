"use client"

export default function LevelUpSuccessScreen() {
  const unlockedTier = {
    id: "trusted",
    name: "Trusted",
    badge: "⭐",
    color: "#F59E0B",
    limit: 10000,
    benefits: [
      "Send up to $10,000/month",
      "Lower fees on large transfers",
      "Priority customer support",
      "Instant transfers to all countries",
    ],
  }

  const previousTier = {
    name: "Verified",
    badge: "✅",
    limit: 2000,
  }

  const handleStartSending = () => console.log("Navigate to Send Money Home")
  const handleViewLimits = () => console.log("Navigate to Sending Power Dashboard")
  const handleDone = () => console.log("Close/Navigate to home")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Celebration Header */}
      <div
        style={{
          background: `linear-gradient(135deg, #0A2342 0%, #143654 100%)`,
          padding: "40px 20px 100px 20px",
          color: "#FFFFFF",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Confetti Effect (CSS only) */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: "10px",
              height: "10px",
              background: ["#00C6AE", "#F59E0B", "#FFFFFF", "#8B5CF6"][i % 4],
              borderRadius: i % 2 === 0 ? "50%" : "2px",
              top: `${Math.random() * 50}%`,
              left: `${Math.random() * 100}%`,
              opacity: 0.6,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        ))}

        {/* Badge Animation */}
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${unlockedTier.color}40, ${unlockedTier.color}20)`,
            border: `4px solid ${unlockedTier.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
            fontSize: "60px",
            boxShadow: `0 8px 32px ${unlockedTier.color}60`,
            animation: "pulse 2s infinite",
          }}
        >
          {unlockedTier.badge}
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700" }}>Level Up! 🎉</h1>
        <p style={{ margin: 0, fontSize: "16px", opacity: 0.9 }}>
          You're now a <strong style={{ color: unlockedTier.color }}>{unlockedTier.name} Sender</strong>
        </p>

        {/* Limit Upgrade */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            marginTop: "24px",
            padding: "16px 24px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            maxWidth: "300px",
            margin: "24px auto 0 auto",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>Before</p>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "18px",
                fontWeight: "600",
                textDecoration: "line-through",
                opacity: 0.6,
              }}
            >
              ${previousTier.limit.toLocaleString()}
            </p>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>Now</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: unlockedTier.color }}>
              ${unlockedTier.limit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* What's Unlocked */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "24px" }}>🎁</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>What You've Unlocked</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {unlockedTier.benefits.map((benefit, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "#F0FDFB",
                  borderRadius: "10px",
                }}
              >
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
                <span style={{ fontSize: "14px", color: "#0A2342" }}>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Achievement Card */}
        <div
          style={{
            background: `linear-gradient(135deg, ${unlockedTier.color}15, ${unlockedTier.color}05)`,
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: `2px solid ${unlockedTier.color}30`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "12px",
                background: unlockedTier.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
              }}
            >
              {unlockedTier.badge}
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#6B7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Achievement Unlocked
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                {unlockedTier.name} Sender
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Earned on {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Share Achievement */}
        <button
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "500",
            color: "#0A2342",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share Achievement
        </button>

        {/* Fun Stats */}
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            background: "#F5F7FA",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
            You're in the top <strong style={{ color: "#0A2342" }}>15%</strong> of TandaXn senders! 🏆
          </p>
        </div>
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
        }}
      >
        <button
          onClick={handleStartSending}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          🌍 Start Sending Money
        </button>
        <button
          onClick={handleDone}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "500",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>

      {/* Keyframe animation (inline for component) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
