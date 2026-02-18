"use client"

export default function StatusDashboardScreen() {
  const user = {
    name: "Franck",
    xnScore: 75,
  }

  const activeAdvances = [
    {
      id: "ADV-2025-0120-001",
      type: "quick",
      typeName: "Quick Advance",
      icon: "⚡",
      advancedAmount: 300,
      totalDue: 315,
      withholdingDate: "Feb 15, 2025",
      circleName: "Family Circle",
      payoutAmount: 500,
      remainingAfter: 185,
      status: "on_track", // "on_track", "at_risk", "overdue"
      daysUntil: 25,
      disbursedDate: "Jan 20, 2025",
    },
  ]

  const totalAdvanced = 300
  const totalDue = 315

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "on_track":
        return { label: "On Track ✓", bg: "#F0FDFB", color: "#00897B", icon: "✅" }
      case "at_risk":
        return { label: "At Risk", bg: "#FEF3C7", color: "#D97706", icon: "⚠️" }
      case "overdue":
        return { label: "Overdue", bg: "#FEE2E2", color: "#DC2626", icon: "❌" }
      default:
        return { label: status, bg: "#F5F7FA", color: "#6B7280" }
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>My Advances</h1>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>Total Advanced</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>${totalAdvanced}</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>Total to Repay</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>${totalDue}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {activeAdvances.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activeAdvances.map((advance) => {
              const statusBadge = getStatusBadge(advance.status)

              return (
                <div
                  key={advance.id}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "16px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  {/* Header Row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "12px",
                          background: "#F0FDFB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "24px",
                        }}
                      >
                        {advance.icon}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                          ${advance.advancedAmount} {advance.typeName}
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                          From {advance.circleName}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        padding: "6px 10px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Withholding Info */}
                  <div
                    style={{
                      background:
                        advance.status === "on_track"
                          ? "#F0FDFB"
                          : advance.status === "at_risk"
                            ? "#FEF3C7"
                            : "#FEE2E2",
                      borderRadius: "12px",
                      padding: "14px",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={statusBadge.color}
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: statusBadge.color }}>
                        Next withholding: {advance.withholdingDate}
                      </p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Amount to be withheld</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                          ${advance.totalDue}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>From payout of</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                          ${advance.payoutAmount}
                        </p>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: "10px",
                        paddingTop: "10px",
                        borderTop: `1px solid ${statusBadge.color}20`,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                        You'll keep: <strong style={{ color: "#00C6AE" }}>${advance.remainingAfter}</strong> after
                        withholding
                      </p>
                    </div>
                  </div>

                  {/* Days Until */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                      {advance.daysUntil > 0 ? `${advance.daysUntil} days until payout` : "Payout due today"}
                    </p>
                    <div
                      style={{
                        width: "100px",
                        height: "6px",
                        background: "#E5E7EB",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(0, 100 - (advance.daysUntil / 30) * 100)}%`,
                          height: "100%",
                          background: "#00C6AE",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => console.log("View Details", advance)}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #E5E7EB",
                        background: "#FFFFFF",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#0A2342",
                        cursor: "pointer",
                      }}
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => console.log("Repay Early", advance)}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#00C6AE",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      Repay Early
                    </button>
                  </div>

                  {/* Advance ID */}
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #E5E7EB" }}>
                    <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF", textAlign: "center" }}>
                      ID: {advance.id} • Disbursed {advance.disbursedDate}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "28px",
              }}
            >
              ✨
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              No Active Advances
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
              Need funds before your next payout? Get an advance.
            </p>
          </div>
        )}

        {/* Circle Eligibility Impact */}
        {activeAdvances.length > 0 && (
          <div
            style={{
              marginTop: "16px",
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Impact on Future Circles
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00C6AE" }} />
                <span style={{ fontSize: "13px", color: "#0A2342" }}>
                  You can still join new circles while advance is active
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#D97706" }} />
                <span style={{ fontSize: "13px", color: "#0A2342" }}>
                  Max advance amount may be limited until repayment
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#DC2626" }} />
                <span style={{ fontSize: "13px", color: "#0A2342" }}>
                  Missed repayment affects XnScore (-20 pts) and circle access
                </span>
              </div>
            </div>
          </div>
        )}

        {/* New Advance Button */}
        <button
          onClick={() => console.log("Request New Advance")}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "2px dashed #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#00C6AE" }}>Request New Advance</span>
        </button>

        {/* XnScore Status */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>{user.xnScore}</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>Your XnScore</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#047857" }}>
              On-time repayment keeps your score healthy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
