"use client"

import { useState } from "react"
import { TabBarInline } from "../../../components/TabBar"

export default function LanguageSelectionScreen() {
  const currentLanguage = "en"
  const languages = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "sw", name: "Kiswahili", flag: "🇰🇪" },
    { code: "zh", name: "中文", flag: "🇨🇳" },
  ]

  const [selected, setSelected] = useState(currentLanguage)

  const handleBack = () => {
    console.log("Navigating back...")
  }

  const handleSelectLanguage = (langCode: string) => {
    console.log("Language selected:", langCode)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Language</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {languages.map((lang, idx) => (
            <button
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              style={{
                width: "100%",
                padding: "16px",
                borderBottom: idx < languages.length - 1 ? "1px solid #F5F7FA" : "none",
                background: selected === lang.code ? "#F0FDFB" : "#FFFFFF",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <span style={{ fontSize: "24px" }}>{lang.flag}</span>
                <span style={{ fontSize: "15px", fontWeight: "500", color: "#0A2342" }}>{lang.name}</span>
              </div>
              {selected === lang.code && (
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

      {/* Save Button */}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <button
          onClick={() => handleSelectLanguage(selected)}
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
          Save
        </button>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
