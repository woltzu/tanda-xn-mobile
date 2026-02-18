"use client"
import { useState } from "react"

export default function ImproveScoreTipsScreen() {
  const [selectedQuickWin, setSelectedQuickWin] = useState<number | null>(null)

  // Current state
  const currentScore = 72
  const currentTier = 3
  const tierName = "Good"
  const scoreChange = 3
  const accountAgeDays = 280
  const maxAllowedScore = 85
  const accountMonths = Math.floor(accountAgeDays / 30)

  // Current factor scores for personalized recommendations
  const factorScores = {
    paymentHistory: { score: 28, max: 35, onTimeRate: 92, streak: 25, hasDefaults: false },
    circleCompletion: { score: 18, max: 25, completionRate: 80, fullCycles: 3 },
    timeReliability: { score: 12, max: 20, accountAgeScore: 7, activityScore: 5 },
    securityDeposit: { score: 7, max: 10, depositRatio: 2.0 },
    diversitySocial: { score: 4, max: 7, circles: 3, vouchers: 1 },
    engagement: { score: 3, max: 3, profileComplete: true, kycVerified: true, longevity: true },
  }

  // Calculate potential points for each factor
  const calculatePotential = () => {
    const potential = []
    const f = factorScores

    // Payment History opportunities
    if (f.paymentHistory.score < f.paymentHistory.max) {
      if (f.paymentHistory.onTimeRate < 100) {
        potential.push({
          factor: "Payment History",
          action: "Make next 10 payments on-time",
          points: "+0.5 to +1",
          timeframe: "2-3 months",
          impact: "High",
          difficulty: "Easy",
        })
      }
      if (f.paymentHistory.streak < 50) {
        const paymentsNeeded = 50 - f.paymentHistory.streak
        potential.push({
          factor: "Payment History",
          action: `Build streak to 50 (need ${paymentsNeeded} more)`,
          points: `+${Math.min((50 - f.paymentHistory.streak) / 5, 10 - f.paymentHistory.streak / 5).toFixed(1)}`,
          timeframe: `${Math.ceil(paymentsNeeded / 4)} months`,
          impact: "High",
          difficulty: "Medium",
        })
      }
    }

    // Circle Completion opportunities
    if (f.circleCompletion.score < f.circleCompletion.max) {
      if (f.circleCompletion.fullCycles < 5) {
        potential.push({
          factor: "Circle Completion",
          action: `Complete ${5 - f.circleCompletion.fullCycles} more full circles`,
          points: `+${(5 - f.circleCompletion.fullCycles) * 2}`,
          timeframe: `${(5 - f.circleCompletion.fullCycles) * 3} months`,
          impact: "High",
          difficulty: "Medium",
        })
      }
    }

    // Security Deposit opportunities
    if (f.securityDeposit.score < f.securityDeposit.max) {
      if (f.securityDeposit.depositRatio < 3) {
        potential.push({
          factor: "Security Deposit",
          action: "Increase deposit to 3× your contribution",
          points: `+${f.securityDeposit.max - f.securityDeposit.score}`,
          timeframe: "Immediate",
          impact: "Medium",
          difficulty: "Easy",
        })
      }
    }

    // Diversity opportunities
    if (f.diversitySocial.score < f.diversitySocial.max) {
      if (f.diversitySocial.circles < 5) {
        potential.push({
          factor: "Diversity & Social",
          action: `Join ${5 - f.diversitySocial.circles} more circles`,
          points: `+${5 - f.diversitySocial.circles}`,
          timeframe: "3+ months (circles must be 90+ days old)",
          impact: "Low",
          difficulty: "Easy",
        })
      }
      if (f.diversitySocial.vouchers < 2) {
        potential.push({
          factor: "Diversity & Social",
          action: `Get ${2 - f.diversitySocial.vouchers} more voucher(s) from 70+ score members`,
          points: `+${2 - f.diversitySocial.vouchers}`,
          timeframe: "Varies",
          impact: "Low",
          difficulty: "Medium",
        })
      }
    }

    return potential
  }

  const opportunities = calculatePotential()

  // Quick wins - things that can be done immediately
  const quickWins = [
    {
      id: 1,
      task: "Complete your profile",
      points: "+1",
      done: factorScores.engagement.profileComplete,
      factor: "Engagement",
    },
    {
      id: 2,
      task: "Verify your identity (KYC)",
      points: "+1",
      done: factorScores.engagement.kycVerified,
      factor: "Engagement",
    },
    {
      id: 3,
      task: "Lock security deposit (3× contribution)",
      points: "+3 to +10",
      done: factorScores.securityDeposit.depositRatio >= 3,
      factor: "Security Deposit",
    },
    {
      id: 4,
      task: "Join a second circle",
      points: "+1 (after 90 days)",
      done: factorScores.diversitySocial.circles >= 2,
      factor: "Diversity",
    },
  ]

  const pendingQuickWins = quickWins.filter((q) => !q.done)

  // Long-term strategies based on V3.0 algorithm
  const longTermStrategies = [
    {
      strategy: "Pay on time, every time",
      description: "Payment History is 35% of your score. Each on-time payment adds to your rate and streak.",
      impact: "High",
      points: "Up to 35 pts",
    },
    {
      strategy: "Complete full circles",
      description: "Don't leave circles early. 5+ completed cycles = maximum 10 pts from this sub-factor.",
      impact: "High",
      points: "Up to 25 pts",
    },
    {
      strategy: "Be patient with account age",
      description: "Time-based reliability (20 pts) rewards patience. Max score unlocks at 18+ months.",
      impact: "High",
      points: "Up to 20 pts",
    },
    {
      strategy: "Lock a meaningful deposit",
      description: "3× your contribution = 10 pts. Must stay locked 90+ days to count.",
      impact: "Medium",
      points: "Up to 10 pts",
    },
    {
      strategy: "Diversify your circles",
      description: "Participate in 5+ different circles (90+ days each) for maximum diversity points.",
      impact: "Low",
      points: "Up to 5 pts",
    },
    {
      strategy: "Get vouched by trusted members",
      description: "Members with 70+ score can vouch for you. Max 2 vouchers count.",
      impact: "Low",
      points: "Up to 2 pts",
    },
  ]

  // Things to avoid with V3.0 accurate penalties
  const thingsToAvoid = [
    {
      action: "Late payments",
      impact: "-0.5 pts per late payment",
      duration: "Recent late payments (6 months) hurt more",
      severity: "Medium",
    },
    {
      action: "Missing payments",
      impact: "Resets your streak to 0",
      duration: "Immediate impact on streak score",
      severity: "High",
    },
    {
      action: "Defaulting on payments",
      impact: "-5 pts PERMANENT",
      duration: "Never expires. 2 defaults = account ban.",
      severity: "Critical",
    },
    {
      action: "Leaving circles early",
      impact: "-3 pts per early exit",
      duration: "Affects score for 12 months",
      severity: "High",
    },
    {
      action: "Withdrawing your deposit",
      impact: "Lose ALL deposit points instantly",
      duration: "Must re-lock for 90+ days to recover",
      severity: "High",
    },
    {
      action: "Activity gaps >3 months",
      impact: "-2 pts per gap",
      duration: "Sustained activity is required",
      severity: "Medium",
    },
  ]

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "High":
        return "#00C6AE"
      case "Medium":
        return "#0A2342"
      case "Low":
        return "#6B7280"
      default:
        return "#6B7280"
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "#991B1B"
      case "High":
        return "#D97706"
      case "Medium":
        return "#92400E"
      default:
        return "#6B7280"
    }
  }

  // Calculate next tier threshold
  const getNextTierInfo = () => {
    if (currentScore >= 90) return { name: "Elite", points: 0, reached: true }
    if (currentScore >= 75) return { name: "Elite", points: 90 - currentScore, reached: false }
    if (currentScore >= 60) return { name: "Excellent", points: 75 - currentScore, reached: false }
    if (currentScore >= 45) return { name: "Good", points: 60 - currentScore, reached: false }
    if (currentScore >= 25) return { name: "Fair", points: 45 - currentScore, reached: false }
    return { name: "Poor", points: 25 - currentScore, reached: false }
  }

  const nextTier = getNextTierInfo()

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Improve Your Score</h1>
        </div>

        {/* Current Score + Next Goal */}
        <div
          style={{
            display: "flex",
            gap: "12px",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Current XnScore</p>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "6px" }}>
              <span style={{ fontSize: "36px", fontWeight: "700" }}>{currentScore}</span>
              {scoreChange !== 0 && (
                <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "600" }}>+{scoreChange}</span>
              )}
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>{tierName} Tier</p>
          </div>

          {!nextTier.reached && (
            <div
              style={{
                flex: 1,
                background: "#00C6AE",
                borderRadius: "14px",
                padding: "16px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Next: {nextTier.name}</p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>+{nextTier.points}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>points needed</p>
            </div>
          )}
        </div>

        {/* Age Cap Warning if applicable */}
        {maxAllowedScore < 100 && (
          <div
            style={{
              marginTop: "12px",
              background: "rgba(255,215,0,0.2)",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "14px" }}>⏳</span>
            <span style={{ fontSize: "11px" }}>
              Max score: {maxAllowedScore} (account age: {accountMonths} months). Higher caps unlock with time.
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Quick Wins */}
        {pendingQuickWins.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <span style={{ fontSize: "20px" }}>⚡</span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Quick Wins</h3>
              <span
                style={{
                  fontSize: "11px",
                  background: "#F0FDFB",
                  color: "#00C6AE",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontWeight: "600",
                }}
              >
                {pendingQuickWins.length} available
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {quickWins.map((win) => (
                <button
                  key={win.id}
                  onClick={() => !win.done && setSelectedQuickWin(win.id)}
                  disabled={win.done}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: win.done ? "#F0FDFB" : "#F5F7FA",
                    border: win.done ? "1px solid #00C6AE" : "1px solid #E5E7EB",
                    borderRadius: "10px",
                    cursor: win.done ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: win.done ? "#00C6AE" : "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {win.done && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontSize: "13px",
                        color: win.done ? "#6B7280" : "#0A2342",
                        textDecoration: win.done ? "line-through" : "none",
                        fontWeight: "500",
                      }}
                    >
                      {win.task}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#9CA3AF",
                        display: "block",
                        marginTop: "2px",
                      }}
                    >
                      {win.factor}
                    </span>
                  </div>
                  <span
                    style={{
                      background: win.done ? "#E5E7EB" : "#00C6AE",
                      color: win.done ? "#6B7280" : "#FFFFFF",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}
                  >
                    {win.points}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Personalized Opportunities */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>🎯</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Your Next Steps</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {opportunities.slice(0, 4).map((opp, idx) => (
              <div
                key={idx}
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  borderLeft: `4px solid ${getImpactColor(opp.impact)}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                      {opp.action}
                    </p>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", color: "#6B7280" }}>📁 {opp.factor}</span>
                      <span style={{ fontSize: "10px", color: "#6B7280" }}>⏱ {opp.timeframe}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opp.points}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: "600",
                      color: getImpactColor(opp.impact),
                      textTransform: "uppercase",
                      background: opp.impact === "High" ? "#F0FDFB" : "#F5F7FA",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {opp.impact} Impact
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: "600",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      background: "#F5F7FA",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {opp.difficulty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Long-Term Strategies */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>📈</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Long-Term Strategies</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {longTermStrategies.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#00C6AE",
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{item.strategy}</p>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "600",
                        color: getImpactColor(item.impact),
                        textTransform: "uppercase",
                      }}
                    >
                      {item.impact}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
                    {item.description}
                  </p>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#00C6AE",
                      fontWeight: "600",
                      marginTop: "4px",
                      display: "inline-block",
                    }}
                  >
                    {item.points}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Things to Avoid */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Things to Avoid</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {thingsToAvoid.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "12px",
                  background: item.severity === "Critical" ? "#FEE2E2" : "#FEF3C7",
                  borderRadius: "10px",
                  borderLeft: `4px solid ${getSeverityColor(item.severity)}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "600", color: getSeverityColor(item.severity) }}>
                    {item.action}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: getSeverityColor(item.severity),
                      background: "rgba(255,255,255,0.5)",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {item.impact}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "11px", color: "#92400E" }}>{item.duration}</p>
                {item.severity === "Critical" && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "6px 8px",
                      background: "rgba(153,27,27,0.1)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "12px" }}>🚨</span>
                    <span style={{ fontSize: "10px", color: "#991B1B", fontWeight: "500" }}>This cannot be undone</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Realistic Timeline */}
        <div
          style={{
            background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
            borderRadius: "16px",
            padding: "20px",
            color: "#FFFFFF",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600" }}>
            📅 Realistic Timeline to Elite (100 pts)
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ opacity: 0.8 }}>Perfect behavior:</span>
              <span style={{ fontWeight: "600" }}>24 months</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ opacity: 0.8 }}>Realistic (95% on-time):</span>
              <span style={{ fontWeight: "600" }}>30-36 months</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ opacity: 0.8 }}>With 1 default:</span>
              <span style={{ fontWeight: "600", color: "#D97706" }}>Max ~95 (never Elite)</span>
            </div>
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "11px", opacity: 0.7, lineHeight: 1.4 }}>
            XnScore rewards patience and consistency. There are no shortcuts — only proven behavior over time.
          </p>
        </div>
      </div>
    </div>
  )
}
