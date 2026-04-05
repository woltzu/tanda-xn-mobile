"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"

export default function LeaveCircle() {
  const { circleId } = useCircleParams()
  const { getCircleById, leaveCircle } = useCircles()
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isLeaving, setIsLeaving] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [understood, setUnderstood] = useState(false)

  const circle = circleId ? getCircleById(circleId) : undefined

  useEffect(() => {
    // Circle data comes from context synchronously via getCircleById
    setIsLoading(false)
  }, [circleId])

  const fullName = user?.name || "User"
  const isNameMatch = confirmName.trim().toLowerCase() === fullName.toLowerCase()
  const canConfirm = understood && isNameMatch

  const handleLeave = async () => {
    if (!circleId || !canConfirm) return
    setIsLeaving(true)
    try {
      await leaveCircle(circleId)
      navigateToCircleScreen("CIRC-101 Browse Circles")
    } catch (err: any) {
      console.error("Failed to leave circle:", err)
      setIsLeaving(false)
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
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const circleName = circle?.name || "Circle"
  const amount = circle?.amount || 0
  const currentCycle = circle?.currentCycle || 1
  const totalCycles = circle?.totalCycles || circle?.memberCount || 6

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Header */}
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
          }}
        >
          <button
            onClick={() => goBack()}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Leave Circle</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Warning Banner */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#D97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#92400E" }}>
              Are you sure you want to leave?
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#B45309", lineHeight: 1.4 }}>
              This action cannot be undone. Please read the terms below carefully.
            </p>
          </div>
        </div>

        {/* Circle Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{circleName}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px",
                background: "#F5F7FA",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Contribution Amount</span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#00C6AE" }}>${amount}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px",
                background: "#F5F7FA",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Current Cycle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {currentCycle} of {totalCycles}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px",
                background: "#F5F7FA",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Start Date</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {circle?.startDate ? new Date(circle.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
              </span>
            </div>
          </div>
        </div>

        {/* Refund Terms */}
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
            What Happens When You Leave
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  You will receive your contributions back
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Your contributions will be refunded to your TandaXn wallet
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Refund is processed when the circle ends
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Expected when the circle completes all cycles
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  You will lose your payout position
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  You will not receive a payout from this circle
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Your XnScore may be affected
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Leaving circles early may impact your trust score
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <button
          onClick={() => setUnderstood(!understood)}
          style={{
            width: "100%",
            padding: "14px",
            background: understood ? "#F0FDFB" : "#FFFFFF",
            borderRadius: "12px",
            border: understood ? "2px solid #00C6AE" : "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              border: understood ? "none" : "2px solid #D1D5DB",
              background: understood ? "#00C6AE" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {understood && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: "13px", color: "#0A2342", textAlign: "left", lineHeight: 1.4 }}>
            I understand that I will receive my refund when the circle ends, and I will not receive a payout from this circle.
          </span>
        </button>

        {/* Digital Signature */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Digital Signature
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Type your full name to confirm: <strong>{fullName}</strong>
          </p>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Type your full name here"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: isNameMatch ? "2px solid #00C6AE" : "1px solid #E5E7EB",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box",
              background: isNameMatch ? "#F0FDFB" : "#FFFFFF",
            }}
          />
          {confirmName && !isNameMatch && (
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#DC2626" }}>
              Name doesn&apos;t match. Please type exactly: {fullName}
            </p>
          )}
          {isNameMatch && (
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: "12px",
                color: "#00897B",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Signature confirmed
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={() => goBack()}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "16px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleLeave}
          disabled={!canConfirm || isLeaving}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canConfirm && !isLeaving ? "#DC2626" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canConfirm && !isLeaving ? "#FFFFFF" : "#9CA3AF",
            cursor: canConfirm && !isLeaving ? "pointer" : "not-allowed",
          }}
        >
          {isLeaving ? "Leaving..." : "Leave Circle"}
        </button>
      </div>
    </div>
  )
}
