"use client"

import { useState } from "react"

export default function LimitedMode() {
  const [reason] = useState<"no_itin" | "pending_itin" | "later">("no_itin")
  const interestAccruing = 47.83

  const availableFeatures = [
    { icon: "🔄", title: "Join savings circles", desc: "Participate in ROSCAs with your community" },
    { icon: "💰", title: "Make contributions", desc: "Pay into your circles on schedule" },
    { icon: "🎯", title: "Save to goals", desc: "Build savings for what matters" },
    { icon: "📈", title: "Earn interest on goals", desc: "Watch your money grow (accrues until unlocked)" },
    { icon: "💸", title: "Receive payouts up to $600/year", desc: "Get your circle payouts without restrictions" },
    { icon: "👥", title: "Invite friends", desc: "Grow your community and earn referral bonuses" },
  ]

  const lockedFeatures = [
    { icon: "🔓", title: "Unlimited payouts", unlock: "Verify to unlock" },
    { icon: "💰", title: "Access earned interest", unlock: "Verify to unlock" },
    { icon: "🌍", title: "International transfers", unlock: "Verify to unlock" },
  ]

  const getMessage = () => {
    switch (reason) {
      case "pending_itin":
        return {
          title: "You're all set while you wait!",
          subtitle:
            "Your ITIN application is in progress. Use TandaXn now — your interest will be waiting when it arrives.",
        }
      case "no_itin":
        return {
          title: "That's totally OK!",
          subtitle: "You can start using TandaXn right away. Verify later when you're ready to unlock everything.",
        }
      default:
        return {
          title: "No problem!",
          subtitle: "Start using TandaXn now. You can verify anytime to unlock full features.",
        }
    }
  }

  const message = getMessage()

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "160px",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "40px 20px",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {/* Friendly Icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            👍
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>{message.title}</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9, lineHeight: 1.5 }}>{message.subtitle}</p>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px" }}>
        {/* Interest Growing Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            color: "#FFFFFF",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px" }}>🔒</span>
                <p style={{ margin: 0, fontSize: "11px", opacity: 0.9 }}>Your interest is growing!</p>
              </div>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>${interestAccruing.toFixed(2)}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Waiting for you when you verify</p>
            </div>
            <button
              onClick={() => console.log("Unlock Now")}
              style={{
                padding: "10px 14px",
                background: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#D97706",
                cursor: "pointer",
              }}
            >
              Unlock Now
            </button>
          </div>
        </div>

        {/* What You Can Do */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            What you can do now ✅
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {availableFeatures.map((feature, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "10px",
                  background: "#F0FDFB",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "18px" }}>{feature.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>{feature.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#047857" }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What's Locked */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Unlock with verification 🔐
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {lockedFeatures.map((feature, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  opacity: 0.7,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{feature.icon}</span>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>{feature.title}</span>
                </div>
                <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{feature.unlock}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ITIN Help (if applicable) */}
        {reason === "no_itin" && (
          <button
            onClick={() => console.log("Get ITIN Help")}
            style={{
              width: "100%",
              padding: "14px",
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: "18px" }}>💡</span>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>
                Need help getting an ITIN?
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#3B82F6" }}>
                We'll guide you through the process
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              style={{ marginLeft: "auto" }}
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* BOTTOM ACTIONS */}
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
          onClick={() => console.log("Start Using TandaXn")}
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
          }}
        >
          Start Using TandaXn
        </button>
        <button
          onClick={() => console.log("I'm ready to verify now")}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "14px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "500",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          I'm ready to verify now
        </button>
      </div>
    </div>
  )
}
