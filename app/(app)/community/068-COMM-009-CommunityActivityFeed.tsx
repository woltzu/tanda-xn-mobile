"use client"

import { useState } from "react"

export default function CommunityActivityFeedScreen() {
  const [filter, setFilter] = useState("all")

  const activities = [
    {
      id: 1,
      type: "milestone",
      title: "Community Milestone! 🎉",
      description: "TandaXn community has collectively saved $3,000,000!",
      time: "2 hours ago",
      icon: "🏆",
    },
    {
      id: 2,
      type: "referral",
      title: "New Member",
      description: "Amara joined using Franck's referral code",
      time: "3 hours ago",
      icon: "👋",
      isYours: true,
    },
    {
      id: 3,
      type: "circle_complete",
      title: "Circle Completed",
      description: "Family Savings Circle completed their cycle!",
      time: "5 hours ago",
      icon: "✅",
      members: 8,
    },
    {
      id: 4,
      type: "top_saver",
      title: "Top Saver This Week",
      description: "Grace A. saved $2,500 this week!",
      time: "8 hours ago",
      icon: "💰",
    },
    {
      id: 5,
      type: "endorsement",
      title: "Endorsement",
      description: "Kwame endorsed you as a reliable member",
      time: "1 day ago",
      icon: "💝",
      isYours: true,
    },
    {
      id: 6,
      type: "new_circle",
      title: "New Circle Formed",
      description: "Travel Fund 2025 circle is now active with 6 members",
      time: "1 day ago",
      icon: "🔄",
    },
    {
      id: 7,
      type: "goal_achieved",
      title: "Goal Achieved!",
      description: "15 members reached their savings goals this week",
      time: "2 days ago",
      icon: "🎯",
    },
    {
      id: 8,
      type: "xnscore",
      title: "XnScore Leader",
      description: "3 members achieved Excellent (90+) XnScore this month",
      time: "3 days ago",
      icon: "⭐",
    },
  ]

  const filters = [
    { id: "all", label: "All" },
    { id: "yours", label: "Your Activity" },
    { id: "milestones", label: "Milestones" },
  ]

  const filteredActivities =
    filter === "all"
      ? activities
      : filter === "yours"
        ? activities.filter((a) => a.isYours)
        : activities.filter((a) => a.type === "milestone" || a.type === "goal_achieved" || a.type === "top_saver")

  const getActivityStyle = (type: string) => {
    switch (type) {
      case "milestone":
        return { bg: "#F0FDFB", border: "#00C6AE" }
      case "referral":
        return { bg: "#F5F7FA", border: "transparent" }
      case "circle_complete":
        return { bg: "#F5F7FA", border: "transparent" }
      case "endorsement":
        return { bg: "#FEF3C7", border: "transparent" }
      case "top_saver":
        return { bg: "#F5F7FA", border: "transparent" }
      default:
        return { bg: "#F5F7FA", border: "transparent" }
    }
  }

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleActivityPress = (activity: any) => {
    console.log("Activity clicked:", activity)
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
          padding: "20px 20px 60px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Community Activity</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>See what's happening in the community</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-30px", padding: "0 20px" }}>
        {/* Filters */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "16px",
            display: "flex",
            gap: "4px",
            border: "1px solid #E5E7EB",
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
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredActivities.length > 0 ? (
            filteredActivities.map((activity) => {
              const style = getActivityStyle(activity.type)

              return (
                <button
                  key={activity.id}
                  onClick={() => handleActivityPress(activity)}
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "16px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "14px",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: style.bg,
                        border: style.border !== "transparent" ? `2px solid ${style.border}` : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                        flexShrink: 0,
                      }}
                    >
                      {activity.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                          {activity.title}
                        </h3>
                        {activity.isYours && (
                          <span
                            style={{
                              background: "#00C6AE",
                              color: "#FFFFFF",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "10px",
                              fontWeight: "600",
                            }}
                          >
                            You
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#6B7280", lineHeight: 1.4 }}>
                        {activity.description}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{activity.time}</span>
                        {activity.members && (
                          <>
                            <span style={{ color: "#D1D5DB" }}>•</span>
                            <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{activity.members} members</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "40px 20px",
                border: "1px solid #E5E7EB",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px auto",
                  fontSize: "28px",
                }}
              >
                📭
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                No activity yet
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                {filter === "yours" ? "Your activities will appear here" : "Check back later for updates"}
              </p>
            </div>
          )}
        </div>

        {/* Community Stats */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginTop: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
            Community Stats
          </h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>892</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>Active Circles</p>
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>12.4K</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>Members</p>
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>$3.2M</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>Total Saved</p>
            </div>
          </div>
        </div>

        {/* Invite CTA */}
        <div
          style={{
            background: "#F0FDFB",
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
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            👥
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Grow the community</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Invite friends and earn $25 each</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  )
}
