"use client"

export default function CommunityHubScreen() {
  const user = {
    name: "Franck",
    referralCode: "FRANCK2024",
    totalReferrals: 7,
    pendingRewards: 35,
    lifetimeRewards: 140,
    rank: 23,
    endorsements: 12,
  }

  const stats = {
    totalMembers: 12450,
    totalSaved: 2850000,
    circlesActive: 892,
  }

  const quickActions = [
    { id: "invite", label: "Invite Friends", icon: "users", badge: "$25/referral" },
    { id: "leaderboard", label: "Leaderboard", icon: "trophy", badge: `#${23}` },
    { id: "endorsements", label: "Endorsements", icon: "heart", badge: "12" },
    { id: "activity", label: "Activity", icon: "activity", badge: "New" },
  ]

  const recentActivity = [
    { id: 1, type: "referral", text: "Amara joined using your code", time: "2h ago", reward: "+$25" },
    { id: 2, type: "endorsement", text: "Kwame endorsed you", time: "1d ago" },
    { id: 3, type: "milestone", text: "Community hit $2.8M saved!", time: "2d ago" },
  ]

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleInvite = () => {
    console.log("Invite clicked")
  }

  const handleLeaderboard = () => {
    console.log("Leaderboard clicked")
  }

  const handleEndorsements = () => {
    console.log("Endorsements clicked")
  }

  const handleActivity = () => {
    console.log("Activity clicked")
  }

  const renderIcon = (name: string) => {
    switch (name) {
      case "users":
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )
      case "trophy":
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        )
      case "heart":
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        )
      case "activity":
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        )
      default:
        return null
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Community</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Save Together. Grow Together.</p>
          </div>
        </div>

        {/* Community Stats */}
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
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.7 }}>Members</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{(stats.totalMembers / 1000).toFixed(1)}K</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.7 }}>Total Saved</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>
              ${(stats.totalSaved / 1000000).toFixed(1)}M
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.7 }}>Circles</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{stats.circlesActive}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Your Referral Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Your Referral Code</p>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342", letterSpacing: "1px" }}>
                {user.referralCode}
              </p>
            </div>
            <button
              onClick={handleInvite}
              style={{
                background: "#00C6AE",
                border: "none",
                borderRadius: "10px",
                padding: "10px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "#FFFFFF",
                fontWeight: "600",
                fontSize: "13px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: "0 0 2px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                {user.totalReferrals}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Referrals</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "#F0FDFB", borderRadius: "10px" }}>
              <p style={{ margin: "0 0 2px 0", fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                ${user.pendingRewards}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Pending</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: "0 0 2px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                ${user.lifetimeRewards}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Lifetime</p>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                if (action.id === "invite") handleInvite()
                if (action.id === "leaderboard") handleLeaderboard()
                if (action.id === "endorsements") handleEndorsements()
                if (action.id === "activity") handleActivity()
              }}
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "16px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00C6AE",
                  marginBottom: "10px",
                }}
              >
                {renderIcon(action.icon)}
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{action.label}</p>
              <span
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  background: action.badge === "New" ? "#00C6AE" : "#F5F7FA",
                  color: action.badge === "New" ? "#FFFFFF" : "#0A2342",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "10px",
                  fontWeight: "700",
                }}
              >
                {action.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Recent Activity</h3>
            <button
              onClick={handleActivity}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              View All
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentActivity.map((item) => (
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
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background:
                      item.type === "referral" ? "#F0FDFB" : item.type === "endorsement" ? "#FEF3C7" : "#E0E7FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.type === "referral" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  )}
                  {item.type === "endorsement" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  )}
                  {item.type === "milestone" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{item.text}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>{item.time}</p>
                </div>
                {item.reward && (
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#00C6AE" }}>{item.reward}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
              Earn $25 for every friend who joins
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>No limit on referrals</p>
          </div>
        </div>
      </div>
    </div>
  )
}
