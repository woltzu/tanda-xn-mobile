"use client"

export default function GoalMilestonesScreen() {
  const goal = {
    name: "Emergency Fund",
    emoji: "🛡️",
    targetAmount: 5000,
    currentAmount: 3200,
    tier: "emergency",
  }

  const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100)

  const milestones = [
    {
      percent: 10,
      label: "Getting Started",
      reward: "+5 XnScore",
      badge: "🌱",
      badgeName: "Seed Saver",
    },
    {
      percent: 25,
      label: "Quarter Way",
      reward: "+10 XnScore",
      badge: "🌿",
      badgeName: "Growing",
    },
    {
      percent: 50,
      label: "Halfway There",
      reward: "+15 XnScore",
      badge: "🌳",
      badgeName: "Half Hero",
    },
    {
      percent: 75,
      label: "Almost There",
      reward: "+20 XnScore",
      badge: "⭐",
      badgeName: "Star Saver",
    },
    {
      percent: 100,
      label: "Goal Complete!",
      reward: "+50 XnScore + $10 bonus",
      badge: "🏆",
      badgeName: "Champion",
    },
  ]

  const earnedBadges = milestones.filter((m) => progress >= m.percent)
  const nextMilestone = milestones.find((m) => progress < m.percent)

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Milestones & Rewards</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {goal.emoji} {goal.name}
            </p>
          </div>
        </div>

        {/* Stars Display */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                style={{
                  fontSize: "28px",
                  opacity: earnedBadges.length >= star ? 1 : 0.3,
                }}
              >
                ⭐
              </span>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>{earnedBadges.length} of 5 milestones reached</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Milestone Timeline */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Your Journey</h3>

          <div style={{ position: "relative" }}>
            {/* Progress Line */}
            <div
              style={{
                position: "absolute",
                left: "20px",
                top: "20px",
                bottom: "20px",
                width: "4px",
                background: "#E5E7EB",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.min(100, (progress / 100) * 100)}%`,
                  background: "#00C6AE",
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Milestones */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {milestones.map((milestone, idx) => {
                const isReached = progress >= milestone.percent
                const isCurrent = nextMilestone?.percent === milestone.percent

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "16px",
                      paddingLeft: "4px",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: isReached ? "#00C6AE" : isCurrent ? "#0A2342" : "#E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        zIndex: 1,
                        border: isCurrent ? "3px solid #00C6AE" : "none",
                      }}
                    >
                      {isReached ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span style={{ fontSize: "14px", color: isCurrent ? "#FFFFFF" : "#9CA3AF" }}>
                          {milestone.percent}%
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div
                      style={{
                        flex: 1,
                        padding: "12px 14px",
                        background: isReached ? "#F0FDFB" : isCurrent ? "#F5F7FA" : "transparent",
                        borderRadius: "12px",
                        border: isReached
                          ? "1px solid #00C6AE"
                          : isCurrent
                            ? "1px solid #0A2342"
                            : "1px solid transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "20px" }}>{milestone.badge}</span>
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#0A2342",
                            }}
                          >
                            {milestone.label}
                          </p>
                          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                            {milestone.badgeName}
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: isReached ? "#00C6AE" : "#E5E7EB",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          marginTop: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: isReached ? "#FFFFFF" : "#6B7280",
                          }}
                        >
                          {milestone.reward}
                        </span>
                      </div>

                      {isReached && (
                        <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#00897B" }}>✓ Completed</p>
                      )}
                      {isCurrent && (
                        <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#0A2342" }}>
                          {milestone.percent - progress}% more to unlock
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Badges Collection */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Badges Earned</h3>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {milestones.map((milestone, idx) => {
              const isEarned = progress >= milestone.percent

              return (
                <div
                  key={idx}
                  style={{
                    width: "calc(33.33% - 8px)",
                    textAlign: "center",
                    opacity: isEarned ? 1 : 0.4,
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: isEarned ? "#F0FDFB" : "#F5F7FA",
                      border: isEarned ? "2px solid #00C6AE" : "2px solid #E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "28px",
                      margin: "0 auto 8px auto",
                    }}
                  >
                    {milestone.badge}
                  </div>
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: "500", color: "#0A2342" }}>
                    {milestone.badgeName}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#9CA3AF" }}>{milestone.percent}%</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Share Button */}
        {earnedBadges.length > 0 && (
          <button
            onClick={() => console.log("Share Achievement")}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "15px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Achievement
          </button>
        )}
      </div>
    </div>
  )
}
