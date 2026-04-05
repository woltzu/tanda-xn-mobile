"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"

import type { Circle, PayoutScheduleEntry } from "../../../context/CirclesContext"

export default function CirclePayoutsScreen() {
  const { circleId } = useCircleParams()
  const { getCircleById, getPayoutSchedule } = useCircles()
  const { user } = useAuth()

  const [circle, setCircle] = useState<Circle | undefined>(undefined)
  const [payouts, setPayouts] = useState<PayoutScheduleEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!circleId) return

    const loadData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const circleData = getCircleById(circleId)
        setCircle(circleData)
        const schedule = await getPayoutSchedule(circleId)
        setPayouts(schedule)
      } catch (err: any) {
        setError(err.message || "Failed to load payout schedule")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [circleId])

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Paid" }
      case "upcoming":
        return { bg: "#FEF3C7", color: "#D97706", label: "Next" }
      case "scheduled":
        return { bg: "#F5F7FA", color: "#6B7280", label: "Scheduled" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
    }
  }

  const completedPayouts = payouts.filter((p) => p.status === "completed").length
  const totalPayouts = payouts.length
  const potAmount = circle ? circle.amount * circle.currentMembers : 0
  const yourPayout = payouts.find((p) => p.isCurrentUser && p.status !== "completed")

  if (isLoading) {
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
              border: "4px solid #E5E7EB",
              borderTopColor: "#00C6AE",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto",
            }}
          />
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading payout schedule...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "12px" }}>{error}</p>
          <button
            onClick={() => goBack()}
            style={{
              padding: "10px 20px",
              background: "#0A2342",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Go Back
          </button>
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
      {/* Header - Navy gradient */}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payout Schedule</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle?.name || "Circle"}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>${potAmount.toLocaleString()}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Per Payout</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
              {completedPayouts}/{totalPayouts || circle?.memberCount || 0}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Completed</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Rotation Schedule Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Rotation Schedule
          </h3>

          {payouts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
                Payout schedule will be generated when the circle starts
              </p>
            </div>
          ) : (
            /* Timeline */
            <div style={{ position: "relative" }}>
              {/* Vertical line */}
              <div
                style={{
                  position: "absolute",
                  left: "20px",
                  top: "20px",
                  bottom: "20px",
                  width: "2px",
                  background: "#E5E7EB",
                }}
              />

              {/* Payout Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {payouts.map((payout) => {
                  const statusStyle = getStatusStyle(payout.status)
                  const isCompleted = payout.status === "completed"
                  const isNext = payout.status === "upcoming"
                  const avatar = payout.recipientName ? payout.recipientName.charAt(0).toUpperCase() : "?"

                  return (
                    <button
                      key={payout.id}
                      onClick={() =>
                        navigateToCircleScreen("CIRC-405 Payout Details", {
                          circleId: circleId!,
                          cycleNumber: payout.cycleNumber,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "14px",
                        paddingLeft: "52px",
                        background: payout.isCurrentUser ? "#F0FDFB" : isNext ? "#FEF3C7" : "#F5F7FA",
                        borderRadius: "12px",
                        border: payout.isCurrentUser ? "2px solid #00C6AE" : isNext ? "2px solid #D97706" : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        position: "relative",
                      }}
                    >
                      {/* Timeline dot */}
                      <div
                        style={{
                          position: "absolute",
                          left: "12px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: isCompleted ? "#00C6AE" : isNext ? "#D97706" : "#E5E7EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 1,
                        }}
                      >
                        {isCompleted && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      {/* Payout content */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Avatar */}
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            background: payout.isCurrentUser ? "#00C6AE" : "#0A2342",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "600",
                            fontSize: "16px",
                          }}
                        >
                          {avatar}
                        </div>

                        {/* Member Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                              {payout.isCurrentUser ? `${payout.recipientName} (You)` : payout.recipientName}
                            </span>
                            {payout.isCurrentUser && (
                              <span
                                style={{
                                  background: "#00C6AE",
                                  color: "#FFFFFF",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "9px",
                                  fontWeight: "700",
                                }}
                              >
                                YOU
                              </span>
                            )}
                          </div>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                            Cycle {payout.cycleNumber} • {payout.scheduledDate ? new Date(payout.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
                          </p>
                        </div>

                        {/* Amount & Status */}
                        <div style={{ textAlign: "right" }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "16px",
                              fontWeight: "700",
                              color: isCompleted ? "#00C6AE" : "#0A2342",
                            }}
                          >
                            ${payout.amount.toLocaleString()}
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
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Your Payout Card */}
        {yourPayout && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
              marginTop: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(0,198,174,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                💰
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                  Your Payout is Coming
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                  Cycle {yourPayout.cycleNumber} • {yourPayout.scheduledDate ? new Date(yourPayout.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                  ${potAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
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
            <strong>How it works:</strong> Each cycle, all members contribute ${circle?.amount || 0}. The full pot of $
            {potAmount.toLocaleString()} goes to one member based on rotation order.
          </p>
        </div>
      </div>
    </div>
  )
}
