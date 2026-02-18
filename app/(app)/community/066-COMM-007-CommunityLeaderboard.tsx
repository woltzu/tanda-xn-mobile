"use client"

import { useState } from "react"

export default function CommunityLeaderboardScreen() {
  const [activeTab, setActiveTab] = useState("referrals")

  const currentUser = {
    id: "user1",
    name: "Franck",
    rank: 23,
    referrals: 7,
    totalSaved: 4850,
    xnScore: 75,
  }

  const topReferrers = [
    { id: "t1", name: "Aisha M.", rank: 1, referrals: 45, avatar: "A", badge: "🥇" },
    { id: "t2", name: "Emmanuel K.", rank: 2, referrals: 38, avatar: "E", badge: "🥈" },
    { id: "t3", name: "Fatou D.", rank: 3, referrals: 31, avatar: "F", badge: "🥉" },
    { id: "t4", name: "Kofi A.", rank: 4, referrals: 28, avatar: "K" },
    { id: "t5", name: "Amara O.", rank: 5, referrals: 24, avatar: "A" },
    { id: "t6", name: "David N.", rank: 6, referrals: 21, avatar: "D" },
    { id: "t7", name: "Marie C.", rank: 7, referrals: 19, avatar: "M" },
    { id: "t8", name: "Samuel O.", rank: 8, referrals: 17, avatar: "S" },
  ]

  const topSavers = [
    { id: "s1", name: "Kwame M.", rank: 1, totalSaved: 45000, avatar: "K", badge: "🥇" },
    { id: "s2", name: "Grace A.", rank: 2, totalSaved: 38500, avatar: "G", badge: "🥈" },
    { id: "s3", name: "Emmanuel K.", rank: 3, totalSaved: 32000, avatar: "E", badge: "🥉" },
    { id: "s4", name: "Aisha M.", rank: 4, totalSaved: 28000, avatar: "A" },
    { id: "s5", name: "David N.", rank: 5, totalSaved: 25000, avatar: "D" },
  ]

  const topXnScores = [
    { id: "x1", name: "Grace A.", rank: 1, xnScore: 98, avatar: "G", badge: "🥇" },
    { id: "x2", name: "Kwame M.", rank: 2, xnScore: 95, avatar: "K", badge: "🥈" },
    { id: "x3", name: "Fatou D.", rank: 3, xnScore: 93, avatar: "F", badge: "🥉" },
    { id: "x4", name: "Kofi A.", rank: 4, xnScore: 91, avatar: "K" },
    { id: "x5", name: "Samuel O.", rank: 5, xnScore: 89, avatar: "S" },
  ]

  const tabs = [
    { id: "referrals", label: "Referrals", icon: "👥" },
    { id: "savings", label: "Savings", icon: "💰" },
    { id: "xnscore", label: "XnScore", icon: "⭐" },
  ]

  const getLeaderboardData = () => {
    switch (activeTab) {
      case "referrals":
        return topReferrers
      case "savings":
        return topSavers
      case "xnscore":
        return topXnScores
      default:
        return topReferrers
    }
  }

  const getMetricLabel = () => {
    switch (activeTab) {
      case "referrals":
        return "referrals"
      case "savings":
        return "saved"
      case "xnscore":
        return "XnScore"
      default:
        return ""
    }
  }

  const getMetricValue = (item: any) => {
    switch (activeTab) {
      case "referrals":
        return item.referrals
      case "savings":
        return `$${item.totalSaved?.toLocaleString()}`
      case "xnscore":
        return item.xnScore
      default:
        return ""
    }
  }

  const getUserMetric = () => {
    switch (activeTab) {
      case "referrals":
        return currentUser.referrals
      case "savings":
        return `$${currentUser.totalSaved?.toLocaleString()}`
      case "xnscore":
        return currentUser.xnScore
      default:
        return ""
    }
  }

  const data = getLeaderboardData()

  const handleBack = () => {
    console.log("Back clicked")
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
          padding: "20px 20px 100px 20px",
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
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Leaderboard</h1>
        </div>

        {/* Your Rank Card */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              fontWeight: "700",
              color: "#FFFFFF",
            }}
          >
            #{currentUser.rank}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600" }}>Your Rank</p>
            <p style={{ margin: 0, fontSize: "13px", opacity: 0.8 }}>
              {getUserMetric()} {getMetricLabel()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>Keep going!</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.6 }}>Top 100 get rewards</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Tabs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "6px",
            marginBottom: "16px",
            display: "flex",
            gap: "4px",
            border: "1px solid #E5E7EB",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === tab.id ? "#0A2342" : "transparent",
                color: activeTab === tab.id ? "#FFFFFF" : "#6B7280",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Top 3 Podium */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            {/* 2nd Place */}
            {data[1] && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 8px auto",
                    border: "3px solid #C0C0C0",
                    fontSize: "22px",
                    fontWeight: "700",
                    color: "#0A2342",
                  }}
                >
                  {data[1].avatar}
                </div>
                <span style={{ fontSize: "20px" }}>🥈</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                  {data[1].name.split(" ")[0]}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{getMetricValue(data[1])}</p>
              </div>
            )}

            {/* 1st Place */}
            {data[0] && (
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    background: "#FEF3C7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 8px auto",
                    border: "4px solid #F59E0B",
                    fontSize: "28px",
                    fontWeight: "700",
                    color: "#0A2342",
                  }}
                >
                  {data[0].avatar}
                </div>
                <span style={{ fontSize: "24px" }}>🥇</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "14px", fontWeight: "700", color: "#0A2342" }}>
                  {data[0].name.split(" ")[0]}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                  {getMetricValue(data[0])}
                </p>
              </div>
            )}

            {/* 3rd Place */}
            {data[2] && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 8px auto",
                    border: "3px solid #CD7F32",
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#0A2342",
                  }}
                >
                  {data[2].avatar}
                </div>
                <span style={{ fontSize: "18px" }}>🥉</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                  {data[2].name.split(" ")[0]}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{getMetricValue(data[2])}</p>
              </div>
            )}
          </div>
        </div>

        {/* Full Rankings */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "8px 8px 12px 8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Full Rankings
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {data.slice(3).map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <span
                  style={{
                    width: "28px",
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#6B7280",
                    textAlign: "center",
                  }}
                >
                  #{item.rank}
                </span>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#0A2342",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  {item.avatar}
                </div>
                <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{item.name}</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>{getMetricValue(item)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prize Info */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginTop: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🏆</span>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Monthly Prizes</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                Top 3 win cash • Top 10 get XnScore bonus
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
