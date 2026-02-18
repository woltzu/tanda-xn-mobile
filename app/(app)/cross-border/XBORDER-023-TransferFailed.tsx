"use client"

export default function TransferFailedScreen() {
  const transfer = {
    id: "TXN-2025-0111-FAILED",
    recipient: { name: "Mama Françoise", flag: "🇨🇲" },
    amount: 200,
    error: "recipient_unreachable",
    errorMessage:
      "We couldn't reach Mama's MTN MoMo account. The phone number may be incorrect or the account is temporarily unavailable.",
  }

  const handleRetry = () => console.log("Retry transfer")
  const handleEditRecipient = () => console.log("Edit recipient")
  const handleContactSupport = () => console.log("Contact support")
  const handleDone = () => console.log("Back to home")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Error Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)",
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
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>Transfer Failed</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Don't worry – your money is safe</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Money Safe Card */}
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
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#00897B" }}>
            Your ${transfer.amount} is back in your wallet
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>No money was deducted</p>
        </div>

        {/* Error Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>What Happened</h3>
          <div
            style={{
              padding: "14px",
              background: "#FEF2F2",
              borderRadius: "10px",
              marginBottom: "12px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#7F1D1D", lineHeight: 1.5 }}>{transfer.errorMessage}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              {transfer.recipient.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {transfer.recipient.name} {transfer.recipient.flag}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>${transfer.amount}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What You Can Do
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={handleRetry}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "2px solid #00C6AE",
                background: "#F0FDFB",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <path d="M1 4v6h6" />
                <path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
                <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00897B" }}>Try Again</span>
            </button>
            <button
              onClick={handleEditRecipient}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>Check Recipient Details</span>
            </button>
            <button
              onClick={handleContactSupport}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>Contact Support</span>
            </button>
          </div>
        </div>

        {/* Error ID */}
        <p style={{ margin: "16px 0 0 0", fontSize: "11px", color: "#9CA3AF", textAlign: "center" }}>
          Error ID: {transfer.id}
        </p>
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
          onClick={handleDone}
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
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}
