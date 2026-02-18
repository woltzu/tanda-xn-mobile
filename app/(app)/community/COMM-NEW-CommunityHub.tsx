"use client"

import { useState } from "react"

export default function CommunityHub() {
  const [activeTab, setActiveTab] = useState("circles")

  const community = {
    id: "c1",
    name: "Ivorian in Atlanta",
    icon: "🇨🇮",
    type: "diaspora",
    description: "Connecting Ivorians living in Atlanta, Georgia. Building community through savings.",
    members: 342,
    verified: true,
    isJoined: true,
    role: "member",
    parent: { id: "p1", name: "Ivorian in Georgia", members: 1240 },
    stats: {
      totalSaved: 125000,
      activeCircles: 8,
      completedCircles: 23,
      avgXnScore: 78,
    },
  }

  const subCommunities = [
    { id: "s1", name: "Ivorian in Marietta", icon: "🇨🇮", members: 89 },
    { id: "s2", name: "Ivorian Students ATL", icon: "🎓", members: 156 },
  ]

  const circles = [
    {
      id: "cr1",
      name: "Atlanta Monthly Tanda",
      contribution: 100,
      frequency: "monthly",
      members: 8,
      maxMembers: 10,
      status: "active",
      nextPayout: "Jan 15",
      spotsLeft: 2,
    },
    {
      id: "cr2",
      name: "Ivorian Emergency Fund",
      contribution: 50,
      frequency: "weekly",
      members: 6,
      maxMembers: 6,
      status: "full",
      type: "emergency",
    },
    {
      id: "cr3",
      name: "Business Owners Circle",
      contribution: 500,
      frequency: "monthly",
      members: 4,
      maxMembers: 8,
      status: "forming",
      spotsLeft: 4,
    },
  ]

  const tabs = [
    { id: "circles", label: "Circles", count: circles.length },
    { id: "sub", label: "Sub-communities", count: subCommunities.length },
    { id: "members", label: "Members", count: community.members },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#00C6AE"
      case "forming":
        return "#D97706"
      case "full":
        return "#6B7280"
      default:
        return "#6B7280"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active"
      case "forming":
        return "Forming"
      case "full":
        return "Full"
      default:
        return status
    }
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
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          paddingBottom: "80px",
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
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            {/* Parent community breadcrumb */}
            {community.parent && (
              <button
                onClick={() => console.log("View parent", community.parent)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{community.parent.name}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>{community.name}</h1>
              {community.verified && (
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          </div>
          <button
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "10px",
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>

        {/* Stats Row */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "10px 14px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{community.members}</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Members</p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "10px 14px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{community.stats.activeCircles}</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Circles</p>
          </div>
          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              borderRadius: "10px",
              padding: "10px 14px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
              ${(community.stats.totalSaved / 1000).toFixed(0)}k
            </p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Total Saved</p>
          </div>
        </div>
      </div>

      {/* Community Card - Overlapping */}
      <div
        style={{
          margin: "-60px 20px 20px 20px",
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 4px 20px rgba(10, 35, 66, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "#F5F7FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
            }}
          >
            {community.icon}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#6B7280" }}>
              {community.type === "diaspora"
                ? "Diaspora Community"
                : community.type === "religious"
                  ? "Faith Community"
                  : "Community"}
            </p>
            <p style={{ margin: 0, fontSize: "14px", color: "#0A2342", lineHeight: 1.4 }}>{community.description}</p>
          </div>
        </div>

        {/* Member Badge */}
        {community.isJoined && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#F0FDFB",
              padding: "6px 12px",
              borderRadius: "20px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#00897B" }}>
              {community.role === "elder" ? "Elder" : community.role === "admin" ? "Admin" : "Member"}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "0 20px",
          marginBottom: "16px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: activeTab === tab.id ? "#0A2342" : "#FFFFFF",
              color: activeTab === tab.id ? "#FFFFFF" : "#0A2342",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {tab.label}
            <span
              style={{
                background: activeTab === tab.id ? "rgba(0,198,174,0.3)" : "#F5F7FA",
                padding: "2px 8px",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px" }}>
        {/* CIRCLES TAB */}
        {activeTab === "circles" && (
          <>
            {/* Create Circle CTA */}
            <button
              onClick={() => console.log("Create circle")}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "2px dashed #00C6AE",
                background: "#F0FDFB",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00897B" }}>Create New Circle</span>
            </button>

            {/* Circles List */}
            {circles.map((circle) => (
              <div
                key={circle.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "12px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                        {circle.name}
                      </h4>
                      <span
                        style={{
                          background: `${getStatusColor(circle.status)}20`,
                          color: getStatusColor(circle.status),
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontWeight: "600",
                        }}
                      >
                        {getStatusLabel(circle.status)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                      ${circle.contribution}/{circle.frequency} • {circle.members}/{circle.maxMembers} members
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "6px",
                    borderRadius: "3px",
                    background: "#F5F7FA",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(circle.members / circle.maxMembers) * 100}%`,
                      borderRadius: "3px",
                      background: getStatusColor(circle.status),
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {circle.nextPayout && (
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>Next payout: {circle.nextPayout}</span>
                    )}
                    {circle.spotsLeft && circle.spotsLeft > 0 && (
                      <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "500" }}>
                        {circle.spotsLeft} spots left
                      </span>
                    )}
                  </div>

                  {circle.status !== "full" && (
                    <button
                      onClick={() => console.log("Join circle", circle)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#00C6AE",
                        color: "#FFFFFF",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* SUB-COMMUNITIES TAB */}
        {activeTab === "sub" && (
          <>
            {subCommunities.length > 0 ? (
              subCommunities.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => console.log("View sub-community", sub)}
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "14px",
                    padding: "16px",
                    marginBottom: "10px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    {sub.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{sub.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{sub.members} members</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  background: "#FFFFFF",
                  borderRadius: "16px",
                }}
              >
                <span style={{ fontSize: "40px" }}>🏘️</span>
                <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No sub-communities yet</p>
              </div>
            )}
          </>
        )}

        {/* MEMBERS TAB */}
        {activeTab === "members" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
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
              }}
            >
              <span style={{ fontSize: "28px" }}>👥</span>
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
              {community.members}
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#6B7280" }}>Community members</p>
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                Avg. XnScore: <strong style={{ color: "#00C6AE" }}>{community.stats.avgXnScore}</strong>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
