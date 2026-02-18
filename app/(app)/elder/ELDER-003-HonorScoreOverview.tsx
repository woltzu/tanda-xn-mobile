"use client"

import { useState } from "react"

export default function HonorScoreOverviewScreen() {
  const [userProfile] = useState({
    name: "Franck Kengne",
    honorScore: 78, // 0-100 scale
    xnScore: 75, // 0-100 scale
    tier: "Gold", // Based on Honor Score: Platinum 85+, Gold 70-84, Silver 55-69, Bronze 40-54, Provisional 0-39
    casesHelped: 3, // Regular members can help in community
    avgRating: 4.6,
    endorsements: 12,
    memberSince: "Oct 2024",
    isElder: false,
  })

  const [scoreHistory] = useState([
    { month: "Dec", score: 78 },
    { month: "Nov", score: 75 },
    { month: "Oct", score: 72 },
    { month: "Sep", score: 68 },
    { month: "Aug", score: 65 },
    { month: "Jul", score: 60 },
  ])

  const [recentActivity] = useState([
    { type: "payment", points: "+2", description: "On-time circle payment", date: "2 days ago" },
    { type: "endorsement", points: "+1", description: "Endorsed by Mama Adjoa", date: "4 days ago" },
    { type: "completion", points: "+5", description: "Completed savings circle", date: "1 week ago" },
  ])

  const getTierInfo = (score: number) => {
    if (score >= 85) return { tier: "Platinum", color: "#00C6AE", bg: "#F0FDFB" }
    if (score >= 70) return { tier: "Gold", color: "#D97706", bg: "#FEF3C7" }
    if (score >= 55) return { tier: "Silver", color: "#6B7280", bg: "#F5F7FA" }
    if (score >= 40) return { tier: "Bronze", color: "#92400E", bg: "#FED7AA" }
    return { tier: "Provisional", color: "#DC2626", bg: "#FEE2E2" }
  }

  const tierInfo = getTierInfo(userProfile.honorScore)
  const maxScore = 100
  const scorePercent = (userProfile.honorScore / maxScore) * 100

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
          padding: "20px 20px 90px 20px",
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Honor Score</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Your community reputation</p>
          </div>
        </div>

        {/* Score Circle */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "140px",
              height: "140px",
              borderRadius: "50%",
              background: `conic-gradient(#00C6AE ${scorePercent * 3.6}deg, rgba(255,255,255,0.15) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                width: "110px",
                height: "110px",
                borderRadius: "50%",
                background: "#0A2342",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "42px", fontWeight: "700", color: "#00C6AE" }}>{userProfile.honorScore}</span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>/ 100</span>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <span
              style={{
                display: "inline-block",
                padding: "6px 16px",
                background: tierInfo.bg,
                color: tierInfo.color,
                fontSize: "12px",
                fontWeight: "700",
                borderRadius: "20px",
              }}
            >
              🏅 {tierInfo.tier} Member
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-50px", padding: "0 20px" }}>
        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              padding: "16px 12px",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
              {userProfile.xnScore}
            </p>
            <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>XnScore</p>
          </div>

          <div
            style={{
              padding: "16px 12px",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "22px", fontWeight: "700", color: "#0A2342" }}>
              ⭐ {userProfile.avgRating}
            </p>
            <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>Rating</p>
          </div>

          <button
            onClick={() => console.log("View endorsements")}
            style={{
              padding: "16px 12px",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "22px", fontWeight: "700", color: "#0A2342" }}>
              {userProfile.endorsements}
            </p>
            <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>Endorsements</p>
          </button>
        </div>

        {/* Score Trend */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Score Trend</h3>
            <span style={{ fontSize: "12px", color: "#00897B", fontWeight: "500" }}>+18 this year</span>
          </div>

          {/* Simple Bar Chart - normalized to 0-100 */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "80px" }}>
            {scoreHistory.map((item, idx) => {
              const barHeight = (item.score / 100) * 80 // Direct percentage of 100
              return (
                <div key={idx} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: "36px",
                      height: `${Math.max(barHeight, 10)}px`,
                      background: idx === 0 ? "#00C6AE" : "#E5E7EB",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <p style={{ margin: "6px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{item.month}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Recent Score Activity
          </h3>

          {recentActivity.map((activity, idx) => (
            <div
              key={idx}
              style={{
                padding: "12px 0",
                borderBottom: idx < recentActivity.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {activity.type === "payment" ? "💳" : activity.type === "endorsement" ? "👍" : "🎉"}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                    {activity.description}
                  </p>
                  <p style={{ margin: "1px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{activity.date}</p>
                </div>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  background: "#F0FDFB",
                  color: "#00897B",
                  fontSize: "12px",
                  fontWeight: "700",
                  borderRadius: "6px",
                }}
              >
                {activity.points}
              </span>
            </div>
          ))}
        </div>

        {/* How to Improve */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
            💡 How to increase your Honor Score
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.8,
            }}
          >
            <li>Make on-time payments (+2 per payment)</li>
            <li>Complete savings circles (+5 each)</li>
            <li>Get endorsed by other members (+1 each)</li>
            <li>Help resolve community issues (+3 each)</li>
          </ul>
        </div>

        {/* View Breakdown Button */}
        <button
          onClick={() => console.log("View breakdown")}
          style={{
            width: "100%",
            padding: "16px",
            background: "#00C6AE",
            borderRadius: "14px",
            border: "none",
            fontSize: "15px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          View Score Breakdown →
        </button>
      </div>
    </div>
  )
}
