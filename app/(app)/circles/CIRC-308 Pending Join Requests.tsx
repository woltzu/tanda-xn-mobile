"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"

export default function PendingJoinRequests() {
  const { circleId } = useCircleParams()
  const { getCircleById, getPendingMembers, approveMember, rejectMember } = useCircles()
  const { user } = useAuth()

  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)

  const circle = circleId ? getCircleById(circleId) : undefined

  useEffect(() => {
    if (!circleId) return
    setIsLoading(true)
    getPendingMembers(circleId)
      .then((data) => setRequests(data))
      .catch((err) => console.error("Failed to load pending members:", err))
      .finally(() => setIsLoading(false))
  }, [circleId])

  const getScoreColor = (score: number) => {
    if (score >= 85) return "#00C6AE"
    if (score >= 70) return "#0A2342"
    if (score >= 50) return "#D97706"
    return "#DC2626"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 85) return "Excellent"
    if (score >= 70) return "Good"
    if (score >= 50) return "Fair"
    return "Low"
  }

  const handleApprove = async (request: any) => {
    setProcessingId(request.id)
    setActionType("approve")
    try {
      await approveMember(request.id)
      setRequests((prev) => prev.filter((r) => r.id !== request.id))
    } catch (err) {
      console.error("Failed to approve member:", err)
    } finally {
      setProcessingId(null)
      setActionType(null)
    }
  }

  const handleReject = async (request: any) => {
    setProcessingId(request.id)
    setActionType("reject")
    try {
      await rejectMember(request.id)
      setRequests((prev) => prev.filter((r) => r.id !== request.id))
    } catch (err) {
      console.error("Failed to reject member:", err)
    } finally {
      setProcessingId(null)
      setActionType(null)
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
              border: "3px solid #E5E7EB",
              borderTop: "3px solid #00C6AE",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto",
            }}
          />
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading requests...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
            marginBottom: "20px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Join Requests</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle?.name || "Circle"}</p>
          </div>
          {requests.length > 0 && (
            <span
              style={{
                background: "#DC2626",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: "700",
              }}
            >
              {requests.length} pending
            </span>
          )}
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: "12px",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>{requests.length}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Pending</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>{circle?.currentMembers || 0}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Current</p>
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
              {circle?.memberCount ? circle.memberCount - (circle?.currentMembers || 0) : "∞"}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Spots Left</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {requests.length === 0 ? (
          /* Empty State */
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
              ✓
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              All caught up!
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>No pending join requests at the moment.</p>
          </div>
        ) : (
          /* Requests List */
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {requests.map((request) => {
              const avatar = request.name?.charAt(0)?.toUpperCase() || "?"
              const joinedAgo = request.joinedAt
                ? new Date(request.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Recently"

              return (
                <div
                  key={request.id}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "16px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  {/* User Info */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "50%",
                        background: "#0A2342",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "600",
                        fontSize: "20px",
                      }}
                    >
                      {avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{request.name}</span>
                        <span
                          style={{
                            background: `${getScoreColor(request.xnScore)}15`,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            color: getScoreColor(request.xnScore),
                          }}
                        >
                          ⭐ {request.xnScore}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                        Requested {joinedAgo}
                      </p>
                    </div>
                  </div>

                  {/* Recommendation Badge */}
                  {request.xnScore >= 70 && (
                    <div
                      style={{
                        background: "#F0FDFB",
                        borderRadius: "8px",
                        padding: "10px",
                        marginBottom: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span style={{ fontSize: "12px", color: "#065F46" }}>
                        <strong>{getScoreLabel(request.xnScore)} score</strong> — Recommended to approve
                      </span>
                    </div>
                  )}

                  {request.xnScore < 70 && request.xnScore >= 50 && (
                    <div
                      style={{
                        background: "#FEF3C7",
                        borderRadius: "8px",
                        padding: "10px",
                        marginBottom: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                      <span style={{ fontSize: "12px", color: "#92400E" }}>
                        <strong>{getScoreLabel(request.xnScore)} score</strong> — Review carefully before approving
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleReject(request)}
                      disabled={processingId === request.id}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #E5E7EB",
                        background: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#6B7280",
                        cursor: processingId === request.id ? "not-allowed" : "pointer",
                        opacity: processingId === request.id && actionType === "reject" ? 0.6 : 1,
                      }}
                    >
                      {processingId === request.id && actionType === "reject" ? "..." : "Decline"}
                    </button>
                    <button
                      onClick={() => handleApprove(request)}
                      disabled={processingId === request.id}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "10px",
                        border: "none",
                        background: processingId === request.id ? "#E5E7EB" : "#00C6AE",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        cursor: processingId === request.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {processingId === request.id && actionType === "approve" ? "..." : "Approve"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

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
            <strong>Tip:</strong> Look for members with high XnScores and good on-time payment rates. Mutual connections
            indicate they know someone in your circle.
          </p>
        </div>
      </div>
    </div>
  )
}
