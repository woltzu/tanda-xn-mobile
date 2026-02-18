"use client"

export default function DeliveryMethodScreen() {
  const recipient = {
    name: "Mama Françoise",
    phone: "+237 6XX XXX XX45",
    deliveryMethod: "mobile_money",
    provider: "MTN MoMo",
    confirmed: true,
    flag: "🇨🇲",
  }

  const amounts = {
    sendAmount: 100,
    receiveAmount: 60550,
    currency: "XAF",
    fee: 2.99,
    totalCost: 102.99,
  }

  const getMethodDisplay = (method: string) => {
    switch (method) {
      case "mobile_money":
        return { name: "Mobile Money", icon: "📱", time: "Within minutes", speed: "Instant" }
      case "bank":
        return { name: "Bank Transfer", icon: "🏦", time: "1-2 business days", speed: "Standard" }
      case "cash":
        return { name: "Cash Pickup", icon: "💵", time: "Same day", speed: "Fast" }
      default:
        return { name: method, icon: "💳", time: "Varies", speed: "" }
    }
  }

  const methodInfo = getMethodDisplay(recipient.deliveryMethod)

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
            onClick={() => console.log("Back")}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Confirm Delivery</h1>
        </div>

        {/* Amount Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>Sending to {recipient.name}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
              {amounts.receiveAmount.toLocaleString()} {amounts.currency}
            </p>
          </div>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            {methodInfo.icon}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Delivery Method Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "2px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
              }}
            >
              {methodInfo.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>{methodInfo.name}</p>
                {methodInfo.speed === "Instant" && (
                  <span
                    style={{
                      padding: "3px 8px",
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      fontSize: "10px",
                      fontWeight: "700",
                      borderRadius: "4px",
                    }}
                  >
                    ⚡ INSTANT
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>{recipient.provider}</p>
            </div>
          </div>

          {/* Delivery Details */}
          <div
            style={{
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Recipient</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{recipient.name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Phone</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{recipient.phone}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Arrives</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#00897B" }}>{methodInfo.time}</span>
            </div>
          </div>

          {/* Change Method Link */}
          <button
            onClick={() => console.log("Change method")}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "10px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: "#6B7280",
              textDecoration: "underline",
            }}
          >
            Change delivery method
          </button>
        </div>

        {/* Cost Summary */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
            Transfer Summary
          </h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>You send</span>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#FFFFFF" }}>${amounts.sendAmount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Transfer fee</span>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#FFFFFF" }}>${amounts.fee.toFixed(2)}</span>
          </div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.2)", margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Total cost</span>
            <span style={{ fontSize: "16px", fontWeight: "700", color: "#FFFFFF" }}>
              ${amounts.totalCost.toFixed(2)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>{recipient.name} receives</span>
            <span style={{ fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
              {amounts.receiveAmount.toLocaleString()} {amounts.currency}
            </span>
          </div>
        </div>

        {/* Info */}
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
            {recipient.name} will receive an SMS notification when the money arrives. No action needed on their end.
          </p>
        </div>
      </div>

      {/* Continue Button */}
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
          onClick={() => console.log("Review & Send")}
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
          Review & Send
        </button>
      </div>
    </div>
  )
}
