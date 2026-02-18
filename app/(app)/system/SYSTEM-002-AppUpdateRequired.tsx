"use client"

import { useState } from "react"

export default function AppUpdateRequiredScreen() {
  const [currentVersion] = useState("1.2.0")
  const [requiredVersion] = useState("2.0.0")
  const [isUpdating, setIsUpdating] = useState(false)

  const newFeatures = [
    { icon: String.fromCodePoint(0x1f512), title: "Enhanced Security", description: "Bank-level encryption" },
    { icon: String.fromCodePoint(0x26a1), title: "Faster Payouts", description: "Instant transfers" },
    { icon: String.fromCodePoint(0x1f30d), title: "More Countries", description: "8 new destinations" },
  ]

  const handleUpdate = () => {
    setIsUpdating(true)
    console.log("Redirecting to app store for update...")
    // In a real app, this would redirect to the appropriate app store
    setTimeout(() => {
      // Simulate redirect
      window.open("https://apps.apple.com", "_blank")
      setIsUpdating(false)
    }, 1000)
  }

  const handleNotNow = () => {
    console.log("User chose not to update - this is a required update, showing warning")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        padding: "40px 20px",
      }}
    >
      {/* Main Content - Centered */}
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
        {/* Illustration */}
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
            position: "relative",
          }}
        >
          <span style={{ fontSize: "56px" }}>{String.fromCodePoint(0x1f4f2)}</span>
          {/* Update badge */}
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>Update Required</h2>
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: "15px",
            color: "#6B7280",
            maxWidth: "300px",
            lineHeight: 1.6,
          }}
        >
          A new version of TandaXn is available with important security and performance improvements.
        </p>

        {/* Version Info Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px 24px",
            marginBottom: "24px",
            border: "1px solid #E5E7EB",
            width: "100%",
            maxWidth: "320px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#9CA3AF", textTransform: "uppercase" }}>
                Current
              </p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#DC2626" }}>v{currentVersion}</p>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#9CA3AF", textTransform: "uppercase" }}>
                Required
              </p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#00C6AE" }}>v{requiredVersion}</p>
            </div>
          </div>
        </div>

        {/* What's New */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "32px",
            border: "1px solid #E5E7EB",
            width: "100%",
            maxWidth: "320px",
            textAlign: "left",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What's New in v{requiredVersion}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {newFeatures.map((feature, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    flexShrink: 0,
                  }}
                >
                  {feature.icon}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{feature.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons - Fixed at bottom */}
      <div style={{ width: "100%", maxWidth: "320px", margin: "0 auto" }}>
        {/* Update Button */}
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: "14px",
            border: "none",
            background: isUpdating ? "#9CA3AF" : "#00C6AE",
            fontSize: "17px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: isUpdating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          {isUpdating ? (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Opening Store...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Update Now
            </>
          )}
        </button>

        {/* Warning Notice */}
        <div
          style={{
            padding: "12px 16px",
            background: "#FEF3C7",
            borderRadius: "10px",
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
            stroke="#D97706"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
            This update is required to continue using TandaXn. Your data is safe and will sync automatically.
          </p>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
