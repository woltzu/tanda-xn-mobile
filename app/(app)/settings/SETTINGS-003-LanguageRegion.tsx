"use client"

import { useState } from "react"

export default function LanguageRegionScreen() {
  const currentSettings = {
    language: "en",
    currency: "USD",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
  }

  const languages = [
    { code: "en", name: "English", native: "English", flag: "🇺🇸" },
    { code: "fr", name: "French", native: "Français", flag: "🇫🇷" },
    { code: "sw", name: "Swahili", native: "Kiswahili", flag: "🇰🇪" },
    { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸" },
    { code: "zh", name: "Chinese", native: "中文", flag: "🇨🇳" },
  ]

  const currencies = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "XAF", symbol: "FCFA", name: "CFA Franc" },
    { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
    { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  ]

  const [language, setLanguage] = useState(currentSettings.language)
  const [currency, setCurrency] = useState(currentSettings.currency)
  const [showLanguages, setShowLanguages] = useState(false)
  const [showCurrencies, setShowCurrencies] = useState(false)

  const selectedLang = languages.find((l) => l.code === language)
  const selectedCurr = currencies.find((c) => c.code === currency)
  const hasChanges = language !== currentSettings.language || currency !== currentSettings.currency

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSave = () => {
    console.log("Save changes:", { language, currency })
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Language & Region</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Customize your experience</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Language Selection */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>App Language</h3>

          <button
            onClick={() => setShowLanguages(!showLanguages)}
            style={{
              width: "100%",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "24px" }}>{selectedLang?.flag}</span>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{selectedLang?.name}</p>
              <p style={{ margin: "1px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{selectedLang?.native}</p>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              style={{ transform: showLanguages ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showLanguages && (
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code)
                    setShowLanguages(false)
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: language === lang.code ? "#F0FDFB" : "#FFFFFF",
                    borderRadius: "10px",
                    border: language === lang.code ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{lang.flag}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{lang.name}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{lang.native}</p>
                  </div>
                  {language === lang.code && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Currency Selection */}
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
            Display Currency
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>How amounts are shown in the app</p>

          <button
            onClick={() => setShowCurrencies(!showCurrencies)}
            style={{
              width: "100%",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                color: "#FFFFFF",
                fontWeight: "700",
              }}
            >
              {selectedCurr?.symbol}
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{selectedCurr?.code}</p>
              <p style={{ margin: "1px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{selectedCurr?.name}</p>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              style={{ transform: showCurrencies ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showCurrencies && (
            <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {currencies.map((curr) => (
                <button
                  key={curr.code}
                  onClick={() => {
                    setCurrency(curr.code)
                    setShowCurrencies(false)
                  }}
                  style={{
                    padding: "12px",
                    background: currency === curr.code ? "#F0FDFB" : "#FFFFFF",
                    borderRadius: "10px",
                    border: currency === curr.code ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 2px 0",
                      fontSize: "18px",
                      fontWeight: "700",
                      color: currency === curr.code ? "#00C6AE" : "#0A2342",
                    }}
                  >
                    {curr.symbol}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{curr.code}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info Note */}
        <div
          style={{
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
            All transactions are processed in USD. The display currency is for your convenience only and converted using
            live exchange rates.
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
          disabled={!hasChanges}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: hasChanges ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: hasChanges ? "#FFFFFF" : "#9CA3AF",
            cursor: hasChanges ? "pointer" : "not-allowed",
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}
