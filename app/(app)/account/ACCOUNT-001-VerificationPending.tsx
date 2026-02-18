"use client"

export default function VerificationPendingScreen() {
  const estimatedTime = "24 hours"

  const handleContactSupport = () => {
    console.log("Contacting support...")
  }

  const handleGoHome = () => {
    console.log("Going to home...")
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
          background: "#FEF3C7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
        }}
      >
        <span style={{ fontSize: "56px" }}>⏳</span>
      </div>

      {/* Content */}
      <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
        Verification in Progress
      </h2>
      <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: "#6B7280", maxWidth: "300px", lineHeight: 1.6 }}>
        We're reviewing your documents. This usually takes less than {estimatedTime}.
      </p>

      {/* Status Card */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "20px",
          width: "100%",
          maxWidth: "340px",
          marginBottom: "32px",
          border: "1px solid #E5E7EB",
        }}
      >
        {[
          { label: "Identity Document", status: "reviewing" },
          { label: "Selfie Verification", status: "complete" },
          { label: "Address Check", status: "pending" },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: idx < 2 ? "1px solid #F5F7FA" : "none",
            }}
          >
            <span style={{ fontSize: "14px", color: "#0A2342" }}>{item.label}</span>
            <span
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
                background:
                  item.status === "complete" ? "#F0FDFB" : item.status === "reviewing" ? "#FEF3C7" : "#F5F7FA",
                color: item.status === "complete" ? "#00897B" : item.status === "reviewing" ? "#D97706" : "#6B7280",
              }}
            >
              {item.status === "complete" ? "✓ Complete" : item.status === "reviewing" ? "Reviewing" : "Pending"}
            </span>
          </div>
        ))}
      </div>

      {/* Info */}
      <p style={{ margin: "0 0 32px 0", fontSize: "12px", color: "#9CA3AF" }}>
        We'll notify you as soon as verification is complete
      </p>

      {/* Actions */}
      <button
        onClick={handleGoHome}
        style={{
          width: "100%",
          maxWidth: "340px",
          padding: "16px",
          borderRadius: "14px",
          border: "none",
          background: "#0A2342",
          fontSize: "16px",
          fontWeight: "600",
          color: "#FFFFFF",
          cursor: "pointer",
          marginBottom: "12px",
        }}
      >
        Go to Home
      </button>

      <button
        onClick={handleContactSupport}
        style={{
          background: "none",
          border: "none",
          fontSize: "14px",
          color: "#00897B",
          cursor: "pointer",
        }}
      >
        Contact Support
      </button>
    </div>
  )
}
