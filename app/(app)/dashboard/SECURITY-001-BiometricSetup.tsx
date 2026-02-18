"use client"

import { useState } from "react"

export default function BiometricSetupScreen() {
  const [biometricType] = useState<"Face ID" | "Touch ID">("Face ID")

  const handleEnable = () => {
    console.log("Enabling biometric authentication...")
  }

  const handleSkip = () => {
    console.log("Skipping biometric setup...")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: "60px 20px 40px 20px",
      }}
    >
      {/* Skip */}
      <div style={{ textAlign: "right", marginBottom: "40px" }}>
        <button
          onClick={handleSkip}
          style={{
            background: "none",
            border: "none",
            fontSize: "14px",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          Skip for now
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: "#F0FDFB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "32px",
          }}
        >
          <span style={{ fontSize: "64px" }}>{biometricType === "Face ID" ? "👤" : "👆"}</span>
        </div>

        <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
          Enable {biometricType}
        </h2>
        <p style={{ margin: "0 0 32px 0", fontSize: "15px", color: "#6B7280", maxWidth: "300px", lineHeight: 1.6 }}>
          Use {biometricType} for quick, secure access to your TandaXn account and to approve transactions.
        </p>

        {/* Benefits */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            width: "100%",
            maxWidth: "340px",
            marginBottom: "32px",
            border: "1px solid #E5E7EB",
          }}
        >
          {[
            { icon: "⚡", text: "Quick sign-in" },
            { icon: "🔒", text: "Secure transactions" },
            { icon: "🛡️", text: "Extra layer of protection" },
          ].map((item, idx) => (
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
              <span style={{ fontSize: "20px" }}>{item.icon}</span>
              <span style={{ fontSize: "14px", color: "#0A2342" }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleEnable}
        style={{
          width: "100%",
          padding: "18px",
          borderRadius: "14px",
          border: "none",
          background: "#00C6AE",
          fontSize: "17px",
          fontWeight: "600",
          color: "#FFFFFF",
          cursor: "pointer",
        }}
      >
        Enable {biometricType}
      </button>
    </div>
  )
}
