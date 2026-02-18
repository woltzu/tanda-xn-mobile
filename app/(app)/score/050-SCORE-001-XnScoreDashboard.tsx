"use client"
import { ArrowLeft, TrendingUp } from "lucide-react"

// Brand Colors
const colors = {
  primaryNavy: "#0A2342",
  accentTeal: "#00C6AE",
  warningAmber: "#D97706",
  background: "#F5F7FA",
  cards: "#FFFFFF",
  borders: "#E5E7EB",
  textSecondary: "#6B7280",
}

export default function XnScoreDashboardScreen() {
  const score = 72
  const scoreChange = +3
  const tier = 3
  const tierName = "Good"
  const accountAgeDays = 280
  const maxAllowedScore = 85
  const ageCapApplied = false
  const firstCircleBonusApplied = true

  const scoreBreakdown = {
    paymentHistory: { score: 28, max: 35, percentage: 80 },
    circleCompletion: { score: 18, max: 25, percentage: 72 },
    timeReliability: { score: 12, max: 20, percentage: 60 },
    securityDeposit: { score: 7, max: 10, percentage: 70 },
    diversitySocial: { score: 4, max: 7, percentage: 57 },
    engagement: { score: 3, max: 3, percentage: 100 },
  }

  const recentChanges = [
    { id: 1, event: "On-time circle payment", change: +0.5, date: "Jan 5", type: "payment" },
    { id: 2, event: "First circle completed!", change: +5, date: "Dec 28", type: "bonus" },
    { id: 3, event: "Payment streak: 20 consecutive", change: +2, date: "Dec 20", type: "streak" },
    { id: 4, event: "Security deposit locked (90 days)", change: +7, date: "Dec 15", type: "deposit" },
  ]

  // Tier colors and labels based on V3.0 algorithm
  const getTierInfo = (tierNum: number) => {
    switch (tierNum) {
      case 1:
        return { color: "#FFD700", label: "Elite", icon: "⭐" }
      case 2:
        return { color: "#00C6AE", label: "Excellent", icon: "🏆" }
      case 3:
        return { color: "#00C6AE", label: "Good", icon: "✓" }
      case 4:
        return { color: "#D97706", label: "Fair", icon: "⚠" }
      case 5:
        return { color: "#EF4444", label: "Poor", icon: "⚡" }
      case 6:
        return { color: "#991B1B", label: "Critical", icon: "🚫" }
      default:
        return { color: "#6B7280", label: "Unknown", icon: "?" }
    }
  }

  const tierInfo = getTierInfo(tier)

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case "payment":
        return "💳"
      case "bonus":
        return "🎁"
      case "streak":
        return "🔥"
      case "deposit":
        return "🔒"
      case "completion":
        return "✅"
      case "voucher":
        return "🤝"
      default:
        return "📊"
    }
  }

  // Factor display configuration matching V3.0
  const factors = [
    {
      key: "paymentHistory",
      label: "Payment History",
      weight: "35 pts",
      description: "On-time %, streak, no defaults",
      ...scoreBreakdown.paymentHistory,
    },
    {
      key: "circleCompletion",
      label: "Circle Completion",
      weight: "25 pts",
      description: "Completion rate + full cycles",
      ...scoreBreakdown.circleCompletion,
    },
    {
      key: "timeReliability",
      label: "Time & Reliability",
      weight: "20 pts",
      description: "Account age + sustained activity",
      ...scoreBreakdown.timeReliability,
    },
    {
      key: "securityDeposit",
      label: "Security Deposit",
      weight: "10 pts",
      description: "Locked deposit amount",
      ...scoreBreakdown.securityDeposit,
    },
    {
      key: "diversitySocial",
      label: "Diversity & Social",
      weight: "7 pts",
      description: "Multiple circles + vouchers",
      ...scoreBreakdown.diversitySocial,
    },
    {
      key: "engagement",
      label: "Engagement",
      weight: "3 pts",
      description: "Profile, KYC, longevity",
      ...scoreBreakdown.engagement,
    },
  ]

  const getBarColor = (percentage: number) => {
    if (percentage >= 80) return "#00C6AE"
    if (percentage >= 60) return "#0A2342"
    if (percentage >= 40) return "#D97706"
    return "#EF4444"
  }

  // Calculate months from days
  const accountMonths = Math.floor(accountAgeDays / 30)

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
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
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
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Your XnScore</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Your trust rating on TandaXn</p>
          </div>
        </div>

        {/* Score Display */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              width: "170px",
              height: "170px",
              borderRadius: "50%",
              background: `conic-gradient(${tierInfo.color} ${score * 3.6}deg, rgba(255,255,255,0.2) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "50%",
                background: "#0A2342",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "48px", fontWeight: "700" }}>{score}</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  color: tierInfo.color,
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                <span>{tierInfo.icon}</span>
                <span>{tierInfo.label}</span>
              </div>
              {scoreChange !== 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    color: scoreChange > 0 ? "#00C6AE" : "#D97706",
                    marginTop: "4px",
                  }}
                >
                  {scoreChange > 0 ? "+" : ""}
                  {scoreChange} this month
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Age Cap Warning */}
        {ageCapApplied && (
          <div
            style={{
              marginTop: "16px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: "11px", opacity: 0.9 }}>
              Score capped at {maxAllowedScore} (account age: {accountMonths} months).
              {maxAllowedScore < 100 && ` Unlock higher scores as your account matures.`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Quick Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => console.log("How it works")}
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "14px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00C6AE"
              strokeWidth="2"
              style={{ marginBottom: "8px" }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>How It Works</p>
          </button>
          <button
            onClick={() => console.log("Improve tips")}
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "14px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            <TrendingUp size={20} color="#00C6AE" style={{ marginBottom: "8px" }} />
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Improve Score</p>
          </button>
        </div>

        {/* Score Breakdown - 6 Factors */}
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
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Score Breakdown</h3>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Total: {score} / 100</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {factors.map((factor) => (
              <div key={factor.key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{factor.label}</span>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", marginLeft: "6px" }}>({factor.weight})</span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                    {factor.score} / {factor.max}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      flex: 1,
                      height: "8px",
                      background: "#F5F7FA",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${factor.percentage}%`,
                        height: "100%",
                        background: getBarColor(factor.percentage),
                        borderRadius: "4px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "11px", color: "#6B7280", width: "32px", textAlign: "right" }}>
                    {factor.percentage}%
                  </span>
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "#9CA3AF" }}>{factor.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tier Benefits Preview */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "16px" }}>{tierInfo.icon}</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
              {tierInfo.label} Tier Benefits
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "#0A2342", lineHeight: 1.5 }}>
            {tier === 1 && "Any payout slot • 0.5% early fee • 3% late bonus • $5,000 loan limit"}
            {tier === 2 && "Any payout slot • 1% early fee • 2.5% late bonus • $3,000 loan limit"}
            {tier === 3 && "Slot 4+ access • 2% early fee • 2% late bonus • $1,500 loan limit"}
            {tier === 4 && "Slot 7+ access • 4% early fee • 1% late bonus • $500 loan limit"}
            {tier === 5 && "Last 3 slots only • 7% early fee • No late bonus • No loan access"}
            {tier === 6 && "Cannot join new circles • Improve score to regain access"}
          </div>
          {tier > 1 && (
            <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#00C6AE", fontWeight: "500" }}>
              {tier === 2 && `+12 points to Elite tier`}
              {tier === 3 && `+3 points to Excellent tier`}
              {tier === 4 && `+${60 - score} points to Good tier`}
              {tier === 5 && `+${45 - score} points to Fair tier`}
              {tier === 6 && `+${25 - score} points to Poor tier (regain circle access)`}
            </p>
          )}
        </div>

        {/* Recent Changes */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Recent Changes</h3>
            <button
              onClick={() => console.log("View history")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              View All
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentChanges.map((change) => (
              <div
                key={change.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "18px" }}>{getChangeTypeIcon(change.type)}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{change.event}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>{change.date}</p>
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: change.change > 0 ? "#00C6AE" : "#D97706",
                    background: change.change > 0 ? "#F0FDFB" : "#FEF3C7",
                    padding: "4px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {change.change > 0 ? "+" : ""}
                  {Number(change.change.toFixed(1))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* First Circle Bonus Badge */}
        {firstCircleBonusApplied && (
          <div
            style={{
              marginTop: "16px",
              background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "24px" }}>🎉</span>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                First Circle Bonus Earned!
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#0A2342", opacity: 0.8 }}>
                +5 bonus points for completing your first circle
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
