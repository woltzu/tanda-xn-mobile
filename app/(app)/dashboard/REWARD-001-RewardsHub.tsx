"use client"

import { TabBarInline } from "../../../components/TabBar"

export default function RewardsHubScreen() {
  const points = 2450
  const tier = "Silver"
  const rewards = [
    {
      id: "r1",
      title: "First Circle Complete",
      description: "Completed your first savings circle",
      points: 500,
      earned: true,
      icon: "🎯",
    },
    {
      id: "r2",
      title: "Perfect Payer",
      description: "10 on-time contributions",
      points: 250,
      earned: true,
      icon: "⭐",
    },
    { id: "r3", title: "Community Builder", description: "Invited 3 friends", points: 300, earned: true, icon: "👥" },
    {
      id: "r4",
      title: "Global Sender",
      description: "Send money to 3 countries",
      points: 400,
      earned: false,
      progress: 2,
      total: 3,
      icon: "🌍",
    },
    {
      id: "r5",
      title: "XnScore Master",
      description: "Reach XnScore of 80",
      points: 500,
      earned: false,
      progress: 72,
      total: 80,
      icon: "📈",
    },
  ]

  const earnedRewards = rewards.filter((r) => r.earned)
  const inProgressRewards = rewards.filter((r) => !r.earned)

  const handleBack = () => {
    console.log("Navigating back...")
  }

  const handleRedeemPoints = () => {
    console.log("Redeeming points...")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Rewards</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Earn points, unlock perks</p>
          </div>
        </div>

        {/* Points Display */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Your Points</p>
          <p style={{ margin: "0 0 8px 0", fontSize: "40px", fontWeight: "700" }}>{points.toLocaleString()}</p>
          <span
            style={{
              padding: "6px 16px",
              background: "rgba(0,198,174,0.2)",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#00C6AE",
            }}
          >
            {tier} Member
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Redeem CTA */}
        <button
          onClick={handleRedeemPoints}
          style={{
            width: "100%",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            marginBottom: "16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>🎁</span>
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Redeem Points</p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Cash, vouchers, and more</p>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Earned Rewards */}
        {earnedRewards.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              🏆 Earned ({earnedRewards.length})
            </h3>
            {earnedRewards.map((reward, idx) => (
              <div
                key={reward.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: idx < earnedRewards.length - 1 ? "1px solid #F5F7FA" : "none",
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
                    fontSize: "22px",
                  }}
                >
                  {reward.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                    {reward.title}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{reward.description}</p>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>+{reward.points}</span>
              </div>
            ))}
          </div>
        )}

        {/* In Progress */}
        {inProgressRewards.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              🎯 In Progress
            </h3>
            {inProgressRewards.map((reward, idx) => (
              <div
                key={reward.id}
                style={{
                  padding: "12px 0",
                  borderBottom: idx < inProgressRewards.length - 1 ? "1px solid #F5F7FA" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
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
                      opacity: 0.6,
                    }}
                  >
                    {reward.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                      {reward.title}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{reward.description}</p>
                  </div>
                  <span style={{ fontSize: "12px", color: "#9CA3AF" }}>+{reward.points} pts</span>
                </div>
                {/* Progress Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "56px" }}>
                  <div style={{ flex: 1, height: "6px", background: "#F5F7FA", borderRadius: "3px" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(reward.progress / reward.total) * 100}%`,
                        background: "#00C6AE",
                        borderRadius: "3px",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>
                    {reward.progress}/{reward.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
