"use client"

import { useState } from "react"

export default function HonorScoreBreakdownScreen() {
  const totalScore = 78 // 0-100 scale
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const categories = [
    {
      id: "payments",
      name: "Payment Behavior",
      score: 32,
      maxScore: 40, // 40% weight
      icon: "💳",
      description: "On-time payments and financial reliability",
      details: [
        { label: "On-time payments", value: "+28", count: "45/48 payments" },
        { label: "Late payment penalties", value: "-3", count: "3 late" },
        { label: "Perfect streaks bonus", value: "+7", count: "2 streaks" },
      ],
    },
    {
      id: "completion",
      name: "Circle Completion",
      score: 24,
      maxScore: 30, // 30% weight
      icon: "🔄",
      description: "Successfully completed savings circles",
      details: [
        { label: "Completed circles", value: "+20", count: "4 circles" },
        { label: "Early exit penalty", value: "-1", count: "1 early" },
        { label: "Completion rate bonus", value: "+5", count: "80%" },
      ],
    },
    {
      id: "tenure",
      name: "Account Age & Activity",
      score: 14,
      maxScore: 20, // 20% weight
      icon: "📅",
      description: "Time as member and engagement level",
      details: [
        { label: "Months active", value: "+10", count: "10 months" },
        { label: "Consistent activity", value: "+4", count: "Weekly logins" },
      ],
    },
    {
      id: "community",
      name: "Community Contribution",
      score: 8,
      maxScore: 10, // 10% weight
      icon: "👥",
      description: "Endorsements and helping others",
      details: [
        { label: "Endorsements received", value: "+5", count: "12 endorsements" },
        { label: "Members helped", value: "+3", count: "5 helped" },
      ],
    },
  ]

  const getTierForScore = (score: number) => {
    if (score >= 85) return { tier: "Platinum", next: null, needed: 0 }
    if (score >= 70) return { tier: "Gold", next: "Platinum", needed: 85 - score }
    if (score >= 55) return { tier: "Silver", next: "Gold", needed: 70 - score }
    if (score >= 40) return { tier: "Bronze", next: "Silver", needed: 55 - score }
    return { tier: "Provisional", next: "Bronze", needed: 40 - score }
  }

  const tierInfo = getTierForScore(totalScore)

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Score Breakdown</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>How your Honor Score is calculated</p>
          </div>
        </div>

        {/* Total Score Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Total Honor Score</p>
          <p style={{ margin: 0 }}>
            <span style={{ fontSize: "48px", fontWeight: "700", color: "#00C6AE" }}>{totalScore}</span>
            <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)" }}> / 100</span>
          </p>
          {tierInfo.next && (
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {tierInfo.needed} more points to {tierInfo.next}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Score Formula Explanation */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", textAlign: "center" }}>
            <strong>Honor Score</strong> = Payment (40%) + Completion (30%) + Tenure (20%) + Community (10%)
          </p>
        </div>

        {/* Categories */}
        {categories.map((category) => {
          const percent = (category.score / category.maxScore) * 100
          const isExpanded = expandedCategory === category.id

          return (
            <div
              key={category.id}
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                marginBottom: "12px",
                border: "1px solid #E5E7EB",
                overflow: "hidden",
              }}
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "22px" }}>{category.icon}</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{category.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>{category.score}</span>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>/ {category.maxScore}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9CA3AF"
                      strokeWidth="2"
                      style={{
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: "6px", background: "#E5E7EB", borderRadius: "3px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${percent}%`,
                      background: percent >= 90 ? "#00C6AE" : percent >= 70 ? "#0A2342" : "#D97706",
                      borderRadius: "3px",
                    }}
                  />
                </div>

                <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{category.description}</p>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #F5F7FA" }}>
                  {category.details.map((detail, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: idx < category.details.length - 1 ? "1px solid #F5F7FA" : "none",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "13px", color: "#0A2342" }}>{detail.label}</span>
                        <span style={{ fontSize: "11px", color: "#6B7280", marginLeft: "6px" }}>({detail.count})</span>
                      </div>
                      <span
                        style={{
                          padding: "3px 8px",
                          background: detail.value.startsWith("+") ? "#F0FDFB" : "#FEE2E2",
                          color: detail.value.startsWith("+") ? "#00897B" : "#DC2626",
                          fontSize: "12px",
                          fontWeight: "600",
                          borderRadius: "4px",
                        }}
                      >
                        {detail.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Tier Reference */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginTop: "8px",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
            🏅 Honor Score Tiers
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              { tier: "Platinum", range: "85-100", benefit: "First rotation priority" },
              { tier: "Gold", range: "70-84", benefit: "Early rotation access" },
              { tier: "Silver", range: "55-69", benefit: "Standard rotation" },
              { tier: "Bronze", range: "40-54", benefit: "Later rotation" },
              { tier: "Provisional", range: "0-39", benefit: "Last rotation only" },
            ].map((t, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: totalScore >= Number.parseInt(t.range) ? "#00C6AE" : "rgba(255,255,255,0.5)",
                      width: "70px",
                    }}
                  >
                    {t.tier}
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>{t.range}</span>
                </div>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{t.benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
