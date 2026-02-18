"use client"

import { useState } from "react"

export default function NotificationPrivacyScreen() {
  const [settings, setSettings] = useState({
    showPreview: "contacts", // "always", "contacts", "never"
    showSenderName: true,
    showAmounts: false,
    showOnLockScreen: true,
    silentMode: false,
    hideContentUntilUnlock: false,
  })

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const previewOptions = [
    { value: "always", label: "Always", description: "Show full message preview" },
    { value: "contacts", label: "Contacts Only", description: "Preview only for known contacts" },
    { value: "never", label: "Never", description: "Hide all message content" },
  ]

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Notification Privacy</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Control what others can see</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Preview Example */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>📱 Preview</h3>
          <div
            style={{
              background: "#0A2342",
              borderRadius: "12px",
              padding: "12px",
              color: "#FFFFFF",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                Xn
              </div>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>TandaXn</span>
              <span style={{ fontSize: "11px", opacity: 0.6, marginLeft: "auto" }}>now</span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", opacity: 0.9 }}>
              {settings.showPreview === "never"
                ? "New notification"
                : settings.showSenderName
                  ? settings.showAmounts
                    ? "Amara sent you $150"
                    : "Amara sent you a payment"
                  : settings.showAmounts
                    ? "You received $150"
                    : "You received a payment"}
            </p>
          </div>
        </div>

        {/* Message Preview Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Show message preview
          </h3>
          <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#6B7280" }}>When to show notification content</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {previewOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateSetting("showPreview", option.value)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: settings.showPreview === option.value ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: settings.showPreview === option.value ? "#F0FDFB" : "#FFFFFF",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                    {option.label}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{option.description}</p>
                </div>
                {settings.showPreview === option.value && (
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sensitive Information */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 16px 8px 16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              🔒 Sensitive Information
            </h3>
          </div>

          {[
            { key: "showSenderName", label: "Show sender name", description: "Display who sent the notification" },
            {
              key: "showAmounts",
              label: "Show amounts",
              description: "Display payment and savings amounts",
              sensitive: true,
            },
            {
              key: "showOnLockScreen",
              label: "Show on lock screen",
              description: "Display notifications when phone is locked",
            },
            {
              key: "hideContentUntilUnlock",
              label: "Hide until unlocked",
              description: "Require Face ID/Touch ID to see content",
            },
            {
              key: "silentMode",
              label: "Silent notifications",
              description: "No sound or vibration for TandaXn",
            },
          ].map((option) => (
            <div
              key={option.key}
              style={{
                padding: "14px 16px",
                borderTop: "1px solid #F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                    {option.label}
                    {option.sensitive && (
                      <span
                        style={{
                          marginLeft: "6px",
                          padding: "2px 6px",
                          background: "#FEF3C7",
                          color: "#D97706",
                          fontSize: "9px",
                          fontWeight: "600",
                          borderRadius: "4px",
                        }}
                      >
                        SENSITIVE
                      </span>
                    )}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{option.description}</p>
                </div>
              </div>
              <button
                onClick={() => updateSetting(option.key, !settings[option.key])}
                style={{
                  width: "48px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: settings[option.key] ? "#00C6AE" : "#E5E7EB",
                  cursor: "pointer",
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
                    left: settings[option.key] ? "23px" : "3px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
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
          onClick={() => console.log("Save settings:", settings)}
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
