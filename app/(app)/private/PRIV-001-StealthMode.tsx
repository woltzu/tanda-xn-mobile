"use client"

import { useState } from "react"

export default function StealthModeScreen() {
  const currentSettings = {
    stealthEnabled: false,
    hiddenSince: null,
    autoDisableAfter: null, // null = never, or days
  }

  const features = [
    { id: "search", label: "Hidden from member search", description: "Others can't find you by name" },
    { id: "feed", label: "No activity in public feed", description: "Your actions stay private" },
    { id: "circles", label: "Anonymous in circle listings", description: "Show as 'Anonymous Member'" },
    { id: "profile", label: "Profile hidden from non-contacts", description: "Only existing contacts see you" },
  ]

  const limitations = [
    "Circle admins can still see your identity",
    "Payment records still visible to recipients",
    "Support can access your account if needed",
  ]

  const [isEnabled, setIsEnabled] = useState(currentSettings.stealthEnabled)
  const [showConfirm, setShowConfirm] = useState(false)
  const [autoDisableAfter, setAutoDisableAfter] = useState(currentSettings.autoDisableAfter)

  const handleToggle = () => {
    if (!isEnabled) {
      setShowConfirm(true)
    } else {
      setIsEnabled(false)
    }
  }

  const confirmEnable = () => {
    setIsEnabled(true)
    setShowConfirm(false)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Stealth Mode</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Complete privacy protection</p>
          </div>
        </div>

        {/* Stealth Icon */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "50%",
              background: isEnabled ? "rgba(0,198,174,0.2)" : "rgba(255,255,255,0.1)",
              border: isEnabled ? "3px solid #00C6AE" : "3px solid rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
              fontSize: "40px",
            }}
          >
            {isEnabled ? "🥷" : "👤"}
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "14px", opacity: 0.9 }}>
            {isEnabled ? "You are invisible to the community" : "You are visible to others"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Main Toggle Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: isEnabled ? "2px solid #00C6AE" : "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                Stealth Mode
              </h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                {isEnabled ? "Active since " + (currentSettings.hiddenSince || "just now") : "Become invisible"}
              </p>
            </div>
            <button
              onClick={handleToggle}
              style={{
                width: "56px",
                height: "32px",
                borderRadius: "16px",
                border: "none",
                background: isEnabled ? "#00C6AE" : "#E5E7EB",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  position: "absolute",
                  top: "3px",
                  left: isEnabled ? "27px" : "3px",
                  transition: "left 0.2s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>
        </div>

        {/* What Stealth Does */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            🥷 What Stealth Mode Does
          </h3>

          {features.map((feature, idx) => (
            <div
              key={feature.id}
              style={{
                padding: "12px 0",
                borderBottom: idx < features.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: isEnabled ? "#00C6AE" : "#E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isEnabled ? "#FFFFFF" : "#9CA3AF"}
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                  {feature.label}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Limitations */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>⚠️ Limitations</h4>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#92400E", lineHeight: 1.8 }}>
            {limitations.map((limit, idx) => (
              <li key={idx}>{limit}</li>
            ))}
          </ul>
        </div>

        {/* Auto-Disable Option */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            ⏰ Auto-Disable Timer
          </h4>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { value: null, label: "Never" },
              { value: 7, label: "7 days" },
              { value: 30, label: "30 days" },
              { value: 90, label: "90 days" },
            ].map((option) => (
              <button
                key={option.label}
                onClick={() => setAutoDisableAfter(option.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: autoDisableAfter === option.value ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: autoDisableAfter === option.value ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: autoDisableAfter === option.value ? "#00897B" : "#6B7280",
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,35,66,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "340px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "28px",
              }}
            >
              🥷
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Enable Stealth Mode?
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
              You'll become invisible to other members. Existing circle members and contacts can still see you.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmEnable}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#00C6AE",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
