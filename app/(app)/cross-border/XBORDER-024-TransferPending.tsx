"use client"

export default function TransferPendingScreen() {
  const transfer = {
    id: "TXN-2025-0111-78901",
    recipient: { name: "Mama Françoise", flag: "🇨🇲", provider: "MTN MoMo" },
    amount: 200,
    receiveAmount: 121100,
    currency: "XAF",
    status: "pending_delivery",
    estimatedResolution: "within 2 hours",
    reason: "Network congestion at MTN",
  }

  const handleTrack = () => console.log("Track transfer")
  const handleContactSupport = () => console.log("Contact support")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Pending Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #92400E 0%, #B45309 100%)",
          padding: "60px 20px 80px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
            animation: "pulse 2s infinite",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>Transfer in Progress</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Taking a bit longer than usual</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Status Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "2px solid #D97706",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "#D97706" }}>
            {transfer.receiveAmount.toLocaleString()} {transfer.currency}
          </p>
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>
            To {transfer.recipient.name} {transfer.recipient.flag}
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              background: "#FEF3C7",
              borderRadius: "20px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#D97706",
                animation: "pulse 1s infinite",
              }}
            />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#92400E" }}>Pending Delivery</span>
          </div>
        </div>

        {/* What's Happening */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What's Happening
          </h3>
          <div
            style={{
              padding: "14px",
              background: "#FEF3C7",
              borderRadius: "10px",
              marginBottom: "12px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#92400E", lineHeight: 1.5 }}>
              {transfer.reason}. We expect this to resolve {transfer.estimatedResolution}.
            </p>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Your money has left TandaXn and is being processed by {transfer.recipient.provider}. We'll notify you the
            moment {transfer.recipient.name} receives it.
          </p>
        </div>

        {/* Timeline */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Progress</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { label: "Transfer initiated", done: true },
              { label: "Payment confirmed", done: true },
              { label: "Sent to MTN MoMo", done: true },
              { label: "Delivering to Mama", pending: true },
            ].map((step, idx, arr) => (
              <div key={idx} style={{ display: "flex", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: step.done ? "#00C6AE" : step.pending ? "#D97706" : "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {step.done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : step.pending ? (
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFFFFF" }} />
                    ) : null}
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ width: "2px", height: "24px", background: step.done ? "#00C6AE" : "#E5E7EB" }} />
                  )}
                </div>
                <div style={{ paddingTop: "2px", paddingBottom: idx < arr.length - 1 ? "12px" : 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: step.pending ? "600" : "400",
                      color: step.pending ? "#D97706" : "#0A2342",
                    }}
                  >
                    {step.label}
                  </p>
                  {step.pending && (
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#D97706" }}>In progress...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <button
            onClick={handleTrack}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Track</span>
          </button>
          <button
            onClick={handleContactSupport}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Help</span>
          </button>
        </div>

        {/* Tip */}
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
            We'll send you a push notification when {transfer.recipient.name} receives the money. You can safely close
            this screen.
          </p>
        </div>
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
