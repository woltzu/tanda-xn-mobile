"use client"

import { useState } from "react"

export default function VouchHistoryImpactScreen() {
  const [filterStatus, setFilterStatus] = useState("all")
  const [showExportModal, setShowExportModal] = useState(false)

  const stats = {
    totalVouches: 24,
    activeVouches: 18,
    successRate: 87,
    honorScoreImpact: "+145",
    failedVouches: 3,
    avgPointsGiven: 22,
  }

  const vouches = [
    {
      id: "v1",
      memberName: "Alex Okonkwo",
      memberAvatar: "A",
      circleContext: "Lagos Traders Monthly",
      pointsGiven: 25,
      dateGiven: "Dec 15, 2024",
      status: "active",
      memberPerformance: "excellent",
      xnScoreChange: "+45",
      yourImpact: "+5 HS",
    },
    {
      id: "v2",
      memberName: "Priya Sharma",
      memberAvatar: "P",
      circleContext: "Tech Savers Circle",
      pointsGiven: 15,
      dateGiven: "Nov 28, 2024",
      status: "completed",
      memberPerformance: "good",
      xnScoreChange: "+30",
      yourImpact: "+3 HS",
    },
    {
      id: "v3",
      memberName: "James Nwosu",
      memberAvatar: "J",
      circleContext: "Business Owners Fund",
      pointsGiven: 25,
      dateGiven: "Oct 10, 2024",
      status: "failed",
      memberPerformance: "defaulted",
      xnScoreChange: "-120",
      yourImpact: "-15 HS",
    },
    {
      id: "v4",
      memberName: "Kofi Mensah",
      memberAvatar: "K",
      circleContext: "Ghana Monthly Tanda",
      pointsGiven: 10,
      dateGiven: "Sep 05, 2024",
      status: "completed",
      memberPerformance: "excellent",
      xnScoreChange: "+55",
      yourImpact: "+5 HS",
    },
  ]

  const statusFilters = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "failed", label: "Failed" },
  ]

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "#F0FDFB", color: "#00897B", label: "Active" }
      case "completed":
        return { bg: "#F5F7FA", color: "#6B7280", label: "Completed" }
      case "failed":
        return { bg: "#FEE2E2", color: "#DC2626", label: "Failed" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
    }
  }

  const getPerformanceIcon = (perf: string) => {
    switch (perf) {
      case "excellent":
        return "🌟"
      case "good":
        return "✓"
      case "defaulted":
        return "⚠️"
      default:
        return "•"
    }
  }

  const filteredVouches = vouches.filter((v) => filterStatus === "all" || v.status === filterStatus)

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
            onClick={() => console.log("Go back")}
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Vouch History</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Track your vouches and their impact
            </p>
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>

        {/* Stats Row */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>{stats.totalVouches}</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Total</p>
          </div>
          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "12px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>{stats.successRate}%</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Success</p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>{stats.honorScoreImpact}</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>HS Impact</p>
          </div>
        </div>
      </div>

      {/* Impact Summary Card - Overlapping */}
      <div
        style={{
          margin: "-60px 20px 20px 20px",
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 4px 20px rgba(10, 35, 66, 0.1)",
        }}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
          📊 Your Vouch Impact
        </h3>

        <div style={{ display: "flex", gap: "12px" }}>
          {/* Success Rate Gauge */}
          <div
            style={{
              flex: 1,
              background: "#F5F7FA",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: `conic-gradient(#00C6AE ${stats.successRate}%, #E5E7EB ${stats.successRate}%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px auto",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#00C6AE",
                }}
              >
                {stats.successRate}%
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Success Rate</p>
          </div>

          {/* Stats */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Active vouches</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>{stats.activeVouches}</span>
              </div>
            </div>
            <div
              style={{
                background: "#FEE2E2",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Failed vouches</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#DC2626" }}>{stats.failedVouches}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px" }}>
        {/* Filter Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px",
            overflowX: "auto",
          }}
        >
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                background: filterStatus === filter.id ? "#0A2342" : "#FFFFFF",
                color: filterStatus === filter.id ? "#FFFFFF" : "#0A2342",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Timeline</h3>

        {filteredVouches.map((vouch, idx) => {
          const statusStyle = getStatusStyle(vouch.status)
          return (
            <button
              key={vouch.id}
              onClick={() => console.log("View member", vouch)}
              style={{
                width: "100%",
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "12px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
              }}
            >
              {/* Timeline connector */}
              {idx < filteredVouches.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: "36px",
                    bottom: "-12px",
                    width: "2px",
                    height: "24px",
                    background: "#E5E7EB",
                  }}
                />
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                {/* Avatar */}
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background:
                      vouch.status === "failed"
                        ? "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)"
                        : "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "700",
                    color: "#FFFFFF",
                    flexShrink: 0,
                  }}
                >
                  {vouch.memberAvatar}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                        {vouch.memberName}
                      </h4>
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
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>{vouch.dateGiven}</span>
                  </div>

                  <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#6B7280" }}>
                    {vouch.circleContext} • +{vouch.pointsGiven} pts
                  </p>

                  {/* Performance & Impact */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div
                      style={{
                        background: "#F5F7FA",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>{getPerformanceIcon(vouch.memberPerformance)}</span>
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>
                        XnScore:{" "}
                        <strong
                          style={{
                            color: vouch.xnScoreChange.startsWith("+") ? "#00C6AE" : "#DC2626",
                          }}
                        >
                          {vouch.xnScoreChange}
                        </strong>
                      </span>
                    </div>
                    <div
                      style={{
                        background: vouch.yourImpact.startsWith("+") ? "#F0FDFB" : "#FEE2E2",
                        borderRadius: "8px",
                        padding: "8px 12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: vouch.yourImpact.startsWith("+") ? "#00897B" : "#DC2626",
                        }}
                      >
                        You: {vouch.yourImpact}
                      </span>
                    </div>
                  </div>
                </div>

                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          )
        })}

        {filteredVouches.length === 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "40px" }}>📭</span>
            <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No vouches in this category</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "20px",
              width: "100%",
              maxWidth: "400px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>Export Report</h3>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Export your vouch history for Elder review meetings
            </p>

            {[
              { format: "PDF", icon: "📄", desc: "Formal report with charts" },
              { format: "CSV", icon: "📊", desc: "Spreadsheet data" },
              { format: "Share", icon: "📤", desc: "Send to Elder Council" },
            ].map((opt) => (
              <button
                key={opt.format}
                onClick={() => {
                  console.log("Export", opt.format)
                  setShowExportModal(false)
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "24px" }}>{opt.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{opt.format}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
