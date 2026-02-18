"use client"

export default function TransferCompleteScreen() {
  const transfer = {
    id: "TXN-2025-0105-78901",
    recipient: {
      name: "Mama Françoise",
      flag: "🇨🇲",
      phone: "+237 6XX XXX XX45",
      provider: "MTN MoMo",
    },
    sendAmount: 200,
    receiveAmount: 121100,
    currency: "XAF",
    fee: 2.99,
    totalCost: 202.99,
    status: "delivered",
    deliveredAt: "Jan 5, 2025 at 10:47 AM",
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
      {/* Success Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Money Sent! 🎉</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>{transfer.recipient.name} received the money</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Amount Card */}
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
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#6B7280" }}>{transfer.recipient.name} received</p>
          <p style={{ margin: "0 0 4px 0", fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>
            {transfer.receiveAmount.toLocaleString()} {transfer.currency}
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: "#F0FDFB",
              borderRadius: "20px",
              marginTop: "8px",
            }}
          >
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00C6AE" }} />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#00897B" }}>Delivered</span>
          </div>
        </div>

        {/* Recipient & Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
              paddingBottom: "16px",
              borderBottom: "1px solid #F5F7FA",
            }}
          >
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
                📱 {transfer.recipient.provider}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>You sent</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                ${transfer.sendAmount.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Fee</span>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>${transfer.fee.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Total charged</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                ${transfer.totalCost.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid #F5F7FA",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Delivered</span>
              <span style={{ fontSize: "13px", color: "#00897B", fontWeight: "500" }}>{transfer.deliveredAt}</span>
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
            marginBottom: "16px",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Transaction ID</p>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0A2342",
                fontFamily: "monospace",
              }}
            >
              {transfer.id}
            </p>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(transfer.id)}
            style={{
              padding: "6px 12px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "11px",
              color: "#6B7280",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>Track</span>
          </button>
          <button
            style={{
              flex: 1,
              padding: "14px",
              background: "#F0FDFB",
              borderRadius: "12px",
              border: "1px solid #00C6AE",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>Send Again</span>
          </button>
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
          Done
        </button>
      </div>
    </div>
  )
}
