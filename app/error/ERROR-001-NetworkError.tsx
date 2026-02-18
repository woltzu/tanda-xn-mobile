"use client"

export default function NetworkErrorScreen() {
  const handleRetry = () => {
    console.log("Retrying connection...")
    // Reload the page or retry the failed request
    window.location.reload()
  }

  const handleGoHome = () => {
    console.log("Going home...")
    // Navigate to home
    window.location.href = "/"
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
        <span style={{ fontSize: "56px" }}>📡</span>
      </div>

      {/* Content */}
      <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>No Connection</h2>
      <p
        style={{
          margin: "0 0 32px 0",
          fontSize: "15px",
          color: "#6B7280",
          maxWidth: "280px",
          lineHeight: 1.6,
        }}
      >
        We couldn't connect to the internet. Please check your connection and try again.
      </p>

      {/* Actions */}
      <button
        onClick={handleRetry}
        style={{
          width: "100%",
          maxWidth: "300px",
          padding: "16px",
          borderRadius: "14px",
          border: "none",
          background: "#00C6AE",
          fontSize: "16px",
          fontWeight: "600",
          color: "#FFFFFF",
          cursor: "pointer",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Try Again
      </button>

      <button
        onClick={handleGoHome}
        style={{
          background: "none",
          border: "none",
          fontSize: "14px",
          color: "#6B7280",
          cursor: "pointer",
        }}
      >
        Go Back Home
      </button>
    </div>
  )
}
