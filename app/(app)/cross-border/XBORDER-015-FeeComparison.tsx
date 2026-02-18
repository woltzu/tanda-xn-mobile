"use client"

export default function FeeComparisonScreen() {
  const sendAmount = 200
  const destination = { country: "Cameroon", flag: "🇨🇲", currency: "XAF" }
  const comparison = [
    { provider: "TandaXn", fee: 2.99, rate: 605.5, receives: 121100, isBest: true, logo: "🌍" },
    { provider: "Wise", fee: 4.5, rate: 603.2, receives: 119440, isBest: false, logo: "💸" },
    { provider: "Remitly", fee: 3.99, rate: 598.0, receives: 118408, isBest: false, logo: "📱" },
    { provider: "WorldRemit", fee: 4.99, rate: 595.5, receives: 117906, isBest: false, logo: "🌐" },
    { provider: "Western Union", fee: 12.0, rate: 580.0, receives: 112640, isBest: false, logo: "🟡" },
    { provider: "MoneyGram", fee: 10.99, rate: 585.0, receives: 113739, isBest: false, logo: "🔴" },
  ]

  const bestAmount = comparison.find((c) => c.isBest)?.receives || 0
  const worstAmount = comparison[comparison.length - 1]?.receives || 0
  const savings = bestAmount - worstAmount

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Compare Fees</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              Sending ${sendAmount} to {destination.country} {destination.flag}
            </p>
          </div>
        </div>

        {/* Savings Highlight */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#00C6AE" }}>With TandaXn, they get</p>
          <p style={{ margin: "0 0 4px 0", fontSize: "28px", fontWeight: "700" }}>
            {savings.toLocaleString()} {destination.currency} more
          </p>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>vs the most expensive option</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Comparison Table */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: "8px",
              padding: "12px 16px",
              background: "#F5F7FA",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280" }}>PROVIDER</span>
            <span style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", textAlign: "right" }}>FEE</span>
            <span style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", textAlign: "right" }}>RATE</span>
            <span style={{ fontSize: "10px", fontWeight: "600", color: "#6B7280", textAlign: "right" }}>RECEIVES</span>
          </div>

          {/* Providers */}
          {comparison.map((provider, idx) => (
            <div
              key={provider.provider}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: "8px",
                padding: "14px 16px",
                background: provider.isBest ? "#F0FDFB" : "#FFFFFF",
                borderBottom: idx < comparison.length - 1 ? "1px solid #F5F7FA" : "none",
                alignItems: "center",
                position: "relative",
              }}
            >
              {provider.isBest && (
                <div
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "8px",
                    background: "#00C6AE",
                    color: "#FFFFFF",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "8px",
                    fontWeight: "700",
                  }}
                >
                  BEST
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>{provider.logo}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: provider.isBest ? "700" : "500",
                    color: provider.isBest ? "#00897B" : "#0A2342",
                  }}
                >
                  {provider.provider}
                </span>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: provider.isBest ? "#00897B" : "#6B7280",
                  textAlign: "right",
                }}
              >
                ${provider.fee.toFixed(2)}
              </span>
              <span style={{ fontSize: "11px", color: "#6B7280", textAlign: "right" }}>{provider.rate}</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: provider.isBest ? "#00C6AE" : "#0A2342",
                  textAlign: "right",
                }}
              >
                {provider.receives.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p style={{ margin: "16px 0 0 0", fontSize: "10px", color: "#9CA3AF", textAlign: "center", lineHeight: 1.5 }}>
          Rates compared on {new Date().toLocaleDateString()}. Actual rates may vary. All fees shown for standard
          delivery to mobile money.
        </p>
      </div>

      {/* Send Button */}
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
          Send with TandaXn – Best Rate
        </button>
      </div>
    </div>
  )
}
