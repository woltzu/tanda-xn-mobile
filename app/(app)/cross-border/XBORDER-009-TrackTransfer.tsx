"use client"

export default function TrackTransferScreen() {
  const transfer = {
    id: "TXN-2025-0105-78901",
    recipient: {
      name: "Mama Françoise",
      flag: "🇨🇲",
      provider: "MTN MoMo",
    },
    sendAmount: 200,
    receiveAmount: 121100,
    currency: "XAF",
    status: "delivered",
    timeline: [
      {
        id: 1,
        title: "Transfer initiated",
        time: "10:45 AM",
        status: "complete",
        description: "You sent $200.00",
      },
      {
        id: 2,
        title: "Payment confirmed",
        time: "10:45 AM",
        status: "complete",
        description: "Funds deducted from wallet",
      },
      {
        id: 3,
        title: "Currency converted",
        time: "10:46 AM",
        status: "complete",
        description: "$200 → 121,100 XAF",
      },
      {
        id: 4,
        title: "Sent to MTN MoMo",
        time: "10:46 AM",
        status: "complete",
        description: "Processing with provider",
      },
      {
        id: 5,
        title: "Delivered",
        time: "10:47 AM",
        status: "complete",
        description: "Mama Françoise received the money",
      },
    ],
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "#00C6AE"
      case "processing":
        return "#D97706"
      case "failed":
        return "#DC2626"
      default:
        return "#6B7280"
    }
  }

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Track Transfer</h1>
        </div>

        {/* Status Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: getStatusColor(transfer.status),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {transfer.status === "delivered" ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", textTransform: "capitalize" }}>
              {transfer.status === "delivered" ? "Delivered ✓" : transfer.status}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {transfer.receiveAmount.toLocaleString()} {transfer.currency} to {transfer.recipient.name}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Timeline */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Transfer Timeline
          </h3>
          <div>
            {transfer.timeline.map((event, idx) => (
              <div key={event.id} style={{ display: "flex", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background:
                        event.status === "complete" ? "#00C6AE" : event.status === "active" ? "#FEF3C7" : "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {event.status === "complete" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: event.status === "active" ? "#D97706" : "#D1D5DB",
                        }}
                      />
                    )}
                  </div>
                  {idx < transfer.timeline.length - 1 && (
                    <div
                      style={{
                        width: "2px",
                        flex: 1,
                        minHeight: "40px",
                        background: event.status === "complete" ? "#00C6AE" : "#E5E7EB",
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: idx < transfer.timeline.length - 1 ? "20px" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{event.title}</p>
                    <span style={{ fontSize: "11px", color: "#6B7280" }}>{event.time}</span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transfer Details */}
        <div
          style={{
            marginTop: "16px",
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Transfer Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Transaction ID</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "#0A2342",
                  fontFamily: "monospace",
                }}
              >
                {transfer.id}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Recipient</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                {transfer.recipient.name} {transfer.recipient.flag}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Payment method</span>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>{transfer.recipient.provider}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>You sent</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>${transfer.sendAmount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>They received</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>
                {transfer.receiveAmount.toLocaleString()} {transfer.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Help */}
        <button
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>Need help with this transfer?</span>
        </button>
      </div>
    </div>
  )
}
