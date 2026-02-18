"use client"

export default function TransferProcessingScreen() {
  const recipient = {
    name: "Mama Françoise",
    flag: "🇨🇲",
  }

  const amount = {
    receive: 121100,
    currency: "XAF",
  }

  const steps = [
    { id: 1, label: "Verifying transfer", status: "complete" },
    { id: 2, label: "Converting currency", status: "complete" },
    { id: 3, label: "Sending to MTN MoMo", status: "active" },
    { id: 4, label: "Confirming delivery", status: "pending" },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "60px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Animated Icon */}
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "rgba(0,198,174,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
          animation: "pulse 2s infinite",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "#00C6AE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
      </div>

      <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "#FFFFFF", textAlign: "center" }}>
        Sending Money...
      </h1>
      <p style={{ margin: "0 0 32px 0", fontSize: "15px", color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
        {amount.receive.toLocaleString()} {amount.currency} to {recipient.name} {recipient.flag}
      </p>

      {/* Progress Steps */}
      <div
        style={{
          width: "100%",
          maxWidth: "320px",
          background: "rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        {steps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              marginBottom: idx < steps.length - 1 ? "20px" : 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background:
                    step.status === "complete"
                      ? "#00C6AE"
                      : step.status === "active"
                        ? "rgba(0,198,174,0.3)"
                        : "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: step.status === "active" ? "2px solid #00C6AE" : "none",
                }}
              >
                {step.status === "complete" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : step.status === "active" ? (
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      animation: "pulse 1s infinite",
                    }}
                  />
                ) : (
                  <div
                    style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(255,255,255,0.4)" }}
                  />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  style={{
                    width: "2px",
                    height: "20px",
                    background: step.status === "complete" ? "#00C6AE" : "rgba(255,255,255,0.2)",
                    marginTop: "4px",
                  }}
                />
              )}
            </div>
            <div style={{ paddingTop: "4px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: step.status === "active" ? "600" : "400",
                  color: step.status === "pending" ? "rgba(255,255,255,0.5)" : "#FFFFFF",
                }}
              >
                {step.label}
              </p>
              {step.status === "active" && (
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#00C6AE" }}>In progress...</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p style={{ margin: "32px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        Please don't close this screen
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
