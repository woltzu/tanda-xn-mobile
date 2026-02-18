"use client"

import { TabBarInline } from "../../../components/TabBar"

export default function NoCirclesEmptyState() {
  const handleJoinCircle = () => {
    console.log("Browse circles")
  }

  const handleCreateCircle = () => {
    console.log("Create circle")
  }

  const handleLearnMore = () => {
    console.log("Learn more")
  }

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
        paddingBottom: "120px",
        textAlign: "center",
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width: "160px",
          height: "160px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #F0FDFB 0%, #E0F7F4 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
          position: "relative",
        }}
      >
        <span style={{ fontSize: "64px" }}>{String.fromCodePoint(0x1f504)}</span>
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>No Circles Yet</h2>
      <p style={{ margin: "0 0 32px 0", fontSize: "15px", color: "#6B7280", maxWidth: "300px", lineHeight: 1.6 }}>
        Join a savings circle to start building your future together with trusted community members.
      </p>

      {/* Benefits */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "32px",
          width: "100%",
          maxWidth: "340px",
          border: "1px solid #E5E7EB",
        }}
      >
        {[
          { icon: String.fromCodePoint(0x1f4b0), text: "Save together with community" },
          { icon: String.fromCodePoint(0x1f4c8), text: "Build your XnScore" },
          { icon: String.fromCodePoint(0x1f3af), text: "Reach goals faster" },
        ].map((benefit, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 0",
              borderBottom: idx < 2 ? "1px solid #F5F7FA" : "none",
            }}
          >
            <span style={{ fontSize: "22px" }}>{benefit.icon}</span>
            <span style={{ fontSize: "14px", color: "#0A2342" }}>{benefit.text}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <button
        onClick={handleJoinCircle}
        style={{
          width: "100%",
          maxWidth: "340px",
          padding: "16px",
          borderRadius: "14px",
          border: "none",
          background: "#00C6AE",
          fontSize: "16px",
          fontWeight: "600",
          color: "#FFFFFF",
          cursor: "pointer",
          marginBottom: "12px",
        }}
      >
        Browse Circles
      </button>

      <button
        onClick={handleCreateCircle}
        style={{
          width: "100%",
          maxWidth: "340px",
          padding: "16px",
          borderRadius: "14px",
          border: "1px solid #E5E7EB",
          background: "#FFFFFF",
          fontSize: "16px",
          fontWeight: "600",
          color: "#0A2342",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        Create a Circle
      </button>

      <button
        onClick={handleLearnMore}
        style={{
          background: "none",
          border: "none",
          fontSize: "14px",
          color: "#00897B",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Learn how circles work
      </button>

      {/* Tab Bar */}
      <TabBarInline activeTab="circles" />
    </div>
  )
}
