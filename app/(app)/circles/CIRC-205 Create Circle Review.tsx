"use client"

import { useState } from "react"
import { useCreateCircleWizard } from "../../../context/CreateCircleWizardContext"
import { useCircles, CIRCLE_TYPES } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { goBack, navigateToCircleScreen } from "./useCircleParams"

export default function CreateCircleReviewScreen() {
  const wizard = useCreateCircleWizard()
  const { createCircle } = useCircles()
  const { user } = useAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const state = wizard.state

  // Get circle type display info
  const circleTypeInfo = state.type ? (CIRCLE_TYPES as Record<string, any>)[state.type] : null

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "daily": return "Daily"
      case "weekly": return "Weekly"
      case "biweekly": return "Bi-weekly"
      case "monthly": return "Monthly"
      default: return freq
    }
  }

  const getRotationLabel = (method: string) => {
    switch (method) {
      case "xnscore": return "By XnScore"
      case "random": return "Random Draw"
      case "manual": return "Manual Assignment"
      default: return method
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Not set"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  }

  const totalPot = state.amount * state.memberCount

  const handleCreateCircle = async () => {
    setIsCreating(true)
    setCreateError(null)
    try {
      const circle = await createCircle({
        name: state.name,
        type: state.type as any,
        amount: state.amount,
        frequency: state.frequency as any,
        memberCount: state.memberCount,
        startDate: state.startDate,
        rotationMethod: state.rotationMethod,
        gracePeriodDays: state.gracePeriodDays,
        invitedMembers: state.invitedMembers,
        emoji: state.emoji || circleTypeInfo?.emoji || "",
        description: state.description || "",
        createdBy: user?.id || "",
      })
      navigateToCircleScreen("CIRC-206 Create Circle Success", { circleId: circle.id })
    } catch (err: any) {
      setCreateError(err.message || "Failed to create circle. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => goBack()}
            disabled={isCreating}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: isCreating ? "not-allowed" : "pointer",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Review & Create</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Step 4 of 4</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: "#00C6AE",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Circle Type & Name */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontSize: "28px",
            }}
          >
            {circleTypeInfo?.emoji || "\uD83D\uDD04"}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
            {state.name || "Untitled Circle"}
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
            {circleTypeInfo?.name || state.type || "Circle"}
          </p>
        </div>

        {/* Financial Summary */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
            Financial Summary
          </h4>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <div style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.1)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>${state.amount}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>per cycle</p>
            </div>
            <div style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.1)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>{state.memberCount}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>members</p>
            </div>
            <div style={{ flex: 1, padding: "12px", background: "rgba(0,198,174,0.2)", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                ${totalPot.toLocaleString()}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>pot size</p>
            </div>
          </div>
        </div>

        {/* Details Summary */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Circle Details
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Frequency</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {getFrequencyLabel(state.frequency)}
              </span>
            </div>
            <div style={{ height: "1px", background: "#F3F4F6" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Start Date</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {formatDate(state.startDate)}
              </span>
            </div>
            <div style={{ height: "1px", background: "#F3F4F6" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Rotation Method</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {getRotationLabel(state.rotationMethod)}
              </span>
            </div>
            <div style={{ height: "1px", background: "#F3F4F6" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Grace Period</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {state.gracePeriodDays === 0 ? "None" : `${state.gracePeriodDays} day${state.gracePeriodDays > 1 ? "s" : ""}`}
              </span>
            </div>
            <div style={{ height: "1px", background: "#F3F4F6" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Invites Pending</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {state.invitedMembers.length > 0
                  ? `${state.invitedMembers.length} member${state.invitedMembers.length > 1 ? "s" : ""}`
                  : "None yet"}
              </span>
            </div>
          </div>
        </div>

        {/* Invited Members List (if any) */}
        {state.invitedMembers.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Invited Members
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {state.invitedMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#0A2342",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{member.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {createError && (
          <div
            style={{
              background: "#FEF2F2",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "16px",
              border: "1px solid #FCA5A5",
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
              stroke="#DC2626"
              strokeWidth="2"
              style={{ marginTop: "2px", flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", color: "#DC2626", lineHeight: 1.5 }}>{createError}</p>
          </div>
        )}

        {/* Trust Note */}
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
            <strong>Protected by TandaXn:</strong> Your circle will be protected against individual member defaults once active.
          </p>
        </div>
      </div>

      {/* Create Button */}
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
          onClick={handleCreateCircle}
          disabled={isCreating}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isCreating ? "#9CA3AF" : "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: isCreating ? "not-allowed" : "pointer",
          }}
        >
          {isCreating ? "Creating Circle..." : "Create Circle"}
        </button>
      </div>
    </div>
  )
}
