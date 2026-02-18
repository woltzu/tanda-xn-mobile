"use client"

import { useState } from "react"

export default function LowProfileModeScreen() {
  const currentSettings = {
    lowProfileEnabled: true,
    hideAmount: true,
    hideCircleCount: false,
    hideActivity: true,
    showOnlyInitials: false,
    blurPhoto: false,
  }

  const [settings, setSettings] = useState(currentSettings)

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const privacyOptions = [
    {
      id: "hideAmount",
      label: "Hide savings amounts",
      description: "Others see '***' instead of your balances",
      icon: "💰",
    },
    {
      id: "hideCircleCount",
      label: "Hide number of circles",
      description: "Don't show how many circles you're in",
      icon: "🔢",
    },
    {
      id: "hideActivity",
      label: "Hide recent activity",
      description: "Your actions don't appear in feeds",
      icon: "📊",
    },
    {
      id: "showOnlyInitials",
      label: "Show initials only",
      description: "Display 'F.K.' instead of full name",
      icon: "🔤",
    },
    {
      id: "blurPhoto",
      label: "Blur profile photo",
      description: "Add blur effect to your photo for non-contacts",
      icon: "📷",
    },
  ]

  const activeCount = Object.values(settings).filter((v) => v === true).length - 1 // -1 for lowProfileEnabled

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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Low Profile Mode</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Selective privacy controls</p>
          </div>
        </div>

        {/* Status Bar */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🕶️</span>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
                {settings.lowProfileEnabled ? "Low Profile Active" : "Low Profile Disabled"}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.8 }}>
                {activeCount} privacy options enabled
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleSetting("lowProfileEnabled")}
            style={{
              width: "52px",
              height: "30px",
              borderRadius: "15px",
              border: "none",
              background: settings.lowProfileEnabled ? "#00C6AE" : "rgba(255,255,255,0.3)",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "#FFFFFF",
                position: "absolute",
                top: "3px",
                left: settings.lowProfileEnabled ? "25px" : "3px",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Privacy Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 16px 8px 16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Privacy Options</h3>
          </div>

          {privacyOptions.map((option, idx) => (
            <div
              key={option.id}
              style={{
                padding: "16px",
                borderTop: "1px solid #F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: settings.lowProfileEnabled ? 1 : 0.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                <span style={{ fontSize: "22px" }}>{option.icon}</span>
                <div>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                    {option.label}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{option.description}</p>
                </div>
              </div>
              <button
                onClick={() => settings.lowProfileEnabled && toggleSetting(option.id)}
                disabled={!settings.lowProfileEnabled}
                style={{
                  width: "48px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: settings[option.id] ? "#00C6AE" : "#E5E7EB",
                  cursor: settings.lowProfileEnabled ? "pointer" : "not-allowed",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    position: "absolute",
                    top: "3px",
                    left: settings[option.id] ? "23px" : "3px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Preview Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginTop: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            👁️ How others see you
          </h4>
          <div
            style={{
              padding: "16px",
              background: "#F5F7FA",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "600",
                color: "#FFFFFF",
                filter: settings.blurPhoto ? "blur(4px)" : "none",
              }}
            >
              {settings.showOnlyInitials ? "F.K." : "FK"}
            </div>
            <div>
              <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {settings.showOnlyInitials ? "F. K." : "Franck Kengne"}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                {settings.hideAmount ? "Total Saved: ***" : "Total Saved: $4,850"}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
                {settings.hideCircleCount ? "Circles: Hidden" : "3 Active Circles"}
              </p>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            💡 <strong>Tip:</strong> Low Profile mode lets you stay visible to circle members while hiding sensitive
            details. For complete invisibility, use Stealth Mode instead.
          </p>
        </div>
      </div>

      {/* Save Button */}
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
          onClick={() => console.log("Saving settings:", settings)}
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
          Save Settings
        </button>
      </div>
    </div>
  )
}
