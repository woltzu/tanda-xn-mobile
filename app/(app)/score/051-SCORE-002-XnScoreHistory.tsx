"use client"
import { useState } from "react"

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

export default function XnScoreHistoryScreen() {
  const [filter, setFilter] = useState("all")

  const currentScore = 72
  const currentTier = 3
  const tierName = "Good"
  const accountAgeDays = 280

  const scoreHistory = [
    { month: "Jul", score: 38, tier: 4, milestone: "Joined TandaXn" },
    { month: "Aug", score: 45, tier: 4, milestone: null },
    { month: "Sep", score: 52, tier: 4, milestone: "First circle completed (+5 bonus)" },
    { month: "Oct", score: 60, tier: 3, milestone: "Reached Good tier!" },
    { month: "Nov", score: 66, tier: 3, milestone: null },
    { month: "Dec", score: 72, tier: 3, milestone: "6-month cap lifted (now 85 max)" },
  ]

  const events = [
    {
      id: 1,
      type: "positive",
      event: "On-time payment (52 consecutive)",
      change: +0.5,
      date: "Jan 5, 2025",
      category: "payment",
      factor: "Payment History",
    },
    {
      id: 2,
      type: "positive",
      event: "First circle completed!",
      change: +5,
      date: "Dec 28, 2024",
      category: "bonus",
      factor: "First Circle Bonus",
    },
    {
      id: 3,
      type: "positive",
      event: "Payment streak reached 50",
      change: +2,
      date: "Dec 20, 2024",
      category: "payment",
      factor: "Payment History",
    },
    {
      id: 4,
      type: "positive",
      event: "Security deposit locked (90 days)",
      change: +7,
      date: "Dec 15, 2024",
      category: "deposit",
      factor: "Security Deposit",
    },
    {
      id: 5,
      type: "positive",
      event: "Account age: 6 months",
      change: 0,
      date: "Dec 10, 2024",
      category: "milestone",
      factor: "Time Reliability",
    },
    {
      id: 6,
      type: "negative",
      event: "Late payment (3 days)",
      change: -0.5,
      date: "Nov 25, 2024",
      category: "payment",
      factor: "Payment History",
    },
    {
      id: 7,
      type: "positive",
      event: "Joined second circle",
      change: +1,
      date: "Nov 15, 2024",
      category: "diversity",
      factor: "Diversity & Social",
    },
    {
      id: 8,
      type: "positive",
      event: "KYC verified",
      change: +1,
      date: "Nov 10, 2024",
      category: "engagement",
      factor: "Engagement",
    },
    {
      id: 9,
      type: "positive",
      event: "Profile completed",
      change: +1,
      date: "Nov 5, 2024",
      category: "engagement",
      factor: "Engagement",
    },
    {
      id: 10,
      type: "positive",
      event: "Received voucher from trusted member",
      change: +1,
      date: "Oct 20, 2024",
      category: "social",
      factor: "Diversity & Social",
    },
  ]

  const filters = [
    { id: "all", label: "All" },
    { id: "payment", label: "Payments" },
    { id: "completion", label: "Circles" },
    { id: "deposit", label: "Deposits" },
    { id: "milestone", label: "Milestones" },
  ]

  const filteredEvents =
    filter === "all"
      ? events
      : events.filter(
          (e) =>
            e.category === filter ||
            (filter === "completion" && (e.category === "bonus" || e.category === "diversity")),
        )

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "payment":
        return "💳"
      case "bonus":
        return "🎁"
      case "deposit":
        return "🔒"
      case "diversity":
        return "🔄"
      case "social":
        return "🤝"
      case "engagement":
        return "✅"
      case "milestone":
        return "🏆"
      case "completion":
        return "🎯"
      default:
        return "📊"
    }
  }

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1:
        return "#FFD700"
      case 2:
        return "#00C6AE"
      case 3:
        return "#00C6AE"
      case 4:
        return "#D97706"
      case 5:
        return "#EF4444"
      case 6:
        return "#991B1B"
      default:
        return "#6B7280"
    }
  }

  const accountMonths = Math.floor(accountAgeDays / 30)

  const getCurrentCap = () => {
    if (accountAgeDays < 180) return { cap: 75, nextCap: 85, daysToNext: 180 - accountAgeDays }
    if (accountAgeDays < 365) return { cap: 85, nextCap: 90, daysToNext: 365 - accountAgeDays }
    if (accountAgeDays < 547) return { cap: 90, nextCap: 100, daysToNext: 547 - accountAgeDays }
    return { cap: 100, nextCap: null, daysToNext: 0 }
  }

  const capInfo = getCurrentCap()

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Score History</h1>
        </div>

        {/* Score Summary */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Current</p>
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>{currentScore}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: getTierColor(currentTier) }}>{tierName} Tier</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>6mo Growth</p>
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
              +{currentScore - scoreHistory[0].score}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>{accountMonths} months active</p>
          </div>
        </div>

        {/* Age Cap Progress */}
        {capInfo.nextCap && (
          <div
            style={{
              marginTop: "12px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "10px 14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", opacity: 0.8 }}>Current max: {capInfo.cap} pts</span>
              <span style={{ fontSize: "11px", opacity: 0.8 }}>
                Next unlock: {capInfo.nextCap} pts in {Math.ceil(capInfo.daysToNext / 30)} months
              </span>
            </div>
            <div
              style={{
                height: "4px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${((accountAgeDays % 180) / 180) * 100}%`,
                  height: "100%",
                  background: "#00C6AE",
                  borderRadius: "2px",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Score Chart */}
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
            Score Progression
          </h3>

          {/* Chart with tier zones */}
          <div style={{ height: "140px", position: "relative", marginBottom: "8px" }}>
            {/* Tier zone backgrounds */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: "20px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ flex: 10, background: "rgba(255,215,0,0.1)", borderBottom: "1px dashed #FFD700" }} />
              <div style={{ flex: 15, background: "rgba(0,198,174,0.05)" }} />
              <div style={{ flex: 15, background: "rgba(0,198,174,0.03)" }} />
              <div style={{ flex: 15, background: "rgba(217,119,6,0.05)" }} />
              <div style={{ flex: 20, background: "rgba(239,68,68,0.03)" }} />
              <div style={{ flex: 25, background: "rgba(153,27,27,0.03)" }} />
            </div>

            <svg
              width="100%"
              height="100%"
              viewBox="0 0 300 120"
              preserveAspectRatio="none"
              style={{ position: "relative", zIndex: 1 }}
            >
              {/* Line path */}
              <path
                d={scoreHistory
                  .map((point, idx) => {
                    const x = (idx / (scoreHistory.length - 1)) * 280 + 10
                    const y = 110 - (point.score / 100) * 100
                    return `${idx === 0 ? "M" : "L"} ${x} ${y}`
                  })
                  .join(" ")}
                fill="none"
                stroke="#00C6AE"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points with tier colors */}
              {scoreHistory.map((point, idx) => {
                const x = (idx / (scoreHistory.length - 1)) * 280 + 10
                const y = 110 - (point.score / 100) * 100
                return (
                  <g key={idx}>
                    <circle cx={x} cy={y} r="6" fill={getTierColor(point.tier)} />
                    <text x={x} y={y - 10} textAnchor="middle" fontSize="9" fill="#0A2342" fontWeight="600">
                      {point.score}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* X-axis labels */}
          <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "10px", paddingRight: "10px" }}>
            {scoreHistory.map((point, idx) => (
              <div key={idx} style={{ textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "#9CA3AF", display: "block" }}>{point.month}</span>
                {point.milestone && <span style={{ fontSize: "8px", color: "#00C6AE" }}>●</span>}
              </div>
            ))}
          </div>

          {/* Milestones */}
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {scoreHistory
              .filter((s) => s.milestone)
              .map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    background: "#F0FDFB",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                >
                  <span style={{ color: "#00C6AE" }}>●</span>
                  <span style={{ color: "#0A2342", fontWeight: "500" }}>{s.month}:</span>
                  <span style={{ color: "#6B7280" }}>{s.milestone}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "10px",
            padding: "4px",
            marginBottom: "16px",
            display: "flex",
            gap: "4px",
            border: "1px solid #E5E7EB",
            overflowX: "auto",
          }}
        >
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: "8px",
                border: "none",
                background: filter === f.id ? "#0A2342" : "transparent",
                color: filter === f.id ? "#FFFFFF" : "#6B7280",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Events List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            Score Events ({filteredEvents.length})
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  background: event.type === "positive" ? "#F5F7FA" : "#FEF3C7",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: event.type === "positive" ? "#F0FDFB" : "#FEF3C7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  {getCategoryIcon(event.category)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{event.event}</p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                    <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{event.date}</span>
                    <span style={{ fontSize: "10px", color: "#00C6AE", fontWeight: "500" }}>{event.factor}</span>
                  </div>
                </div>
                {event.change !== 0 ? (
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "700",
                      color: event.change > 0 ? "#00C6AE" : "#D97706",
                      background: event.change > 0 ? "#F0FDFB" : "#FEF3C7",
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    {event.change > 0 ? "+" : ""}
                    {event.change}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "600",
                      color: "#6B7280",
                      background: "#F5F7FA",
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    MILESTONE
                  </span>
                )}
              </div>
            ))}
          </div>

          {filteredEvents.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "24px",
                color: "#9CA3AF",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px" }}>No events in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
