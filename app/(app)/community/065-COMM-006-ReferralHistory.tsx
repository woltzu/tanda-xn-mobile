"use client"

import { useState } from "react"

export default function ReferralHistoryScreen() {
  const [filter, setFilter] = useState("all")

  const referrals = [
    {
      id: 1,
      name: "Amara Okafor",
      status: "active",
      joinedAt: "Dec 18, 2024",
      reward: 25,
      rewardStatus: "pending",
      totalSaved: 450,
    },
    {
      id: 2,
      name: "Kwame Mensah",
      status: "active",
      joinedAt: "Nov 15, 2024",
      reward: 25,
      rewardStatus: "claimed",
      totalSaved: 1200,
    },
    {
      id: 3,
      name: "David Nguyen",
      status: "pending",
      joinedAt: "Dec 20, 2024",
      reward: 25,
      rewardStatus: "waiting",
      totalSaved: 0,
    },
    {
      id: 4,
      name: "Marie Claire",
      status: "active",
      joinedAt: "Oct 5, 2024",
      reward: 25,
      rewardStatus: "claimed",
      totalSaved: 2800,
    },
    {
      id: 5,
      name: "Samuel Osei",
      status: "active",
      joinedAt: "Sep 22, 2024",
      reward: 15,
      rewardStatus: "claimed",
      totalSaved: 3500,
    },
    {
      id: 6,
      name: "Fatima Hassan",
      status: "inactive",
      joinedAt: "Aug 10, 2024",
      reward: 15,
      rewardStatus: "claimed",
      totalSaved: 200,
    },
    {
      id: 7,
      name: "Chen Wei",
      status: "pending",
      joinedAt: "Dec 22, 2024",
      reward: 25,
      rewardStatus: "waiting",
      totalSaved: 0,
    },
  ]

  const stats = {
    total: 7,
    active: 4,
    pending: 2,
    inactive: 1,
    totalEarned: 155,
  }

  const filters = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "pending", label: "Pending" },
    { id: "inactive", label: "Inactive" },
  ]

  const filteredReferrals = filter === "all" ? referrals : referrals.filter((r) => r.status === filter)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "#F0FDFB", color: "#00897B", label: "Active" }
      case "pending":
        return { bg: "#FEF3C7", color: "#D97706", label: "Pending" }
      case "inactive":
        return { bg: "#F5F7FA", color: "#6B7280", label: "Inactive" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
    }
  }

  const getRewardStatusLabel = (status: string) => {
    switch (status) {
      case "claimed":
        return { text: "Claimed", color: "#6B7280" }
      case "pending":
        return { text: "Ready to claim", color: "#00C6AE" }
      case "waiting":
        return { text: "Waiting", color: "#D97706" }
      default:
        return { text: status, color: "#6B7280" }
    }
  }

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleReferralPress = (referral: any) => {
    console.log("Referral clicked:", referral)
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
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Referral History</h1>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{stats.total}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>Total</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "10px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>{stats.active}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>Active</p>
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
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{stats.pending}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>Pending</p>
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
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>${stats.totalEarned}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>Earned</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
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

        {/* Referral List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          {filteredReferrals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredReferrals.map((referral) => {
                const statusStyle = getStatusColor(referral.status)
                const rewardStyle = getRewardStatusLabel(referral.rewardStatus)

                return (
                  <button
                    key={referral.id}
                    onClick={() => handleReferralPress(referral)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: "#F5F7FA",
                      borderRadius: "12px",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "#0A2342",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "600",
                          fontSize: "16px",
                          flexShrink: 0,
                        }}
                      >
                        {referral.name.charAt(0)}
                      </div>

                      <div style={{ flex: 1 }}>
                        {/* Name & Status */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{referral.name}</span>
                          <span
                            style={{
                              background: statusStyle.bg,
                              color: statusStyle.color,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "10px",
                              fontWeight: "600",
                            }}
                          >
                            {statusStyle.label}
                          </span>
                        </div>

                        {/* Joined Date */}
                        <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#6B7280" }}>
                          Joined {referral.joinedAt}
                        </p>

                        {/* Stats Row */}
                        <div style={{ display: "flex", gap: "16px" }}>
                          <div>
                            <span style={{ fontSize: "10px", color: "#9CA3AF" }}>Reward</span>
                            <p
                              style={{
                                margin: "2px 0 0 0",
                                fontSize: "13px",
                                fontWeight: "600",
                                color: rewardStyle.color,
                              }}
                            >
                              ${referral.reward} • {rewardStyle.text}
                            </p>
                          </div>
                          {referral.totalSaved > 0 && (
                            <div>
                              <span style={{ fontSize: "10px", color: "#9CA3AF" }}>They've saved</span>
                              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                                ${referral.totalSaved.toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#D1D5DB"
                        strokeWidth="2"
                        style={{ marginTop: "12px" }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No referrals in this category</p>
            </div>
          )}
        </div>

        {/* Info Note */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Active referrals</strong> are friends who have made at least one deposit and are actively saving.
            You earn more when they succeed!
          </p>
        </div>
      </div>
    </div>
  )
}
