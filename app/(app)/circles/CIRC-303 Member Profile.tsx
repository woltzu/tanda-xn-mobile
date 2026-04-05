"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"

export default function MemberProfile() {
  const { circleId, memberId } = useCircleParams()
  const { getCircleMembers, getCircleById, getUserRole } = useCircles()
  const { user } = useAuth()

  const [member, setMember] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const circle = circleId ? getCircleById(circleId) : undefined

  useEffect(() => {
    if (!circleId || !memberId) return
    setIsLoading(true)

    Promise.all([
      getCircleMembers(circleId),
      getUserRole(circleId),
    ])
      .then(([members, role]) => {
        const found = members.find((m: any) => m.id === memberId)
        setMember(found || null)
        setIsAdmin(role === "creator" || role === "admin")
      })
      .catch((err) => console.error("Failed to load member:", err))
      .finally(() => setIsLoading(false))
  }, [circleId, memberId])

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
    return "Needs Improvement"
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
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading profile...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!member) {
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
          <p style={{ color: "#6B7280", fontSize: "16px" }}>Member not found</p>
          <button onClick={() => goBack()} style={{ marginTop: "12px", padding: "10px 20px", background: "#00C6AE", color: "#FFF", border: "none", borderRadius: "8px", cursor: "pointer" }}>Go Back</button>
        </div>
      </div>
    )
  }

  const avatar = member.name?.charAt(0)?.toUpperCase() || "?"
  const memberSince = member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Unknown"
  const paymentStatus = member.hasPaid ? "Paid" : "Due"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: isAdmin ? "100px" : "40px",
      }}
    >
      {/* Header - CORRECTED: Navy */}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Member Profile</h1>
        </div>

        {/* Profile Card */}
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
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#FFFFFF",
              color: "#0A2342",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontWeight: "700",
              fontSize: "32px",
            }}
          >
            {avatar}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "700" }}>{member.name}</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", opacity: 0.8 }}>Member since {memberSince}</p>

          {/* XnScore Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0,198,174,0.2)",
              padding: "10px 20px",
              borderRadius: "20px",
            }}
          >
            <span style={{ fontSize: "18px" }}>⭐</span>
            <div>
              <span style={{ fontSize: "24px", fontWeight: "700", color: getScoreColor(member.xnScore) }}>
                {member.xnScore}
              </span>
              <span style={{ fontSize: "12px", marginLeft: "6px", opacity: 0.8 }}>{getScoreLabel(member.xnScore)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-20px", padding: "0 20px" }}>
        {/* Circle Context */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>
            IN {(circle?.name || "CIRCLE").toUpperCase()}
          </h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                #{member.position}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Payout Position</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                {member.role}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Role</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: member.hasPaid ? "#F0FDFB" : "#FEF3C7",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: member.hasPaid ? "#00897B" : "#D97706" }}>
                {member.hasPaid ? "✓" : "..."}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{paymentStatus}</p>
            </div>
          </div>
        </div>

        {/* Overall Stats */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Overall Stats</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Role in Circle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{member.role}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>XnScore</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: getScoreColor(member.xnScore) }}>{member.xnScore}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Joined</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{memberSince}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Payment Status</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: member.hasPaid ? "#00C6AE" : "#D97706" }}>
                {paymentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <button
            onClick={() => console.log("Message member:", member.name)}
            style={{
              flex: 1,
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
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Message</span>
          </button>
          <button
            onClick={() =>
              navigateToCircleScreen("CIRC-309 Report Member", {
                circleId: circleId!,
                memberId: member.odictId,
              })
            }
            style={{
              flex: 1,
              padding: "14px",
              background: "#FEF3C7",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>Report</span>
          </button>
        </div>

        {/* Trust Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Verified Member:</strong> This member has completed identity verification and has a positive track
            record in TandaXn circles.
          </p>
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#FFFFFF",
            padding: "16px 20px 32px 20px",
            borderTop: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => console.log("Remove member")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #DC2626",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#DC2626",
              cursor: "pointer",
            }}
          >
            Remove from Circle
          </button>
        </div>
      )}
    </div>
  )
}
