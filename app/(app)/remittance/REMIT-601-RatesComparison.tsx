"use client"

export default function RatesComparisonScreen() {
  const sendAmount = 200
  const destination = {
    country: "Cameroon",
    flag: "🇨🇲",
    currency: "XAF",
  }

  const providers = [
    {
      id: "tandaxn",
      name: "TandaXn",
      logo: "Xn",
      isTandaXn: true,
      rate: 605.5,
      fee: 2.99,
      receiveAmount: 119107,
      deliveryTime: "Instant",
      rating: 4.9,
    },
    {
      id: "wise",
      name: "Wise",
      logo: "💳",
      isTandaXn: false,
      rate: 601.2,
      fee: 5.49,
      receiveAmount: 116820,
      deliveryTime: "1-2 days",
      rating: 4.7,
    },
    {
      id: "sendwave",
      name: "Sendwave",
      logo: "📲",
      isTandaXn: false,
      rate: 598.0,
      fee: 0,
      receiveAmount: 119600,
      deliveryTime: "Instant",
      rating: 4.5,
    },
    {
      id: "wu",
      name: "Western Union",
      logo: "🟡",
      isTandaXn: false,
      rate: 585.0,
      fee: 12.99,
      receiveAmount: 109395,
      deliveryTime: "Same day",
      rating: 3.8,
    },
    {
      id: "moneygram",
      name: "MoneyGram",
      logo: "🔵",
      isTandaXn: false,
      rate: 590.0,
      fee: 9.99,
      receiveAmount: 112100,
      deliveryTime: "Same day",
      rating: 3.9,
    },
  ]

  const bestAmount = Math.max(...providers.map((p) => p.receiveAmount))
  const tandaxn = providers.find((p) => p.isTandaXn)!
  const worstProvider = providers.reduce((min, p) => (p.receiveAmount < min.receiveAmount ? p : min))
  const savings = tandaxn.receiveAmount - worstProvider.receiveAmount

  const handleBack = () => console.log("Navigate back")
  const handleSelectProvider = (provider: (typeof providers)[0]) => {
    console.log("Selected provider:", provider.name)
  }
  const handleSendWithTandaXn = () => console.log("Send with TandaXn")

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
          padding: "20px 20px 60px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Compare Rates</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Sending ${sendAmount} to {destination.country} {destination.flag}
            </p>
          </div>
        </div>

        {/* Savings Highlight */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "12px",
            padding: "14px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.9 }}>Save up to with TandaXn</p>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
            {savings.toLocaleString()} {destination.currency}
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>vs {worstProvider.name}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-20px", padding: "0 20px" }}>
        {/* Providers List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F5F7FA" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6B7280" }}>
              <span>Provider</span>
              <span>Recipient Gets</span>
            </div>
          </div>

          {providers
            .sort((a, b) => b.receiveAmount - a.receiveAmount)
            .map((provider, idx) => (
              <button
                key={provider.id}
                onClick={() => handleSelectProvider(provider)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderBottom: idx < providers.length - 1 ? "1px solid #F5F7FA" : "none",
                  background: provider.isTandaXn ? "#F0FDFB" : "#FFFFFF",
                  border: provider.isTandaXn ? "2px solid #00C6AE" : "none",
                  borderRadius: provider.isTandaXn ? "0" : "0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                {/* Position */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: idx === 0 ? "#00C6AE" : "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: idx === 0 ? "#FFFFFF" : "#6B7280",
                  }}
                >
                  {idx + 1}
                </div>

                {/* Logo */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: provider.isTandaXn ? "#0A2342" : "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: provider.isTandaXn ? "14px" : "18px",
                    fontWeight: "700",
                    color: provider.isTandaXn ? "#00C6AE" : "#0A2342",
                  }}
                >
                  {provider.logo}
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{provider.name}</p>
                    {provider.isTandaXn && (
                      <span
                        style={{
                          padding: "2px 6px",
                          background: "#00C6AE",
                          color: "#FFFFFF",
                          fontSize: "8px",
                          fontWeight: "700",
                          borderRadius: "4px",
                        }}
                      >
                        BEST VALUE
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                    Fee: ${provider.fee.toFixed(2)} • Rate: {provider.rate} • {provider.deliveryTime}
                  </p>
                </div>

                {/* Amount */}
                <div style={{ textAlign: "right" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: "700",
                      color: provider.receiveAmount === bestAmount ? "#00C6AE" : "#0A2342",
                    }}
                  >
                    {provider.receiveAmount.toLocaleString()}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>{destination.currency}</p>
                </div>
              </button>
            ))}
        </div>

        {/* Disclaimer */}
        <p
          style={{
            margin: "16px 0 0 0",
            fontSize: "10px",
            color: "#9CA3AF",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Rates are indicative and may vary. Last updated: Dec 29, 2025 3:45 PM EST.
          <br />
          Final rate locked at time of transfer.
        </p>
      </div>

      {/* CTA */}
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
          onClick={handleSendWithTandaXn}
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
          Send with TandaXn - Best Rate
        </button>
        <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#6B7280", textAlign: "center" }}>
          💰 {tandaxn.receiveAmount.toLocaleString()} {destination.currency} for ${sendAmount}
        </p>
      </div>
    </div>
  )
}
