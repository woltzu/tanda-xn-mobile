"use client"

import { useState, useEffect } from "react"
import { useCreateCircleWizard } from "../../../context/CreateCircleWizardContext"
import { useCircles } from "../../../context/CirclesContext"
import { useCircleParams, navigateToCircleScreen } from "./useCircleParams"

export default function CreateCircleSuccessScreen() {
  const { circleId } = useCircleParams()
  const { getCircleById, generateInviteCode } = useCircles()
  const { resetWizard } = useCreateCircleWizard()

  const [isLoading, setIsLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState("")
  const [copied, setCopied] = useState(false)

  const circle = circleId ? getCircleById(circleId) : undefined

  // Reset wizard state on mount and set loading state
  useEffect(() => {
    resetWizard()
    // Give a moment for circle data to load from context
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [resetWizard])

  // Generate invite code when circle is available
  useEffect(() => {
    if (circle) {
      const code = generateInviteCode(circle)
      setInviteCode(code)
    }
  }, [circle, generateInviteCode])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  }

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = inviteCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Loading state
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
              width: "48px",
              height: "48px",
              border: "4px solid #E5E7EB",
              borderTop: "4px solid #00C6AE",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto",
            }}
          />
          <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>Loading your circle...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // Fallback values if circle hasn't loaded yet
  const circleName = circle?.name || "Your Circle"
  const circleAmount = circle?.amount || 0
  const circleSize = circle?.memberCount || 0
  const circleStartDate = circle?.startDate || ""
  const displayInviteCode = inviteCode || circle?.inviteCode || ""
  const invitesSent = circle?.invitedMembers?.length || 0

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Success Header - Navy gradient */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        {/* Success Animation */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Circle Created!</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>{circleName} is ready to go</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Circle Card */}
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
            {circle?.emoji || "\uD83D\uDD04"}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{circleName}</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>
            {circleStartDate ? `Starting ${formatDate(circleStartDate)}` : "Start date pending"}
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>${circleAmount}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>per cycle</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{circleSize}+</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>members</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F0FDFB",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                ${(circleAmount * circleSize).toLocaleString()}+
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>pot size</p>
            </div>
          </div>

          {/* Invite Code */}
          {displayInviteCode && (
            <div
              style={{
                background: "#0A2342",
                borderRadius: "12px",
                padding: "16px",
                cursor: "pointer",
              }}
              onClick={handleCopyInviteCode}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                Circle Invite Code {copied ? "(Copied!)" : "(Tap to copy)"}
              </p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#FFFFFF", letterSpacing: "2px" }}>
                {displayInviteCode}
              </p>
            </div>
          )}
        </div>

        {/* Invites Sent */}
        {invitesSent > 0 && (
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {invitesSent} invite{invitesSent > 1 ? "s" : ""} sent!
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                They'll receive a notification to join
              </p>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>What's Next?</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#00C6AE" }}>1</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Wait for members to join
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Circle activates when members are ready
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#6B7280" }}>2</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Make your first contribution
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  {circleStartDate ? `Due on ${formatDate(circleStartDate)}` : "Due on start date"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#6B7280" }}>3</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Receive your payout</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Based on rotation order</p>
              </div>
            </div>
          </div>
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
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          onClick={() => {
            if (circleId) {
              navigateToCircleScreen("CIRC-301 Circle Dashboard", { circleId })
            }
          }}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleCopyInviteCode}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Share Invite"}
          </button>
          <button
            onClick={() => navigateToCircleScreen("CIRC-101 Browse Circles")}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
