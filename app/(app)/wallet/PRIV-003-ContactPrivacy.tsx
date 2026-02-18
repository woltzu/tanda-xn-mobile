"use client"

import { useState } from "react"

export default function ContactPrivacyScreen() {
  const [settings, setSettings] = useState({
    whoCanMessage: "contacts",
    whoCanInvite: "everyone",
    showOnlineStatus: false,
    showLastSeen: false,
    allowVoiceMessages: true,
    readReceipts: true,
  })

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const contactOptions = [
    { value: "everyone", label: "Everyone", description: "Anyone on TandaXn" },
    { value: "contacts", label: "My Contacts", description: "Only people you've added" },
    { value: "circles", label: "Circle Members", description: "Only members of your circles" },
    { value: "nobody", label: "Nobody", description: "Block all new messages" },
  ]

  const inviteOptions = [
    { value: "everyone", label: "Everyone", description: "Anyone can invite you" },
    { value: "contacts", label: "My Contacts Only", description: "Only existing contacts" },
    { value: "nobody", label: "Nobody", description: "Block all invitations" },
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Contact Privacy</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Control who can reach you</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Who Can Message */}
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
            💬 Who can message me?
          </h3>
          <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#6B7280" }}>
            Choose who can send you direct messages
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {contactOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateSetting("whoCanMessage", option.value)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: settings.whoCanMessage === option.value ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: settings.whoCanMessage === option.value ? "#F0FDFB" : "#FFFFFF",
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
                {settings.whoCanMessage === option.value && (
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

        {/* Who Can Invite */}
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
            🔗 Who can invite me to circles?
          </h3>
          <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#6B7280" }}>Control circle invitation requests</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {inviteOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateSetting("whoCanInvite", option.value)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: settings.whoCanInvite === option.value ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: settings.whoCanInvite === option.value ? "#F0FDFB" : "#FFFFFF",
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
                {settings.whoCanInvite === option.value && (
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

        {/* Additional Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 16px 8px 16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Additional Options</h3>
          </div>

          {[
            {
              key: "showOnlineStatus",
              label: "Show online status",
              description: "Let others see when you're active",
            },
            { key: "showLastSeen", label: "Show last seen", description: "Display when you were last online" },
            {
              key: "allowVoiceMessages",
              label: "Allow voice messages",
              description: "Receive voice messages from contacts",
            },
            {
              key: "readReceipts",
              label: "Send read receipts",
              description: "Let senders know when you've read messages",
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
              <div>
                <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                  {option.label}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{option.description}</p>
              </div>
              <button
                onClick={() => updateSetting(option.key, !settings[option.key as keyof typeof settings])}
                style={{
                  width: "48px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: settings[option.key as keyof typeof settings] ? "#00C6AE" : "#E5E7EB",
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
                    left: settings[option.key as keyof typeof settings] ? "23px" : "3px",
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
          onClick={() => console.log("Settings saved", settings)}
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
