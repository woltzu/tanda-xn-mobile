"use client"

export default function TransferSuccessScreen() {
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
    estimatedDelivery: "Within minutes",
    timestamp: "Dec 29, 2025 at 3:45 PM",
  }

  const handleDone = () => {
    console.log("Done")
  }

  const handleSendAnother = () => {
    console.log("Send another transfer")
  }

  const handleViewDetails = () => {
    console.log("View transfer details")
  }

  const handleShare = () => {
    console.log("Share receipt")
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
      {/* Header - Navy with Teal Success Elements */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "40px 20px 80px 20px",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {/* Success Checkmark - Teal */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "#00C6AE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
            boxShadow: "0 4px 20px rgba(0,198,174,0.4)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>Money Sent!</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>
          Your transfer is on its way to {transfer.recipient.name}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Amount Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px 20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              marginBottom: "16px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>You sent</p>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                ${transfer.sendAmount.toFixed(2)}
              </p>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>They receive</p>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                {transfer.receiveAmount.toLocaleString()} {transfer.recipient.currency}
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px",
              background: "#F0FDFB",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>{transfer.recipient.flag}</span>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#00897B" }}>
              {transfer.recipient.name} • {transfer.provider}
            </span>
          </div>
        </div>

        {/* Transfer Details */}
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
            Transfer Details
          </h3>

          {[
            { label: "Transaction ID", value: transfer.id, mono: true },
            { label: "Recipient phone", value: transfer.recipient.phone },
            { label: "Delivery method", value: transfer.deliveryMethod },
            { label: "Status", value: "Processing", highlight: true },
            { label: "Estimated delivery", value: transfer.estimatedDelivery },
            { label: "Date & time", value: transfer.timestamp },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: idx < 5 ? "1px solid #F5F7FA" : "none",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>{item.label}</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: item.highlight ? "#00897B" : "#0A2342",
                  fontFamily: item.mono ? "monospace" : "inherit",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Notification Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>📲</span>
            <div>
              <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                We'll notify you
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#065F46" }}>
                You'll receive a notification when {transfer.recipient.name} picks up the money
              </p>
            </div>
          </div>
        </div>

        {/* Share Button */}
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
          Share Receipt
        </button>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={handleSendAnother}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          Send Another
        </button>
        <button
          onClick={handleDone}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "#00C6AE",
            fontSize: "14px",
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
