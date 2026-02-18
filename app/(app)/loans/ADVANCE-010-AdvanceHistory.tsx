"use client"

export default function AdvanceHistoryScreen() {
  const pastAdvances = [
    {
      id: "ADV-2025-0105-003",
      type: "quick",
      typeName: "Quick Advance",
      icon: "⚡",
      amount: 250,
      totalRepaid: 262,
      status: "repaid",
      disbursedDate: "Jan 5, 2025",
      repaidDate: "Jan 20, 2025",
      circleName: "Family Circle",
      xnScoreImpact: "+2",
    },
    {
      id: "ADV-2024-1215-002",
      type: "contribution",
      typeName: "Contribution Cover",
      icon: "🛡️",
      amount: 100,
      totalRepaid: 105,
      status: "repaid",
      disbursedDate: "Dec 15, 2024",
      repaidDate: "Dec 28, 2024",
      circleName: "Business Builders",
      xnScoreImpact: "+1",
    },
    {
      id: "ADV-2024-1101-001",
      type: "quick",
      typeName: "Quick Advance",
      icon: "⚡",
      amount: 400,
      totalRepaid: 420,
      status: "repaid",
      disbursedDate: "Nov 1, 2024",
      repaidDate: "Nov 15, 2024",
      circleName: "Family Circle",
      xnScoreImpact: "+3",
    },
  ]

  const totalAdvanced = 750
  const totalRepaid = 787
  const averageRepayTime = 14

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "repaid":
        return { label: "Repaid ✓", bg: "#F0FDF4", color: "#166534" }
      case "defaulted":
        return { label: "Missed", bg: "#FEE2E2", color: "#DC2626" }
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Advance History</h1>
        </div>

        {/* Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          <div
            style={{ background: "rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px", textAlign: "center" }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "10px", opacity: 0.8 }}>Total Advanced</p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>${totalAdvanced}</p>
          </div>
          <div
            style={{ background: "rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px", textAlign: "center" }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "10px", opacity: 0.8 }}>Total Repaid</p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${totalRepaid}</p>
          </div>
          <div
            style={{ background: "rgba(255,255,255,0.1)", borderRadius: "12px", padding: "14px", textAlign: "center" }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "10px", opacity: 0.8 }}>Avg Repay</p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{averageRepayTime}d</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Track Record Badge */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #00C6AE",
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#065F46" }}>Perfect Repayment Record</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#047857" }}>
              {pastAdvances.length} advances repaid on time • +
              {pastAdvances.reduce((acc, a) => acc + Number.parseInt(a.xnScoreImpact), 0)} XnScore earned
            </p>
          </div>
        </div>

        {/* Past Advances List */}
        {pastAdvances.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {pastAdvances.map((advance) => {
              const statusStyle = getStatusStyle(advance.status)

              return (
                <button
                  key={advance.id}
                  onClick={() => console.log("View advance", advance.id)}
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "16px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: "#F5F7FA",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "22px",
                        }}
                      >
                        {advance.icon}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                          ${advance.amount} {advance.typeName}
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{advance.circleName}</p>
                      </div>
                    </div>
                    <span
                      style={{
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: "12px",
                      borderTop: "1px solid #F5F7FA",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Disbursed</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                        {advance.disbursedDate}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Repaid</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                        {advance.repaidDate}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Total Paid</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                        ${advance.totalRepaid}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>XnScore</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>
                        {advance.xnScoreImpact}
                      </p>
                    </div>
                  </div>
                </button>
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
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "28px",
              }}
            >
              📊
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              No Advance History Yet
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Your completed advances will appear here</p>
          </div>
        )}

        {/* New Advance Button */}
        <button
          onClick={() => console.log("Request new advance")}
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
      </div>
    </div>
  )
}
