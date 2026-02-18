"use client"

export default function TransferDetailsScreen() {
  const transfer = {
    id: "TXN-2025-0105-78901",
    recipient: { name: "Mama Françoise", flag: "🇨🇲", phone: "+237 6XX XXX XX45", provider: "MTN MoMo" },
    sendAmount: 200,
    receiveAmount: 121100,
    currency: "XAF",
    exchangeRate: 605.5,
    fee: 2.99,
    totalCost: 202.99,
    status: "delivered",
    createdAt: "Jan 5, 2025 at 10:45 AM",
    deliveredAt: "Jan 5, 2025 at 10:47 AM",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transfer Details</h1>
        </div>

        {/* Amount & Status */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", opacity: 0.8 }}>Amount Received</p>
          <p style={{ margin: "0 0 8px 0", fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>
            {transfer.receiveAmount.toLocaleString()} {transfer.currency}
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              background: "rgba(0,198,174,0.2)",
              borderRadius: "20px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>Delivered</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Recipient */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>RECIPIENT</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                color: "#FFFFFF",
                fontWeight: "600",
              }}
            >
              {transfer.recipient.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                {transfer.recipient.name} {transfer.recipient.flag}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                📱 {transfer.recipient.provider} • {transfer.recipient.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Transfer Breakdown */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>
            TRANSFER BREAKDOWN
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>You sent</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                ${transfer.sendAmount.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Exchange rate</span>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>
                1 USD = {transfer.exchangeRate} {transfer.currency}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Converted amount</span>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>
                {transfer.receiveAmount.toLocaleString()} {transfer.currency}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Transfer fee</span>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>${transfer.fee.toFixed(2)}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total charged</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                ${transfer.totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>TIMELINE</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Transfer initiated</span>
              <span style={{ fontSize: "12px", color: "#0A2342" }}>{transfer.createdAt}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#00897B", fontWeight: "500" }}>Delivered</span>
              <span style={{ fontSize: "12px", color: "#00897B", fontWeight: "500" }}>{transfer.deliveredAt}</span>
            </div>
          </div>
        </div>

        {/* Transaction ID */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Transaction ID</p>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "11px",
                fontWeight: "500",
                color: "#0A2342",
                fontFamily: "monospace",
              }}
            >
              {transfer.id}
            </p>
          </div>
          <button
            style={{
              padding: "8px 14px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "500",
              color: "#0A2342",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Receipt
          </button>
        </div>
      </div>

      {/* Send Again Button */}
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
          Send Again
        </button>
      </div>
    </div>
  )
}
