"use client"

import { useState } from "react"

export default function ElderOversightDashboard() {
  const [activeTab, setActiveTab] = useState("overview")

  const systemStats = {
    totalElders: 124,
    activeElders: 98,
    avgResolutionTime: "2.3 days",
    avgSatisfaction: 4.6,
    casesThisMonth: 67,
    pendingCases: 12,
    appealRate: "8%",
    vouchSuccessRate: "91%",
  }

  const problemElders = [
    {
      id: "pe1",
      name: "Elder Marcus Johnson",
      avatar: "M",
      tier: "Junior",
      issue: "High appeal rate",
      appealRate: 28,
      avgRating: 3.2,
      casesOverdue: 2,
      flaggedSince: "5 days ago",
    },
    {
      id: "pe2",
      name: "Elder Sarah Chen",
      avatar: "S",
      tier: "Senior",
      issue: "Low ratings",
      appealRate: 12,
      avgRating: 2.8,
      casesOverdue: 0,
      flaggedSince: "3 days ago",
    },
  ]

  const stuckCases = [
    {
      id: "sc1",
      caseNumber: "CASE-2025-003",
      title: "Payment dispute - circle dissolution",
      assignedTo: "Elder James",
      daysOpen: 9,
      severity: "high",
    },
    {
      id: "sc2",
      caseNumber: "CASE-2025-007",
      title: "Member misconduct allegation",
      assignedTo: "Elder Priya",
      daysOpen: 8,
      severity: "medium",
    },
  ]

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "problems", label: "Problems", icon: "⚠️", badge: problemElders.length },
    { id: "stuck", label: "Stuck Cases", icon: "⏰", badge: stuckCases.length },
  ]

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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Elder Oversight</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              System health & performance
            </p>
          </div>
          <button
            onClick={() => console.log("Generate Report")}
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </button>
        </div>

        {/* Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Active Elders</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700" }}>
              {systemStats.activeElders}
              <span style={{ fontSize: "14px", opacity: 0.7 }}>/{systemStats.totalElders}</span>
            </p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Avg Resolution</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700" }}>{systemStats.avgResolutionTime}</p>
          </div>
          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Satisfaction</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
              {systemStats.avgSatisfaction}/5.0
            </p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Cases This Month</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700" }}>{systemStats.casesThisMonth}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          padding: "0 20px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "14px 8px",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #0A2342" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "14px" }}>{tab.icon}</span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? "600" : "500",
                color: activeTab === tab.id ? "#0A2342" : "#6B7280",
              }}
            >
              {tab.label}
            </span>
            {tab.badge && tab.badge > 0 && (
              <span
                style={{
                  background: "#DC2626",
                  color: "#FFFFFF",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: "600",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* Health Indicators */}
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              System Health
            </h3>

            {[
              {
                label: "Appeal Rate",
                value: systemStats.appealRate,
                target: "< 10%",
                status: Number.parseInt(systemStats.appealRate) < 10 ? "good" : "warning",
              },
              {
                label: "Vouch Success Rate",
                value: systemStats.vouchSuccessRate,
                target: "> 85%",
                status: Number.parseInt(systemStats.vouchSuccessRate) > 85 ? "good" : "warning",
              },
              {
                label: "Pending Cases",
                value: systemStats.pendingCases,
                target: "< 20",
                status: systemStats.pendingCases < 20 ? "good" : "warning",
              },
            ].map((metric, idx) => (
              <div
                key={idx}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: "1px solid #E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>{metric.label}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#9CA3AF" }}>Target: {metric.target}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{metric.value}</span>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: metric.status === "good" ? "#00C6AE" : "#D97706",
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Tier Distribution */}
            <h3 style={{ margin: "20px 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              Elder Distribution
            </h3>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #E5E7EB",
              }}
            >
              {[
                { tier: "Grand Elder", count: 8, percent: 8, color: "#7C3AED" },
                { tier: "Senior Elder", count: 34, percent: 35, color: "#00C6AE" },
                { tier: "Junior Elder", count: 56, percent: 57, color: "#6B7280" },
              ].map((tier, idx) => (
                <div key={idx} style={{ marginBottom: idx < 2 ? "16px" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13px", color: "#0A2342" }}>{tier.tier}</span>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                      {tier.count} ({tier.percent}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      background: "#E5E7EB",
                      borderRadius: "4px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${tier.percent}%`,
                        background: tier.color,
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PROBLEMS TAB */}
        {activeTab === "problems" && (
          <>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              Elders Requiring Attention
            </h3>

            {problemElders.map((elder) => (
              <div
                key={elder.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "12px",
                  border: "2px solid #FEF3C7",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "#D97706",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    {elder.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{elder.name}</h4>
                      <span
                        style={{
                          background: "#FEF3C7",
                          color: "#D97706",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontWeight: "600",
                        }}
                      >
                        {elder.issue}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#6B7280" }}>
                      {elder.tier} • Flagged {elder.flaggedSince}
                    </p>

                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: elder.appealRate > 20 ? "#FEE2E2" : "#F5F7FA",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          color: elder.appealRate > 20 ? "#DC2626" : "#6B7280",
                        }}
                      >
                        Appeal: {elder.appealRate}%
                      </span>
                      <span
                        style={{
                          background: elder.avgRating < 3.5 ? "#FEE2E2" : "#F5F7FA",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          color: elder.avgRating < 3.5 ? "#DC2626" : "#6B7280",
                        }}
                      >
                        Rating: {elder.avgRating}
                      </span>
                      {elder.casesOverdue > 0 && (
                        <span
                          style={{
                            background: "#FEE2E2",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            color: "#DC2626",
                          }}
                        >
                          {elder.casesOverdue} overdue
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                  <button
                    onClick={() => console.log("View Elder", elder)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#6B7280",
                      cursor: "pointer",
                    }}
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => console.log("Intervene", elder)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#D97706",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    Intervene
                  </button>
                </div>
              </div>
            ))}

            {problemElders.length === 0 && (
              <div
                style={{
                  background: "#F0FDFB",
                  borderRadius: "16px",
                  padding: "40px 20px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "40px" }}>✅</span>
                <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#00897B" }}>All Elders performing well</p>
              </div>
            )}
          </>
        )}

        {/* STUCK CASES TAB */}
        {activeTab === "stuck" && (
          <>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              Cases Open {"> "}7 Days
            </h3>

            {stuckCases.map((caseItem) => (
              <div
                key={caseItem.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: caseItem.severity === "high" ? "2px solid #FEE2E2" : "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "#6B7280", fontFamily: "monospace" }}>
                    {caseItem.caseNumber}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        background: caseItem.severity === "high" ? "#FEE2E2" : "#FEF3C7",
                        color: caseItem.severity === "high" ? "#DC2626" : "#D97706",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                      }}
                    >
                      {caseItem.severity}
                    </span>
                    <span
                      style={{
                        background: "#FEE2E2",
                        color: "#DC2626",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                      }}
                    >
                      {caseItem.daysOpen} days
                    </span>
                  </div>
                </div>

                <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  {caseItem.title}
                </h4>
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
                  Assigned to: {caseItem.assignedTo}
                </p>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => console.log("View Case", caseItem)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#6B7280",
                      cursor: "pointer",
                    }}
                  >
                    View Case
                  </button>
                  <button
                    onClick={() => console.log("Reassign", caseItem)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#DC2626",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    Reassign
                  </button>
                </div>
              </div>
            ))}

            {stuckCases.length === 0 && (
              <div
                style={{
                  background: "#F0FDFB",
                  borderRadius: "16px",
                  padding: "40px 20px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "40px" }}>✅</span>
                <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#00897B" }}>All cases on track</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
