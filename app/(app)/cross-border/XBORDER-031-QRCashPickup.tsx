"use client"

export default function QRCashPickupScreen() {
  const transfer = {
    id: "TXN-2025-0111-78901",
    pickupCode: "TXCP-7890-ABCD",
    recipient: { name: "Mama Françoise", flag: "🇨🇲" },
    amount: 121100,
    currency: "XAF",
    agent: {
      name: "Express Money Akwa",
      address: "123 Rue de la Joie, Akwa",
      hours: "8AM - 6PM",
    },
    expiresAt: "Jan 14, 2025",
    status: "ready_for_pickup",
  }

  const handleBack = () => console.log("Back")
  const handleShareCode = () => console.log("Share Code")
  const handleViewAgent = () => console.log("View Agent")
  const handleDone = () => console.log("Done")

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Cash Pickup Code</h1>
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", opacity: 0.8 }}>Ready for pickup</p>
          <p style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "#00C6AE" }}>
            {transfer.amount.toLocaleString()} {transfer.currency}
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
            For {transfer.recipient.name} {transfer.recipient.flag}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* QR Code Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          {/* QR Placeholder */}
          <div
            style={{
              width: "180px",
              height: "180px",
              margin: "0 auto 20px auto",
              background: "#0A2342",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Simulated QR pattern */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "4px",
                padding: "20px",
              }}
            >
              {Array.from({ length: 49 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: "16px",
                    height: "16px",
                    background: Math.random() > 0.4 ? "#FFFFFF" : "transparent",
                    borderRadius: "2px",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                width: "40px",
                height: "40px",
                background: "#00C6AE",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "20px" }}>💵</span>
            </div>
          </div>

          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Pickup Code</p>
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "24px",
              fontWeight: "700",
              fontFamily: "monospace",
              letterSpacing: "3px",
              color: "#0A2342",
            }}
          >
            {transfer.pickupCode}
          </p>

          <button
            onClick={handleShareCode}
            style={{
              padding: "12px 24px",
              background: "#00C6AE",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share with {transfer.recipient.name.split(" ")[0]}
          </button>
        </div>

        {/* Agent Info */}
        <button
          onClick={handleViewAgent}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            🏪
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{transfer.agent.name}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{transfer.agent.address}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#00897B" }}>Open {transfer.agent.hours}</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Instructions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            How to Pick Up
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { num: 1, text: `Share this code with ${transfer.recipient.name.split(" ")[0]}` },
              { num: 2, text: "They visit the agent with a valid ID" },
              { num: 3, text: "Agent scans QR or enters pickup code" },
              { num: 4, text: `${transfer.recipient.name.split(" ")[0]} receives cash!` },
            ].map((step) => (
              <div key={step.num} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "#0A2342",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#FFFFFF",
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Expiry Warning */}
        <div
          style={{
            marginTop: "16px",
            padding: "12px 14px",
            background: "#FEF3C7",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400E" }}>
            Pickup expires: <strong>{transfer.expiresAt}</strong>
          </p>
        </div>
      </div>

      {/* Done Button */}
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
          onClick={handleDone}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "16px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
