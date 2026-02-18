"use client"

export default function PaymentFailedScreen() {
  const errorCode = "ERR_CARD_DECLINED"
  const errorMessage = "Your card was declined by the bank"
  const amount = 100.0

  const handleRetry = () => {
    console.log("Retrying payment...")
    // Retry payment logic
  }

  const handleChangePayment = () => {
    console.log("Changing payment method...")
    // Navigate to payment method selection
  }

  const handleContactSupport = () => {
    console.log("Contacting support...")
    // Navigate to support
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
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "40px 20px",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {/* Error Icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "#DC2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700" }}>Payment Failed</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>
          Your payment of ${amount.toFixed(2)} couldn't be processed
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Error Details */}
        <div
          style={{
            background: "#FEE2E2",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#DC2626" }}>
                {errorMessage}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#B91C1C" }}>Error code: {errorCode}</p>
            </div>
          </div>
        </div>

        {/* Suggestions */}
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
            What you can try
          </h3>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#6B7280", lineHeight: 1.8 }}>
            <li>Check your card details are correct</li>
            <li>Ensure you have sufficient funds</li>
            <li>Try a different payment method</li>
            <li>Contact your bank if the issue persists</li>
          </ul>
        </div>

        {/* Actions */}
        <button
          onClick={handleRetry}
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
            marginBottom: "12px",
          }}
        >
          Try Again
        </button>

        <button
          onClick={handleChangePayment}
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
            marginBottom: "12px",
          }}
        >
          Change Payment Method
        </button>

        <button
          onClick={handleContactSupport}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "500",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          Contact Support
        </button>
      </div>
    </div>
  )
}
