"use client"

export default function CashPickupInstructionsScreen() {
  const transfer = {
    id: "TXN-2025122900001",
    receiveAmount: 121100,
    currency: "XAF",
    securityCode: "TANDX-847291",
    expiresAt: "Jan 5, 2026",
  }

  const recipient = {
    name: "Mama Kengne",
    phone: "+237 6XX XXX XXX",
    country: "Cameroon",
    flag: "🇨🇲",
  }

  const pickupNetwork = "Express Union"

  const requiredDocuments = [
    { id: "id", name: "Valid Government ID", description: "Passport, National ID, or Driver's License", icon: "🪪" },
    { id: "code", name: "Security Code", description: "Show the code from this screen", icon: "🔐" },
    { id: "phone", name: "Phone Number", description: "The number registered for this transfer", icon: "📱" },
  ]

  const steps = [
    { number: 1, title: "Find an Agent", description: "Locate the nearest Express Union or authorized agent" },
    { number: 2, title: "Show ID & Code", description: "Present your valid ID and the security code" },
    { number: 3, title: "Verify Details", description: "Agent will verify your identity and transfer details" },
    { number: 4, title: "Receive Cash", description: "Count your money before leaving the agent location" },
  ]

  const handleBack = () => console.log("Navigate back")
  const handleFindAgent = () => console.log("Find agent")
  const handleShare = () => console.log("Share instructions")
  const handleCopyCode = () => {
    navigator.clipboard.writeText(transfer.securityCode)
    console.log("Code copied")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Cash Pickup Guide</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              For {recipient.name} {recipient.flag}
            </p>
          </div>
          <button
            onClick={handleShare}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>

        {/* Amount & Network */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Amount to collect</p>
          <p style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
            {transfer.receiveAmount.toLocaleString()} {transfer.currency}
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "rgba(0,198,174,0.2)",
              borderRadius: "20px",
            }}
          >
            <span style={{ fontSize: "12px" }}>🏪</span>
            <span style={{ fontSize: "12px" }}>{pickupNetwork}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Security Code Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "2px solid #00C6AE",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "24px" }}>🔐</span>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Security Code</h3>
          </div>

          <div
            style={{
              padding: "16px",
              background: "#F0FDFB",
              borderRadius: "12px",
              marginBottom: "12px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: "700",
                fontFamily: "monospace",
                letterSpacing: "4px",
                color: "#0A2342",
              }}
            >
              {transfer.securityCode}
            </p>
          </div>

          <button
            onClick={handleCopyCode}
            style={{
              padding: "10px 20px",
              background: "#0A2342",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Code
          </button>

          <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Valid until {transfer.expiresAt}</p>
        </div>

        {/* Required Documents */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            📋 What to Bring
          </h3>

          {requiredDocuments.map((doc, idx) => (
            <div
              key={doc.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                marginBottom: idx < requiredDocuments.length - 1 ? "10px" : 0,
              }}
            >
              <span style={{ fontSize: "24px" }}>{doc.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{doc.name}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{doc.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pickup Steps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            How to Pick Up
          </h3>

          {steps.map((step, idx) => (
            <div
              key={step.number}
              style={{
                display: "flex",
                gap: "14px",
                marginBottom: idx < steps.length - 1 ? "16px" : 0,
                position: "relative",
              }}
            >
              {/* Connector Line */}
              {idx < steps.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: "15px",
                    top: "36px",
                    width: "2px",
                    height: "calc(100% - 16px)",
                    background: "#E5E7EB",
                  }}
                />
              )}

              {/* Step Number */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {step.number}
              </div>

              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{step.title}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Safety Tips */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>⚠️ Safety Tips</h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              fontSize: "12px",
              color: "#B45309",
              lineHeight: 1.6,
            }}
          >
            <li>Only share the security code with the agent</li>
            <li>Count your money before leaving</li>
            <li>Never pay extra fees beyond what's shown</li>
            <li>Report any issues to TandaXn support</li>
          </ul>
        </div>
      </div>

      {/* Bottom CTAs */}
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
          onClick={handleFindAgent}
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
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          📍 Find Nearby Agent
        </button>
        <button
          onClick={handleShare}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "500",
            color: "#0A2342",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share Instructions with {recipient.name.split(" ")[0]}
        </button>
      </div>
    </div>
  )
}
