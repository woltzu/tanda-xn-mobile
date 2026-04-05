"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"
import type { Circle, ContributionRecord } from "../../../context/CirclesContext"

export default function CircleContributionsScreen() {
  const { circleId } = useCircleParams()
  const { getCircleById, getContributions } = useCircles()

  const [circle, setCircle] = useState<Circle | null>(null)
  const [contributions, setContributions] = useState<ContributionRecord[]>([])
  const [selectedCycle, setSelectedCycle] = useState("all")
  const [loading, setLoading] = useState(true)

  // Load circle data
  useEffect(() => {
    if (!circleId) return
    const c = getCircleById(circleId)
    if (c) setCircle(c)
  }, [circleId, getCircleById])

  // Load contributions when circle or selected cycle changes
  useEffect(() => {
    if (!circleId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const cycleFilter = selectedCycle === "all" ? undefined : Number(selectedCycle)
        const contribs = await getContributions(circleId, cycleFilter)
        if (!cancelled) setContributions(contribs)
      } catch (err) {
        console.error("Failed to load contributions:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [circleId, selectedCycle, getContributions])

  // Compute stats from real contributions
  const totalCollected = contributions
    .filter((c) => c.status === "completed")
    .reduce((sum, c) => sum + c.amount, 0)

  const totalContribs = contributions.length
  const onTimeCount = contributions.filter((c) => c.status === "completed" && !c.isLate).length
  const onTimeRate = totalContribs > 0 ? Math.round((onTimeCount / totalContribs) * 100) : 0

  // For "this cycle" stat, sum completed contributions in the current cycle
  const currentCycleNumber = circle?.currentCycle || 1
  const thisCycleAmount = contributions
    .filter((c) => c.cycleNumber === currentCycleNumber && c.status === "completed")
    .reduce((sum, c) => sum + c.amount, 0)

  // Generate cycle filter tabs
  const cycles: (string | number)[] = ["all", ...Array.from({ length: currentCycleNumber }, (_, i) => currentCycleNumber - i)]

  // Map contributions to UI shape
  const filteredContributions = contributions.map((c) => ({
    id: c.id,
    cycle: c.cycleNumber,
    member: c.isCurrentUser ? `${c.userName} (You)` : c.userName,
    avatar: (c.userName || "M").charAt(0).toUpperCase(),
    amount: c.amount,
    date: c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null,
    status: c.status === "completed" && c.isLate ? "late" : c.status === "completed" ? "completed" : c.status === "pending" ? "pending" : c.status,
    isYou: c.isCurrentUser,
  }))

  // Expected amount for the current cycle (circle amount * member count)
  const expectedThisCycle = circle ? circle.amount * (circle.currentMembers || circle.memberCount) : 0

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

  if (loading && !circle) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #E5E7EB",
              borderTop: "3px solid #00C6AE",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto",
            }}
          />
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading contributions...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
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
            onClick={() => goBack()}
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
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle?.name || "Circle"}</p>
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
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>${totalCollected.toLocaleString()}</p>
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
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${thisCycleAmount}</p>
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
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{onTimeRate}%</p>
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
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  border: "3px solid #E5E7EB",
                  borderTop: "3px solid #00C6AE",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 12px auto",
                }}
              />
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>Loading...</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredContributions.length > 0 ? (
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
                          {contribution.date || "Pending"}
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
                ${expectedThisCycle.toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Collected</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                ${thisCycleAmount}
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
                width: `${expectedThisCycle > 0 ? (thisCycleAmount / expectedThisCycle) * 100 : 0}%`,
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
