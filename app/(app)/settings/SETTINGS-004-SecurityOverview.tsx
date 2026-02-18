"use client"

export default function SecurityOverviewScreen() {
  const securityStatus = {
    score: 85,
    passwordStrength: "strong",
    lastPasswordChange: "45 days ago",
    twoFactorEnabled: true,
    twoFactorMethod: "authenticator",
    biometricEnabled: true,
    biometricType: "Face ID",
    activeSessions: 2,
  }

  const getScoreColor = () => {
    if (securityStatus.score >= 80) return "#00C6AE"
    if (securityStatus.score >= 50) return "#D97706"
    return "#DC2626"
  }

  const getScoreLabel = () => {
    if (securityStatus.score >= 80) return "Excellent"
    if (securityStatus.score >= 50) return "Good"
    return "Needs Improvement"
  }

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleChangePassword = () => {
    console.log("Change password")
  }

  const handleManage2FA = () => {
    console.log("Manage 2FA")
  }

  const handleManageBiometrics = () => {
    console.log("Manage biometrics")
  }

  const handleViewSessions = () => {
    console.log("View sessions")
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
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            onClick={handleBack}
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Security</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Keep your account safe</p>
          </div>
        </div>

        {/* Security Score */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              background: `conic-gradient(${getScoreColor()} ${securityStatus.score * 3.6}deg, rgba(255,255,255,0.2) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "#0A2342",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "28px", fontWeight: "700", color: getScoreColor() }}>
                {securityStatus.score}
              </span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>/ 100</span>
            </div>
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "14px", fontWeight: "600", color: getScoreColor() }}>
            {getScoreLabel()}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Password */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={handleChangePassword}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: 0,
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Password</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Last changed {securityStatus.lastPasswordChange}
              </p>
            </div>
            <span
              style={{
                padding: "4px 10px",
                background: securityStatus.passwordStrength === "strong" ? "#F0FDFB" : "#FEF3C7",
                color: securityStatus.passwordStrength === "strong" ? "#00897B" : "#D97706",
                fontSize: "11px",
                fontWeight: "600",
                borderRadius: "6px",
                textTransform: "capitalize",
              }}
            >
              {securityStatus.passwordStrength}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Two-Factor Authentication */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={handleManage2FA}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: 0,
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: securityStatus.twoFactorEnabled ? "#F0FDFB" : "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={securityStatus.twoFactorEnabled ? "#00C6AE" : "#D97706"}
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                Two-Factor Authentication
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                {securityStatus.twoFactorEnabled
                  ? `Enabled via ${securityStatus.twoFactorMethod}`
                  : "Not enabled - recommended"}
              </p>
            </div>
            <span
              style={{
                padding: "4px 10px",
                background: securityStatus.twoFactorEnabled ? "#F0FDFB" : "#FEE2E2",
                color: securityStatus.twoFactorEnabled ? "#00897B" : "#DC2626",
                fontSize: "11px",
                fontWeight: "600",
                borderRadius: "6px",
              }}
            >
              {securityStatus.twoFactorEnabled ? "ON" : "OFF"}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Biometrics */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={handleManageBiometrics}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: 0,
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <path d="M12 1a4 4 0 0 1 4 4v6" />
                <path d="M8 5a4 4 0 0 1 8 0v6" />
                <path d="M1 12v3a10 10 0 0 0 20 0v-3" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Biometric Login</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                {securityStatus.biometricEnabled ? securityStatus.biometricType : "Not set up"}
              </p>
            </div>
            <span
              style={{
                padding: "4px 10px",
                background: securityStatus.biometricEnabled ? "#F0FDFB" : "#F5F7FA",
                color: securityStatus.biometricEnabled ? "#00897B" : "#6B7280",
                fontSize: "11px",
                fontWeight: "600",
                borderRadius: "6px",
              }}
            >
              {securityStatus.biometricEnabled ? "ON" : "OFF"}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Active Sessions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={handleViewSessions}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: 0,
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Active Sessions</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                {securityStatus.activeSessions} device{securityStatus.activeSessions !== 1 ? "s" : ""} logged in
              </p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Security Tips */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
            🔒 Security Tips
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { done: securityStatus.twoFactorEnabled, text: "Enable two-factor authentication" },
              { done: securityStatus.biometricEnabled, text: "Set up biometric login" },
              { done: securityStatus.passwordStrength === "strong", text: "Use a strong, unique password" },
            ].map((tip, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: tip.done ? "#00C6AE" : "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {tip.done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: "12px", color: tip.done ? "#00C6AE" : "rgba(255,255,255,0.7)" }}>
                  {tip.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
