"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack } from "./useCircleParams"

import type { Circle, PayoutScheduleEntry, CircleMember } from "../../../context/CirclesContext"

export default function PayoutDetailsScreen() {
  const { circleId, cycleNumber } = useCircleParams()
  const { getCircleById, getPayoutSchedule, getCircleMembers } = useCircles()
  const { user } = useAuth()

  const [circle, setCircle] = useState<Circle | undefined>(undefined)
  const [payout, setPayout] = useState<PayoutScheduleEntry | null>(null)
  const [members, setMembers] = useState<CircleMember[]>([])
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
        const entry = schedule.find((s) => s.cycleNumber === cycleNumber)
        setPayout(entry || null)

        const membersList = await getCircleMembers(circleId)
        setMembers(membersList)
      } catch (err: any) {
        setError(err.message || "Failed to load payout details")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [circleId, cycleNumber])

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Completed" }
      case "upcoming":
        return { bg: "#FEF3C7", color: "#D97706", label: "Next Payout" }
      case "scheduled":
        return { bg: "#F5F7FA", color: "#6B7280", label: "Scheduled" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
    }
  }

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
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading payout details...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (error || !payout) {
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
          <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "12px" }}>
            {error || "Payout details not found"}
          </p>
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

  const isMyPayout = payout.isCurrentUser
  const statusStyle = getStatusStyle(payout.status)
  const contributionAmount = circle?.amount || 0
  const formattedScheduledDate = payout.scheduledDate
    ? new Date(payout.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "TBD"
  const memberAvatar = payout.recipientName ? payout.recipientName.charAt(0).toUpperCase() : "?"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payout Details</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {circle?.name || "Circle"} • Cycle {payout.cycleNumber}
            </p>
          </div>
          <span
            style={{
              background: statusStyle.bg,
              color: statusStyle.color,
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            {statusStyle.label}
          </span>
        </div>

        {/* Recipient Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: isMyPayout ? "#00C6AE" : "#FFFFFF",
              color: isMyPayout ? "#FFFFFF" : "#0A2342",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontWeight: "700",
              fontSize: "28px",
            }}
          >
            {memberAvatar}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700" }}>
            {payout.recipientName}
            {isMyPayout && <span style={{ color: "#00C6AE" }}> (You)</span>}
          </h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", opacity: 0.8 }}>Payout Recipient</p>
          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Payout Amount</p>
            <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>
              ${payout.amount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-20px", padding: "0 20px" }}>
        {/* Transaction Details */}
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
            {payout.status === "completed" ? "Transaction Details" : "Schedule Details"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {payout.status === "completed" ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Completed</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                    {formattedScheduledDate}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Transaction ID</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#6B7280",
                      fontFamily: "monospace",
                    }}
                  >
                    {payout.id}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Scheduled Date</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{formattedScheduledDate}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Circle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{circle?.name || "Circle"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Cycle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{payout.cycleNumber}</span>
            </div>
          </div>
        </div>

        {/* Contributions Breakdown */}
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
            Contributions ({members.length})
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {members.map((member, idx) => {
              const avatar = member.name ? member.name.charAt(0).toUpperCase() : "?"
              return (
                <div
                  key={member.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px",
                    background: member.isCurrentUser ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: member.isCurrentUser ? "#00C6AE" : "#0A2342",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                      {member.isCurrentUser ? `${member.name} (You)` : member.name}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                      {member.hasPaid ? "Paid" : "Pending"}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: member.hasPaid ? "#00C6AE" : "#6B7280",
                    }}
                  >
                    ${contributionAmount}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total Pot</span>
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
              ${payout.amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Contact Option */}
        {!isMyPayout && (
          <button
            onClick={() => console.log("Contact member")}
            style={{
              width: "100%",
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Message {payout.recipientName.split(" ")[0]}
            </span>
          </button>
        )}

        {/* How Payouts Work */}
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
            Each cycle, all {members.length} members contribute equally. The full pot goes to the scheduled
            recipient. Everyone receives exactly what they contributed over the full cycle.
          </p>
        </div>
      </div>
    </div>
  )
}
