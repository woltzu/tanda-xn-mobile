"use client"

export default function GoalProgressScreen() {
  const goal = {
    id: "g1",
    name: "Emergency Fund",
    emoji: "🛡️",
    targetAmount: 5000,
    currentAmount: 3200,
    tier: "emergency",
    deadline: "2025-06-30",
    monthlyContribution: 400,
  }

  const monthlyData = [
    { month: "Jul", amount: 400 },
    { month: "Aug", amount: 350 },
    { month: "Sep", amount: 400 },
    { month: "Oct", amount: 450 },
    { month: "Nov", amount: 600 },
    { month: "Dec", amount: 400 },
  ]

  const contributionSources = [
    { source: "Auto-Save", amount: 2000, percent: 62.5 },
    { source: "Manual", amount: 800, percent: 25 },
    { source: "Circle Payouts", amount: 400, percent: 12.5 },
  ]

  const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100)
  const remaining = goal.targetAmount - goal.currentAmount

  // Calculate projections
  const avgMonthly = Math.round(monthlyData.reduce((a, b) => a + b.amount, 0) / monthlyData.length)
  const monthsToGoal = Math.ceil(remaining / avgMonthly)

  const projectedDate = new Date()
  projectedDate.setMonth(projectedDate.getMonth() + monthsToGoal)

  const deadlineDate = new Date(goal.deadline)
  const isOnTrack = projectedDate <= deadlineDate

  // Max value for chart scaling
  const maxAmount = Math.max(...monthlyData.map((d) => d.amount))

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
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Progress & Projections</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {goal.emoji} {goal.name}
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div
          style={{
            background: isOnTrack ? "rgba(0,198,174,0.2)" : "rgba(217,119,6,0.2)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: isOnTrack ? "#00C6AE" : "#D97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isOnTrack ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            )}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
              {isOnTrack ? "You're on track!" : "Slightly behind schedule"}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              Projected completion: {projectedDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Monthly Contributions Chart */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Monthly Contributions</h3>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>Avg: ${avgMonthly}/mo</span>
          </div>

          {/* Bar Chart */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "8px",
              height: "120px",
              marginBottom: "8px",
            }}
          >
            {monthlyData.map((d, idx) => (
              <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "#0A2342", fontWeight: "600", marginBottom: "4px" }}>
                  ${d.amount}
                </span>
                <div
                  style={{
                    width: "100%",
                    height: `${(d.amount / maxAmount) * 100}px`,
                    background: d.amount >= avgMonthly ? "#00C6AE" : "#0A2342",
                    borderRadius: "4px 4px 0 0",
                    opacity: d.amount >= avgMonthly ? 1 : 0.6,
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {monthlyData.map((d, idx) => (
              <div key={idx} style={{ flex: 1, textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contribution Sources */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            Where Your Savings Come From
          </h3>

          {/* Stacked Bar */}
          <div
            style={{
              height: "24px",
              borderRadius: "12px",
              overflow: "hidden",
              display: "flex",
              marginBottom: "16px",
            }}
          >
            {contributionSources.map((source, idx) => (
              <div
                key={idx}
                style={{
                  width: `${source.percent}%`,
                  background: idx === 0 ? "#00C6AE" : idx === 1 ? "#0A2342" : "#6B7280",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {source.percent > 15 && (
                  <span style={{ fontSize: "10px", fontWeight: "600", color: "#FFFFFF" }}>{source.percent}%</span>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {contributionSources.map((source, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "3px",
                      background: idx === 0 ? "#00C6AE" : idx === 1 ? "#0A2342" : "#6B7280",
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>{source.source}</span>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  ${source.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Projections */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Projections</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Current Pace */}
            <div
              style={{
                padding: "14px",
                background: "#F0FDFB",
                borderRadius: "12px",
                borderLeft: "4px solid #00C6AE",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>
                At current pace (${avgMonthly}/mo)
              </p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                Goal reached by {projectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>

            {/* If Save More */}
            <div
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
                borderLeft: "4px solid #0A2342",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>
                If you save ${Math.round(avgMonthly * 1.25)}/mo (+25%)
              </p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                Reach goal {Math.round(monthsToGoal * 0.8)} months faster
              </p>
            </div>

            {/* Target */}
            <div
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
                borderLeft: "4px solid #9CA3AF",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Your target date</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                {deadlineDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Total Saved</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
              ${goal.currentAmount.toLocaleString()}
            </p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Still Needed</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
              ${remaining.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
