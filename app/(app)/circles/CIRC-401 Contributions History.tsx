"use client"

import { useState } from "react"

export default function CircleContributionsScreen() {
  const circle = { name: "Family Savings", amount: 200, currentCycle: 3 }
  const contributions = [
    {
      id: 1,
      cycle: 3,
      member: "Franck (You)",
      avatar: "F",
      amount: 200,
      date: "Jan 5, 2025",
      status: "completed",
      isYou: true,
    },
    { id: 2, cycle: 3, member: "Amara O.", avatar: "A", amount: 200, date: "Jan 4, 2025", status: "completed" },
    { id: 3, cycle: 3, member: "Marie C.", avatar: "M", amount: 200, date: "Jan 3, 2025", status: "completed" },
    { id: 4, cycle: 3, member: "David N.", avatar: "D", amount: 200, date: null, status: "pending" },
    { id: 5, cycle: 3, member: "Kwame M.", avatar: "K", amount: 200, date: null, status: "pending" },
    { id: 6, cycle: 3, member: "Samuel O.", avatar: "S", amount: 200, date: "Jan 8, 2025", status: "late" },
  ]
  const stats = { totalCollected: 3600, thisMonth: 600, onTimeRate: 85 }

  const [selectedCycle, setSelectedCycle] = useState("all")
  const cycles = ["all", ...Array.from({ length: circle.currentCycle }, (_, i) => circle.currentCycle - i)]
  const filteredContributions =
    selectedCycle === "all" ? contributions : contributions.filter((c) => c.cycle === Number.parseInt(selectedCycle))

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Paid" }
      case "pending":
        return { bg: "#FEF3C7", color: "#D97706", label: "Due" }
      case "late":
        return { bg: "#FEE2E2", color: "#DC2626", label: "Late" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
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
      {/* Header - Navy Gradient */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Contributions</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle.name}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>${stats.totalCollected.toLocaleString()}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>Total Collected</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${stats.thisMonth}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>This Cycle</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{stats.onTimeRate}%</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", opacity: 0.7 }}>On-Time Rate</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Cycle Filter Tabs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "16px",
            display: "flex",
            gap: "4px",
            border: "1px solid #E5E7EB",
            overflowX: "auto",
          }}
        >
          {cycles.map((cycle) => (
            <button
              key={cycle}
              onClick={() => setSelectedCycle(cycle.toString())}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "none",
                background: selectedCycle === cycle.toString() ? "#0A2342" : "transparent",
                color: selectedCycle === cycle.toString() ? "#FFFFFF" : "#6B7280",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {cycle === "all" ? "All" : `Cycle ${cycle}`}
            </button>
          ))}
        </div>

        {/* Contributions List */}
        <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "12px", border: "1px solid #E5E7EB" }}>
          {filteredContributions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredContributions.map((contribution) => {
                const statusStyle = getStatusStyle(contribution.status)
                return (
                  <div
                    key={contribution.id}
                    style={{
                      padding: "14px",
                      background: contribution.isYou ? "#F0FDFB" : "#F5F7FA",
                      borderRadius: "12px",
                      border: contribution.isYou ? "1px solid #00C6AE" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: contribution.isYou ? "#00C6AE" : "#0A2342",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "600",
                          fontSize: "14px",
                        }}
                      >
                        {contribution.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                          {contribution.member}
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                          {contribution.date || "Due Jan 10, 2025"}
                          {selectedCycle === "all" && (
                            <span style={{ color: "#9CA3AF" }}> • Cycle {contribution.cycle}</span>
                          )}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "16px",
                            fontWeight: "700",
                            color: contribution.status === "completed" ? "#00C6AE" : "#0A2342",
                          }}
                        >
                          ${contribution.amount}
                        </p>
                        <span
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "600",
                          }}
                        >
                          {statusStyle.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No contributions for this cycle yet</p>
            </div>
          )}
        </div>

        {/* Expected vs Collected Summary */}
        <div style={{ background: "#0A2342", borderRadius: "14px", padding: "16px", marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Expected this cycle</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>
                ${(circle.amount * 6).toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Collected</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                ${stats.thisMonth}
              </p>
            </div>
          </div>
          <div
            style={{
              marginTop: "12px",
              height: "6px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(stats.thisMonth / (circle.amount * 6)) * 100}%`,
                height: "100%",
                background: "#00C6AE",
                borderRadius: "3px",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
