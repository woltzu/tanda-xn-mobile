"use client"

export default function ExchangeRatesScreen() {
  const rates = [
    { country: "Cameroon", flag: "🇨🇲", currency: "XAF", rate: 605.5, change: +0.3, fee: 2.99 },
    { country: "Senegal", flag: "🇸🇳", currency: "XOF", rate: 605.5, change: +0.3, fee: 2.99 },
    { country: "Nigeria", flag: "🇳🇬", currency: "NGN", rate: 1550.2, change: -1.2, fee: 3.49 },
    { country: "Kenya", flag: "🇰🇪", currency: "KES", rate: 153.8, change: +0.1, fee: 2.99 },
    { country: "Ghana", flag: "🇬🇭", currency: "GHS", rate: 12.45, change: -0.05, fee: 2.99 },
    { country: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF", rate: 605.5, change: +0.3, fee: 2.99 },
    { country: "Ethiopia", flag: "🇪🇹", currency: "ETB", rate: 56.8, change: +0.2, fee: 3.49 },
    { country: "Tanzania", flag: "🇹🇿", currency: "TZS", rate: 2520, change: -5, fee: 3.49 },
  ]
  const lastUpdated = "2 min ago"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <button
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Exchange Rates</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>Updated {lastUpdated} • 1 USD =</p>
          </div>
        </div>

        {/* Rate Alert Banner */}
        <button
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "rgba(0,198,174,0.2)",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span style={{ flex: 1, textAlign: "left", fontSize: "13px", color: "#FFFFFF" }}>
            Get notified when rates change
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Rates List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "12px",
              padding: "12px 16px",
              background: "#F5F7FA",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280" }}>COUNTRY</span>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280", textAlign: "right" }}>RATE</span>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280", textAlign: "right", width: "60px" }}>
              FEE
            </span>
          </div>

          {/* Rates */}
          {rates.map((rate, idx) => (
            <button
              key={rate.country}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "12px",
                padding: "14px 16px",
                background: "#FFFFFF",
                border: "none",
                borderBottom: idx < rates.length - 1 ? "1px solid #F5F7FA" : "none",
                cursor: "pointer",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>{rate.flag}</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{rate.country}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{rate.currency}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
                  {rate.rate.toLocaleString()}
                </p>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "11px",
                    color: rate.change >= 0 ? "#00C6AE" : "#D97706",
                    fontWeight: "500",
                  }}
                >
                  {rate.change >= 0 ? "+" : ""}
                  {rate.change}%
                </p>
              </div>
              <div style={{ textAlign: "right", width: "60px" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>${rate.fee}</p>
              </div>
            </button>
          ))}
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
            Rates are locked when you confirm your transfer. No hidden fees or markups – what you see is what you get.
          </p>
        </div>
      </div>
    </div>
  )
}
