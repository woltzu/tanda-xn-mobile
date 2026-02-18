"use client"

import { useState } from "react"

export default function NotificationPrefsScreen() {
  const currentPrefs = {
    payments: { push: true, email: true, sms: true },
    payouts: { push: true, email: true, sms: true },
    circles: { push: true, email: false, sms: false },
    goals: { push: true, email: false, sms: false },
    marketing: { push: false, email: false, sms: false },
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
  }

  const [prefs, setPrefs] = useState(currentPrefs)

  const categories = [
    {
      id: "payments",
      icon: "💳",
      title: "Payments & Contributions",
      description: "Payment reminders, confirmations",
    },
    {
      id: "payouts",
      icon: "💰",
      title: "Payouts",
      description: "Payout notifications, receipts",
    },
    {
      id: "circles",
      icon: "👥",
      title: "Circle Activity",
      description: "New members, updates, messages",
    },
    {
      id: "goals",
      icon: "🎯",
      title: "Goals & Savings",
      description: "Progress updates, milestones",
    },
    {
      id: "marketing",
      icon: "📣",
      title: "News & Offers",
      description: "Features, promotions, tips",
    },
  ]

  const togglePref = (category: string, channel: string) => {
    setPrefs((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [channel]: !prev[category as keyof typeof prev][channel as keyof typeof prev.payments],
      },
    }))
  }

  const toggleQuietHours = () => {
    setPrefs((prev) => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        enabled: !prev.quietHours.enabled,
      },
    }))
  }

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSave = () => {
    console.log("Save preferences:", prefs)
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Notifications</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Choose how we reach you</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Channel Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "16px",
            marginBottom: "12px",
            paddingRight: "8px",
          }}
        >
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", width: "40px", textAlign: "center" }}>
            Push
          </span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", width: "40px", textAlign: "center" }}>
            Email
          </span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", width: "40px", textAlign: "center" }}>
            SMS
          </span>
        </div>

        {/* Categories */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              style={{
                padding: "16px",
                borderBottom: idx < categories.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "22px" }}>{cat.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{cat.title}</p>
                <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{cat.description}</p>
              </div>

              {/* Channel Toggles */}
              <div style={{ display: "flex", gap: "16px" }}>
                {["push", "email", "sms"].map((channel) => (
                  <button
                    key={channel}
                    onClick={() => togglePref(cat.id, channel)}
                    style={{
                      width: "40px",
                      height: "26px",
                      borderRadius: "13px",
                      border: "none",
                      background: prefs[cat.id as keyof typeof prefs][channel as keyof typeof prefs.payments]
                        ? "#00C6AE"
                        : "#E5E7EB",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "#FFFFFF",
                        position: "absolute",
                        top: "3px",
                        left: prefs[cat.id as keyof typeof prefs][channel as keyof typeof prefs.payments]
                          ? "17px"
                          : "3px",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quiet Hours */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: prefs.quietHours.enabled ? "16px" : 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "22px" }}>🌙</span>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Quiet Hours</p>
                <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                  Pause notifications while you sleep
                </p>
              </div>
            </div>
            <button
              onClick={toggleQuietHours}
              style={{
                width: "52px",
                height: "32px",
                borderRadius: "16px",
                border: "none",
                background: prefs.quietHours.enabled ? "#00C6AE" : "#E5E7EB",
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
                  left: prefs.quietHours.enabled ? "23px" : "3px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>

          {prefs.quietHours.enabled && (
            <div
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "10px", color: "#6B7280" }}>From</p>
                <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                  {prefs.quietHours.start}
                </p>
              </div>
              <div style={{ flex: 1, height: "2px", background: "#E5E7EB", margin: "0 16px" }}>
                <div style={{ width: "50%", height: "100%", background: "#0A2342" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "10px", color: "#6B7280" }}>Until</p>
                <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                  {prefs.quietHours.end}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
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
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Payment and payout notifications are essential and cannot be fully disabled to ensure you don't miss
            important updates.
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
          Save Preferences
        </button>
      </div>
    </div>
  )
}
