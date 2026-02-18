"use client"

export default function AccountLockedScreen() {
  const reason = "Too many failed login attempts"

  const handleContactSupport = () => {
    console.log("Contacting support...")
  }

  const handleTryAgain = () => {
    console.log("Trying again later...")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width: "140px",
          height: "140px",
          borderRadius: "50%",
          background: "#FEE2E2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
        }}
      >
        <span style={{ fontSize: "56px" }}>🔒</span>
      </div>

      {/* Content */}
      <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>Account Locked</h2>
      <p style={{ margin: "0 0 16px 0", fontSize: "15px", color: "#6B7280", maxWidth: "300px", lineHeight: 1.6 }}>
        Your account has been temporarily locked for security reasons.
      </p>

      {/* Reason Card */}
      <div
        style={{
          background: "#FEF3C7",
          borderRadius: "12px",
          padding: "14px",
          width: "100%",
          maxWidth: "340px",
          marginBottom: "32px",
        }}
      >
        <p style={{ margin: 0, fontSize: "13px", color: "#92400E" }}>
          <strong>Reason:</strong> {reason}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={handleContactSupport}
        style={{
          width: "100%",
          maxWidth: "340px",
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
        Contact Support
      </button>

      <button
        onClick={handleTryAgain}
        style={{
          background: "none",
          border: "none",
          fontSize: "14px",
          color: "#6B7280",
          cursor: "pointer",
        }}
      >
        Try Again Later
      </button>
    </div>
  )
}
