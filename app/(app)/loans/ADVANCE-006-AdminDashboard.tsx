"use client"

export default function AdminDashboardScreen() {
  const portfolioHealth = {
    totalAdvanced: 125000,
    totalOutstanding: 48500,
    totalRepaid: 76500,
    defaultRate: 2.3,
    collectionsEfficiency: 97.2,
    activeAdvances: 156,
    averageAdvanceSize: 312,
  }

  const regionMetrics = [
    { region: "USA", defaultRate: 1.8, riskFactor: 1.0, advances: 89, status: "healthy" },
    { region: "Nigeria", defaultRate: 3.2, riskFactor: 2.5, advances: 34, status: "monitoring" },
    { region: "Bangladesh", defaultRate: 4.5, riskFactor: 3.0, advances: 21, status: "warning" },
    { region: "Ghana", defaultRate: 2.1, riskFactor: 2.0, advances: 12, status: "healthy" },
  ]

  const calibrationLogs = [
    { date: "Jan 20, 2025", action: "Risk factor +0.5%", region: "Bangladesh", reason: "Default rate above 4%" },
    { date: "Jan 18, 2025", action: "Base rate -0.2%", region: "USA", reason: "Strong repayment performance" },
    { date: "Jan 15, 2025", action: "Max advance lowered", region: "Nigeria", reason: "New user segment launch" },
  ]

  const profitability = {
    platformReturnRate: 11.2,
    saverReturnsAvg: 8.5,
    netMargin: 2.7,
    revenueThisMonth: 4250,
    projectedAnnual: 51000,
  }

  const alerts = [
    {
      type: "warning",
      message: "Bangladesh default rate rising - consider increasing risk premium",
      time: "2 hours ago",
    },
    { type: "info", message: "156 active advances, 23 due this week", time: "Today" },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "#00C6AE"
      case "monitoring":
        return "#D97706"
      case "warning":
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
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Admin Dashboard</h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Advance Portfolio Monitoring</p>
            </div>
          </div>
          <button
            onClick={() => console.log("Export Report")}
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        </div>

        {/* Key Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>
              ${(portfolioHealth.totalAdvanced / 1000).toFixed(0)}K
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.8 }}>Total Advanced</p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
              {portfolioHealth.defaultRate}%
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.8 }}>Default Rate</p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{portfolioHealth.collectionsEfficiency}%</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.8 }}>Collection Rate</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Alerts */}
        {alerts.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Alerts
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    background: alert.type === "warning" ? "#FEF3C7" : "#F0FDFB",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  {alert.type === "warning" ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="2"
                      style={{ marginTop: "2px", flexShrink: 0 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#00897B"
                      strokeWidth="2"
                      style={{ marginTop: "2px", flexShrink: 0 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", color: alert.type === "warning" ? "#92400E" : "#065F46" }}>
                      {alert.message}
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Health */}
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
            Portfolio Health
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Outstanding</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${portfolioHealth.totalOutstanding.toLocaleString()}
              </p>
            </div>
            <div style={{ padding: "12px", background: "#F0FDFB", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Repaid</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                ${portfolioHealth.totalRepaid.toLocaleString()}
              </p>
            </div>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Active Advances</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                {portfolioHealth.activeAdvances}
              </p>
            </div>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Avg Size</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${portfolioHealth.averageAdvanceSize}
              </p>
            </div>
          </div>
        </div>

        {/* Region Metrics */}
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
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>By Region</h3>
            <button
              onClick={() => console.log("Adjust Risk")}
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
              Adjust Risk
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {regionMetrics.map((region, idx) => (
              <button
                key={idx}
                onClick={() => console.log("View Region", region)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: getStatusColor(region.status),
                    }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{region.region}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                      {region.advances} advances
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Default</p>
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: getStatusColor(region.status),
                      }}
                    >
                      {region.defaultRate}%
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Risk +</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {region.riskFactor}%
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Calibration Logs */}
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
            Auto-Calibration Logs
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {calibrationLogs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{log.action}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{log.date}</p>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                  <span style={{ color: "#00C6AE", fontWeight: "500" }}>{log.region}</span> — {log.reason}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Profitability Metrics */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Profitability</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.1)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Platform Return</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                {profitability.platformReturnRate}%
              </p>
            </div>
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.1)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Saver Returns</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>
                {profitability.saverReturnsAvg}%
              </p>
            </div>
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.1)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Net Margin</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                {profitability.netMargin}%
              </p>
            </div>
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.1)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>This Month</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>
                ${profitability.revenueThisMonth}
              </p>
            </div>
          </div>
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: "rgba(0,198,174,0.2)",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>Projected Annual Revenue</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
              ${profitability.projectedAnnual.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
