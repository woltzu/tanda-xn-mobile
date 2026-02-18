"use client"

export default function MobileMoneySelectionScreen() {
  const country = { name: "Cameroon", flag: "🇨🇲", currency: "XAF" }
  const providers = [
    {
      id: "mtn",
      name: "MTN Mobile Money",
      logo: "🟡",
      speed: "Instant",
      popularity: "Most popular",
      prefix: "+237 6",
      fee: 0,
      maxAmount: 500000,
    },
    {
      id: "orange",
      name: "Orange Money",
      logo: "🟠",
      speed: "Instant",
      popularity: "Popular",
      prefix: "+237 6",
      fee: 0,
      maxAmount: 500000,
    },
    {
      id: "express",
      name: "Express Union Mobile",
      logo: "🔵",
      speed: "Within 1 hour",
      popularity: "",
      prefix: "+237",
      fee: 0,
      maxAmount: 1000000,
    },
  ]

  const handleBack = () => console.log("Back")
  const handleSelectProvider = (provider: any) => console.log("Selected:", provider.name)

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Mobile Money</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {country.name} {country.flag}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#6B7280" }}>
          Select the recipient's mobile money provider
        </p>

        {/* Providers */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {providers.map((provider, idx) => (
            <button
              key={provider.id}
              onClick={() => handleSelectProvider(provider)}
              style={{
                width: "100%",
                padding: "16px",
                background: "#FFFFFF",
                borderRadius: "14px",
                border: idx === 0 ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
              }}
            >
              {provider.popularity && (
                <span
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "12px",
                    padding: "2px 8px",
                    background: idx === 0 ? "#00C6AE" : "#6B7280",
                    color: "#FFFFFF",
                    fontSize: "9px",
                    fontWeight: "700",
                    borderRadius: "4px",
                  }}
                >
                  {provider.popularity.toUpperCase()}
                </span>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "12px",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                  }}
                >
                  {provider.logo}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{provider.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span style={{ fontSize: "11px", color: "#00897B" }}>{provider.speed}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#6B7280" }}>
                      Max: {provider.maxAmount.toLocaleString()} {country.currency}
                    </span>
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Info */}
        <div
          style={{
            marginTop: "20px",
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
          <div>
            <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
              <strong>No extra fees!</strong> Mobile money transfers are included in your transfer fee. The recipient
              will receive the full amount.
            </p>
          </div>
        </div>

        {/* Not sure? */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
            <strong>Not sure which provider?</strong> Ask your recipient which mobile money app they use, or check the
            first digits of their phone number.
          </p>
        </div>
      </div>
    </div>
  )
}
