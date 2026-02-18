"use client"

export default function TransferTrackingScreen() {
  const transfer = {
    id: "TXN-2025122900001",
    sendAmount: 200.0,
    receiveAmount: 121100,
    recipient: {
      name: "Mama Kengne",
      phone: "+237 6XX XXX XXX",
      country: "Cameroon",
      flag: "🇨🇲",
      currency: "XAF",
    },
    deliveryMethod: "Mobile Money",
    provider: "MTN Mobile Money",
    status: "processing",
    createdAt: "Dec 29, 2025 3:45 PM",
    estimatedDelivery: "Within minutes",
  }

  const steps = [
    {
      id: "initiated",
      label: "Transfer Initiated",
      time: "3:45 PM",
      status: "completed",
      description: "Payment received",
    },
    {
      id: "processing",
      label: "Processing",
      time: "3:46 PM",
      status: "current",
      description: "Sending to MTN Mobile Money",
    },
    {
      id: "available",
      label: "Available for Pickup",
      time: null,
      status: "pending",
      description: "Funds ready for recipient",
    },
    { id: "completed", label: "Completed", time: null, status: "pending", description: "Recipient received funds" },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#00C6AE"
      case "current":
        return "#0A2342"
      case "pending":
        return "#E5E7EB"
      default:
        return "#E5E7EB"
    }
  }

  const currentStep = steps.find((s) => s.status === "current")
  const completedSteps = steps.filter((s) => s.status === "completed").length
  const progressPercent = ((completedSteps + 0.5) / steps.length) * 100

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleShare = () => {
    console.log("Share tracking link")
  }

  const handleContactSupport = () => {
    console.log("Contact support")
  }

  const handleViewReceipt = () => {
    console.log("View receipt")
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Track Transfer</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8, fontFamily: "monospace" }}>
              {transfer.id}
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
              display: "flex",
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

        {/* Live Status */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#00C6AE",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: "600" }}>{currentStep?.label || "Processing"}</span>
          </div>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>{currentStep?.description}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Amount Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>You sent</p>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                ${transfer.sendAmount.toFixed(2)}
              </p>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>They receive</p>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                {transfer.receiveAmount.toLocaleString()} {transfer.recipient.currency}
              </p>
            </div>
          </div>

          {/* Recipient */}
          <div
            style={{
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "24px" }}>{transfer.recipient.flag}</span>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {transfer.recipient.name}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{transfer.provider}</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Transfer Progress
          </h3>

          <div style={{ position: "relative" }}>
            {steps.map((step, idx) => (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  gap: "14px",
                  marginBottom: idx < steps.length - 1 ? "24px" : 0,
                  position: "relative",
                }}
              >
                {/* Connector Line */}
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "11px",
                      top: "28px",
                      width: "2px",
                      height: "calc(100% + 8px)",
                      background: step.status === "completed" ? "#00C6AE" : "#E5E7EB",
                    }}
                  />
                )}

                {/* Status Circle */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: getStatusColor(step.status),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {step.status === "completed" && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {step.status === "current" && (
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#00C6AE",
                      }}
                    />
                  )}
                </div>

                {/* Step Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: "600",
                        color: step.status === "pending" ? "#9CA3AF" : "#0A2342",
                      }}
                    >
                      {step.label}
                    </p>
                    {step.time && <span style={{ fontSize: "11px", color: "#6B7280" }}>{step.time}</span>}
                  </div>
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: "12px",
                      color: step.status === "pending" ? "#D1D5DB" : "#6B7280",
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estimated Time */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Estimated: {transfer.estimatedDelivery}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>
              We'll notify you when {transfer.recipient.name.split(" ")[0]} receives the money
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleViewReceipt}
            style={{
              flex: 1,
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Receipt
          </button>
          <button
            onClick={handleContactSupport}
            style={{
              flex: 1,
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
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Support
          </button>
        </div>
      </div>

      {/* Bottom - Share Tracking */}
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
          onClick={handleShare}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#0A2342",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
          Share Tracking Link with {transfer.recipient.name.split(" ")[0]}
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
