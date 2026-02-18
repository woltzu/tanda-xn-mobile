"use client"

export default function CommunityStandingScreen() {
  const userProfile = {
    name: "Franck Kengne",
    honorScore: 78,
    rank: 42,
    totalMembers: 1560,
    percentile: 97,
    isElder: false,
    badges: [
      { id: "ontime", icon: "⏰", name: "Always On Time", description: "20+ on-time payments" },
      { id: "completer", icon: "🔄", name: "Circle Completer", description: "4 circles completed" },
      { id: "helper", icon: "🤝", name: "Community Helper", description: "Helped 5+ members" },
    ],
    recentRecognitions: [
      { type: "milestone", title: "Gold Member Status", date: "December 2025", icon: "🏅" },
      { type: "streak", title: "6-Month Perfect Payments", date: "November 2025", icon: "🔥" },
    ],
  }

  const topMembers = [
    { rank: 1, name: "Chief Kwame", score: 96, avatar: "CK", isElder: true, change: 0 },
    { rank: 2, name: "Mama Fatou", score: 93, avatar: "MF", isElder: true, change: 1 },
    { rank: 3, name: "Papa Diallo", score: 91, avatar: "PD", isElder: true, change: -1 },
    { rank: 4, name: "Auntie Grace", score: 89, avatar: "AG", isElder: false, change: 2 },
    { rank: 5, name: "Brother Kofi", score: 87, avatar: "BK", isElder: false, change: 0 },
  ]

  const getTierColor = (score: number) => {
    if (score >= 85) return "#00C6AE"
    if (score >= 70) return "#D97706"
    if (score >= 55) return "#6B7280"
    return "#92400E"
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Community Standing</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Your place in the community</p>
          </div>
        </div>

        {/* Rank Card */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background:
                userProfile.percentile >= 95 ? "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)" : "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              boxShadow: userProfile.percentile >= 95 ? "0 4px 20px rgba(255,215,0,0.4)" : "none",
            }}
          >
            <span
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color: userProfile.percentile >= 95 ? "#0A2342" : "#FFFFFF",
              }}
            >
              #{userProfile.rank}
            </span>
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "600" }}>{userProfile.name}</p>
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", opacity: 0.8 }}>
            Top {100 - userProfile.percentile}% of {userProfile.totalMembers.toLocaleString()} members
          </p>
          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>
              Honor Score: {userProfile.honorScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Leaderboard Preview */}
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
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              🏆 Community Leaderboard
            </h3>
            <button
              onClick={() => console.log("View all")}
              style={{
                background: "none",
                border: "none",
                fontSize: "12px",
                color: "#00C6AE",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              View All →
            </button>
          </div>

          {topMembers.map((member, idx) => (
            <div
              key={member.rank}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                background: "transparent",
                marginBottom: idx < topMembers.length - 1 ? "6px" : 0,
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* Rank */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background:
                    member.rank === 1
                      ? "#FFD700"
                      : member.rank === 2
                        ? "#C0C0C0"
                        : member.rank === 3
                          ? "#CD7F32"
                          : "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: member.rank <= 3 ? "#0A2342" : "#6B7280",
                }}
              >
                {member.rank}
              </div>

              {/* Avatar */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: getTierColor(member.score),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                  position: "relative",
                }}
              >
                {member.avatar}
                {member.isElder && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      fontSize: "10px",
                    }}
                  >
                    👴
                  </div>
                )}
              </div>

              {/* Name & Score */}
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{member.score}/100</p>
              </div>

              {/* Change Indicator */}
              {member.change !== 0 && (
                <span style={{ fontSize: "11px", color: member.change > 0 ? "#00897B" : "#DC2626" }}>
                  {member.change > 0 ? "↑" : "↓"} {Math.abs(member.change)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Badges */}
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
            🎖️ Your Badges ({userProfile.badges.length})
          </h3>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
            {userProfile.badges.map((badge) => (
              <button
                key={badge.id}
                onClick={() => console.log("View badge", badge.id)}
                style={{
                  minWidth: "100px",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "28px", display: "block", marginBottom: "6px" }}>{badge.icon}</span>
                <p style={{ margin: "0 0 2px 0", fontSize: "11px", fontWeight: "600", color: "#0A2342" }}>
                  {badge.name}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Recognitions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            ✨ Recent Achievements
          </h3>
          {userProfile.recentRecognitions.map((rec, idx) => (
            <div
              key={idx}
              style={{
                padding: "12px",
                background: "#FEF3C7",
                borderRadius: "10px",
                marginBottom: idx < userProfile.recentRecognitions.length - 1 ? "8px" : 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>{rec.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{rec.title}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#92400E" }}>{rec.date}</p>
                </div>
              </div>
              <button
                onClick={() => console.log("Share achievement", rec.title)}
                style={{
                  padding: "6px 12px",
                  background: "#0A2342",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Share
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
