"use client"

import { useState } from "react"

export default function CurrencySettingsScreen() {
  const availableCurrencies = [
    { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
    { code: "XAF", name: "Central African CFA", symbol: "FCFA", flag: "🇨🇲" },
    { code: "XOF", name: "West African CFA", symbol: "FCFA", flag: "🇸🇳" },
    { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
    { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
    { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", flag: "🇬🇭" },
    { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  ]

  const exchangeRates: { [key: string]: number } = {
    XAF: 605.5,
    XOF: 605.5,
    KES: 153.25,
    NGN: 1550.0,
    GHS: 12.5,
    EUR: 0.92,
  }

  const [displayCurrency, setDisplayCurrency] = useState("USD")
  const [payoutCurrency, setPayoutCurrency] = useState("USD")
  const [autoConvert, setAutoConvert] = useState(false)
  const [showDisplayPicker, setShowDisplayPicker] = useState(false)
  const [showPayoutPicker, setShowPayoutPicker] = useState(false)

  const getRate = (code: string) => (code === "USD" ? 1 : exchangeRates[code] || 1)
  const displayCurrencyData = availableCurrencies.find((c) => c.code === displayCurrency)
  const payoutCurrencyData = availableCurrencies.find((c) => c.code === payoutCurrency)

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSave = () => {
    console.log("Save settings:", { displayCurrency, payoutCurrency, autoConvert })
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Currency Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Display Currency */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Display Currency
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>How amounts are shown in the app</p>
          <button
            onClick={() => setShowDisplayPicker(!showDisplayPicker)}
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
            <span style={{ fontSize: "24px" }}>{displayCurrencyData?.flag}</span>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {displayCurrencyData?.name}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{displayCurrencyData?.code}</p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showDisplayPicker && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {availableCurrencies.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => {
                    setDisplayCurrency(currency.code)
                    setShowDisplayPicker(false)
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: displayCurrency === currency.code ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "10px",
                    border: displayCurrency === currency.code ? "2px solid #00C6AE" : "1px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{currency.flag}</span>
                  <span style={{ flex: 1, textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                    {currency.name}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{currency.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payout Currency */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Payout Currency
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Currency for withdrawals (conversion at day-of rate)
          </p>
          <button
            onClick={() => setShowPayoutPicker(!showPayoutPicker)}
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
            <span style={{ fontSize: "24px" }}>{payoutCurrencyData?.flag}</span>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {payoutCurrencyData?.name}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{payoutCurrencyData?.code}</p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showPayoutPicker && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {availableCurrencies.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => {
                    setPayoutCurrency(currency.code)
                    setShowPayoutPicker(false)
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: payoutCurrency === currency.code ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "10px",
                    border: payoutCurrency === currency.code ? "2px solid #00C6AE" : "1px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{currency.flag}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{currency.name}</span>
                    {currency.code !== "USD" && (
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                        $1 = {currency.symbol}
                        {getRate(currency.code).toLocaleString()}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Exchange Rate Preview */}
        {payoutCurrency !== "USD" && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Current Rate</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>
                  $1 = {payoutCurrencyData?.symbol}
                  {getRate(payoutCurrency).toLocaleString()}
                </p>
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(0,198,174,0.2)",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>Live Rate</span>
              </div>
            </div>
            <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
              Rates are locked at the time of withdrawal. TandaXn covers FX spread.
            </p>
          </div>
        )}

        {/* Auto-Convert Toggle */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Auto-Convert Payouts</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Automatically convert to your payout currency
              </p>
            </div>
            <button
              onClick={() => setAutoConvert(!autoConvert)}
              style={{
                width: "52px",
                height: "32px",
                borderRadius: "16px",
                border: "none",
                background: autoConvert ? "#00C6AE" : "#E5E7EB",
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
                  left: autoConvert ? "23px" : "3px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>
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
