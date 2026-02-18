"use client"

import { useState } from "react"

export default function TransferSettingsScreen() {
  const [formData, setFormData] = useState({
    defaultCountry: { code: "CM", name: "Cameroon", flag: "🇨🇲" },
    defaultMethod: "mobile_money",
    preferredProvider: "mtn",
    defaultAmount: 100,
    autoSaveRecipients: true,
    requireConfirmation: true,
    showRateAlerts: true,
  })

  const countries = [
    { code: "CM", name: "Cameroon", flag: "🇨🇲" },
    { code: "SN", name: "Senegal", flag: "🇸🇳" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  ]

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

  const handleBack = () => console.log("Back")
  const handleSave = () => console.log("Save settings", formData)

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transfer Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Default Destination */}
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
            Default Destination
          </h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {countries.map((country) => (
              <button
                key={country.code}
                onClick={() => setFormData((prev) => ({ ...prev, defaultCountry: country }))}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: formData.defaultCountry.code === country.code ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: formData.defaultCountry.code === country.code ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "20px" }}>{country.flag}</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{country.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default Amount */}
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
            Quick Amount Presets
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Set your most common transfer amount for faster sending
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            {[50, 100, 150, 200].map((amt) => (
              <button
                key={amt}
                onClick={() => setFormData((prev) => ({ ...prev, defaultAmount: amt }))}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: formData.defaultAmount === amt ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: formData.defaultAmount === amt ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Method */}
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
            Preferred Delivery Method
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { id: "mobile_money", label: "Mobile Money", icon: "📱", desc: "Instant delivery" },
              { id: "bank", label: "Bank Transfer", icon: "🏦", desc: "1-2 business days" },
              { id: "cash", label: "Cash Pickup", icon: "💵", desc: "Same day" },
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => setFormData((prev) => ({ ...prev, defaultMethod: method.id }))}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: formData.defaultMethod === method.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: formData.defaultMethod === method.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "20px" }}>{method.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{method.label}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{method.desc}</p>
                </div>
                {formData.defaultMethod === method.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle Settings */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {[
            { key: "autoSaveRecipients", label: "Auto-save recipients", desc: "Save new recipients automatically" },
            {
              key: "requireConfirmation",
              label: "Require confirmation",
              desc: "Always show review screen before sending",
            },
            { key: "showRateAlerts", label: "Rate change alerts", desc: "Notify when rates change significantly" },
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
                onToggle={() => setFormData((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
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
