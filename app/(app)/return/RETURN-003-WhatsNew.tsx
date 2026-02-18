"use client"

import { TabBarInline } from "../../../components/TabBar"

export default function WhatsNewScreen() {
  const version = "2.5.0"
  const releaseDate = "January 2026"

  const updates = [
    {
      id: "u1",
      type: "feature",
      icon: String.fromCodePoint(0x1f30d),
      title: "Family Support Circles",
      description: "Pool money with siblings to send home together. Save up to 80% on remittance fees!",
      isNew: true,
    },
    {
      id: "u2",
      type: "feature",
      icon: String.fromCodePoint(0x1f4b3),
      title: "XnScore Loans",
      description: "Use your XnScore to access emergency loans, advance payouts, and credit builder loans.",
      isNew: true,
    },
    {
      id: "u3",
      type: "improvement",
      icon: String.fromCodePoint(0x26a1),
      title: "Faster Payouts",
      description: "Instant payouts now available to all verified members. No more waiting!",
      isNew: false,
    },
    {
      id: "u4",
      type: "improvement",
      icon: String.fromCodePoint(0x1f512),
      title: "Enhanced Security",
      description: "Biometric login and improved fraud detection to keep your money safe.",
      isNew: false,
    },
  ]

  const handleDismiss = () => {
    console.log("Dismissed what's new")
  }

  const handleLearnMore = (update: typeof updates[0]) => {
    console.log("Learn more about:", update.title)
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
      {/* Header - Navy with celebration */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "24px 20px 80px 20px",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "20px",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
            fontSize: "36px",
          }}
        >
          {String.fromCodePoint(0x1f389)}
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>What's New in TandaXn</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>
          Version {version} {String.fromCodePoint(0x2022)} {releaseDate}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Updates List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid #E5E7EB",
          }}
        >
          {updates.map((update, idx) => (
            <div
              key={update.id}
              style={{
                padding: "20px",
                borderBottom: idx < updates.length - 1 ? "1px solid #F5F7FA" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "14px",
                    background: update.type === "feature" ? "#F0FDFB" : "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "26px",
                    flexShrink: 0,
                  }}
                >
                  {update.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>{update.title}</p>
                    {update.isNew && (
                      <span
                        style={{
                          padding: "2px 8px",
                          background: "#00C6AE",
                          color: "#FFFFFF",
                          fontSize: "9px",
                          fontWeight: "700",
                          borderRadius: "4px",
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}>{update.description}</p>
                  {update.type === "feature" && (
                    <button
                      onClick={() => handleLearnMore(update)}
                      style={{
                        marginTop: "10px",
                        padding: "8px 16px",
                        background: "#F0FDFB",
                        border: "1px solid #00C6AE",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#00897B",
                        cursor: "pointer",
                      }}
                    >
                      Learn More
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "20px",
            marginTop: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Coming Soon</h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>{String.fromCodePoint(0x1fa99)}</span>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>Digital Savings Tokens</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>{String.fromCodePoint(0x1f474)}</span>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>Elder Wisdom System</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>{String.fromCodePoint(0x1f3c6)}</span>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>Community Rewards</p>
            </div>
          </div>
        </div>

        {/* Feedback CTA */}
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "#F0FDFB",
            borderRadius: "12px",
            border: "1px solid #00C6AE",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#065F46" }}>
            Got feedback? We'd love to hear from you!
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Help us build features you need</p>
        </div>
      </div>

      {/* Continue Button */}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <button
          onClick={handleDismiss}
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
          }}
        >
          Got It!
        </button>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
