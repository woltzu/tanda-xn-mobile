"use client"

import { useState } from "react"

export default function PrivacySettingsScreen() {
  const currentSettings = {
    profileVisibility: "circle_members", // "public", "circle_members", "private"
    showSavingsAmount: false,
    showXnScore: true,
    showCircleMembership: true,
    showActivityInFeed: false,
    allowDiscovery: true,
    dataSharing: {
      analytics: true,
      improvements: true,
      marketing: false,
    },
  }

  const [settings, setSettings] = useState(currentSettings)

  const visibilityOptions = [
    {
      id: "public",
      label: "Everyone",
      description: "Anyone on TandaXn can see your profile",
      icon: "🌍",
    },
    {
      id: "circle_members",
      label: "Circle Members Only",
      description: "Only people in your circles",
      icon: "👥",
    },
    {
      id: "private",
      label: "Private",
      description: "Only you can see your profile",
      icon: "🔒",
    },
  ]

  const toggleSetting = (key: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }))
  }

  const toggleDataSharing = (key: string) => {
    setSettings((prev) => ({
      ...prev,
      dataSharing: {
        ...prev.dataSharing,
        [key]: !prev.dataSharing[key as keyof typeof prev.dataSharing],
      },
    }))
  }

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSave = () => {
    console.log("Save settings:", settings)
  }

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={handleBack}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Privacy</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Control what others see</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Profile Visibility */}
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
            Profile Visibility
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {visibilityOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSettings((prev) => ({ ...prev, profileVisibility: option.id }))}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: settings.profileVisibility === option.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: settings.profileVisibility === option.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "20px" }}>{option.icon}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{option.label}</p>
                  <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{option.description}</p>
                </div>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: settings.profileVisibility === option.id ? "none" : "2px solid #D1D5DB",
                    background: settings.profileVisibility === option.id ? "#00C6AE" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {settings.profileVisibility === option.id && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* What Others See */}
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
            What Others Can See
          </h3>

          {[
            {
              key: "showSavingsAmount",
              label: "Savings Amount",
              description: "Show how much you've saved",
              sensitive: true,
            },
            { key: "showXnScore", label: "XnScore Badge", description: "Display your credit score badge" },
            {
              key: "showCircleMembership",
              label: "Circle Membership",
              description: "Show which circles you're in",
            },
            { key: "showActivityInFeed", label: "Activity in Feed", description: "Share achievements publicly" },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{item.label}</p>
                  {item.sensitive && (
                    <span
                      style={{
                        padding: "2px 5px",
                        background: "#FEF3C7",
                        color: "#D97706",
                        fontSize: "8px",
                        fontWeight: "700",
                        borderRadius: "3px",
                      }}
                    >
                      SENSITIVE
                    </span>
                  )}
                </div>
                <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{item.description}</p>
              </div>
              <button
                onClick={() => toggleSetting(item.key)}
                style={{
                  width: "48px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: settings[item.key as keyof typeof settings] ? "#00C6AE" : "#E5E7EB",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
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
                    left: settings[item.key as keyof typeof settings] ? "23px" : "3px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Data Sharing */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Data Sharing</h3>

          {[
            { key: "analytics", label: "Usage Analytics", description: "Help us understand how you use the app" },
            {
              key: "improvements",
              label: "Product Improvements",
              description: "Share insights to improve features",
            },
            { key: "marketing", label: "Marketing Purposes", description: "Receive personalized offers" },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{item.label}</p>
                <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{item.description}</p>
              </div>
              <button
                onClick={() => toggleDataSharing(item.key)}
                style={{
                  width: "48px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: settings.dataSharing[item.key as keyof typeof settings.dataSharing]
                    ? "#00C6AE"
                    : "#E5E7EB",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
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
                    left: settings.dataSharing[item.key as keyof typeof settings.dataSharing] ? "23px" : "3px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          ))}
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
          onClick={handleSave}
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
