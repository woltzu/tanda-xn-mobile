"use client"

import { useState } from "react"

export default function NotificationSettingsScreen() {
  const [formData, setFormData] = useState({
    transferConfirmed: true,
    transferDelivered: true,
    transferFailed: true,
    rateAlerts: true,
    rateThreshold: 610,
    familyCircleUpdates: true,
    promotions: false,
    weeklyDigest: true,
  })

  const toggleSetting = (key: string) => {
    setFormData((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
  }

  const handleBack = () => console.log("Back")
  const handleSave = () => console.log("Save", formData)

  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      style={{
        width: "52px",
        height: "28px",
        borderRadius: "14px",
        border: "none",
        background: enabled ? "#00C6AE" : "#E5E7EB",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: "#FFFFFF",
          position: "absolute",
          top: "2px",
          left: enabled ? "26px" : "2px",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  )

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header */}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Notifications</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Transfer Notifications */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", background: "#F5F7FA", borderBottom: "1px solid #E5E7EB" }}>
            <h3 style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>TRANSFER UPDATES</h3>
          </div>

          {[
            { key: "transferConfirmed", label: "Transfer confirmed", desc: "When your transfer is processed" },
            { key: "transferDelivered", label: "Money delivered", desc: "When recipient receives the money" },
            { key: "transferFailed", label: "Transfer issues", desc: "If there's a problem with your transfer" },
          ].map((item, idx, arr) => (
            <div
              key={item.key}
              style={{
                padding: "14px 16px",
                borderBottom: idx < arr.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{item.label}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{item.desc}</p>
              </div>
              <Toggle
                enabled={formData[item.key as keyof typeof formData] as boolean}
                onToggle={() => toggleSetting(item.key)}
              />
            </div>
          ))}
        </div>

        {/* Rate Alerts */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", background: "#F5F7FA", borderBottom: "1px solid #E5E7EB" }}>
            <h3 style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>RATE ALERTS</h3>
          </div>

          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #F5F7FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>Rate alerts</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Get notified when rates improve</p>
            </div>
            <Toggle enabled={formData.rateAlerts} onToggle={() => toggleSetting("rateAlerts")} />
          </div>

          {formData.rateAlerts && (
            <div style={{ padding: "14px 16px" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Alert me when rate reaches:</p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "14px", color: "#6B7280" }}>1 USD =</span>
                <input
                  type="number"
                  value={formData.rateThreshold}
                  onChange={(e) => setFormData((prev) => ({ ...prev, rateThreshold: Number(e.target.value) }))}
                  style={{
                    width: "80px",
                    border: "none",
                    background: "transparent",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#0A2342",
                    outline: "none",
                    textAlign: "center",
                  }}
                />
                <span style={{ fontSize: "14px", color: "#6B7280" }}>XAF</span>
              </div>
            </div>
          )}
        </div>

        {/* Other Notifications */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", background: "#F5F7FA", borderBottom: "1px solid #E5E7EB" }}>
            <h3 style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>OTHER</h3>
          </div>

          {[
            {
              key: "familyCircleUpdates",
              label: "Family Circle updates",
              desc: "When members contribute or circle sends",
            },
            { key: "weeklyDigest", label: "Weekly summary", desc: "Your transfer activity digest" },
            { key: "promotions", label: "Promotions & offers", desc: "Special deals and fee discounts" },
          ].map((item, idx, arr) => (
            <div
              key={item.key}
              style={{
                padding: "14px 16px",
                borderBottom: idx < arr.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{item.label}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{item.desc}</p>
              </div>
              <Toggle
                enabled={formData[item.key as keyof typeof formData] as boolean}
                onToggle={() => toggleSetting(item.key)}
              />
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
