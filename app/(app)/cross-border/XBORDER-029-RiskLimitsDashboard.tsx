"use client"

export default function RiskLimitsDashboardScreen() {
  const user = {
    name: "Franck Ndong",
    email: "franck@example.com",
    riskScore: 25,
    riskLevel: "low",
    verificationLevel: "enhanced",
    accountAge: "8 months",
    totalSent: 4850,
    avgTransaction: 180,
  }

  const limits = {
    perTransaction: { current: 10000, used: 0 },
    daily: { current: 25000, used: 450 },
    monthly: { current: 100000, used: 1850 },
  }

  const flags: Array<{ title: string; description: string; severity: string }> = []

  const handleBack = () => console.log("Back")
  const handleAdjustLimits = () => console.log("Adjust Limits")
  const handleViewActivity = () => console.log("View Activity")

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "#00C6AE"
      case "medium":
        return "#D97706"
      case "high":
        return "#DC2626"
      default:
        return "#6B7280"
    }
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
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Risk & Limits</h1>
        </div>

        {/* User Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: "600",
            }}
          >
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>{user.name}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.8 }}>{user.email}</p>
          </div>
          <div
            style={{
              padding: "6px 12px",
              background: getRiskColor(user.riskLevel),
              borderRadius: "6px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>
              {user.riskLevel} RISK
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Risk Score */}
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
            Risk Assessment
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: `conic-gradient(${getRiskColor(user.riskLevel)} ${user.riskScore}%, #E5E7EB ${user.riskScore}%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{user.riskScore}</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Verification</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                  {user.verificationLevel.charAt(0).toUpperCase() + user.verificationLevel.slice(1)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Account Age</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>{user.accountAge}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Total Sent</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                  ${user.totalSent.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Limits */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Transfer Limits</h3>
            <button
              onClick={handleAdjustLimits}
              style={{
                padding: "6px 12px",
                background: "#F5F7FA",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              Adjust
            </button>
          </div>

          {Object.entries(limits).map(([key, limit]) => {
            const percent = (limit.used / limit.current) * 100
            const label = key === "perTransaction" ? "Per Transaction" : key.charAt(0).toUpperCase() + key.slice(1)
            return (
              <div key={key} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{label}</span>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                    ${limit.used.toLocaleString()} / ${limit.current.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: "6px", background: "#E5E7EB", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(percent, 100)}%`,
                      background: percent > 80 ? "#D97706" : "#00C6AE",
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Flags */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Risk Flags</h3>
          {flags.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {flags.map((flag, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px",
                    background: flag.severity === "high" ? "#FEF2F2" : "#FEF3C7",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>{flag.severity === "high" ? "🚨" : "⚠️"}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{flag.title}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{flag.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "20px",
                background: "#F0FDFB",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "24px" }}>✓</span>
              <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#065F46" }}>No risk flags detected</p>
            </div>
          )}
        </div>

        {/* View Activity */}
        <button
          onClick={handleViewActivity}
          style={{
            width: "100%",
            padding: "14px",
            marginTop: "16px",
            background: "#0A2342",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>View Transaction History</span>
        </button>
      </div>
    </div>
  )
}
