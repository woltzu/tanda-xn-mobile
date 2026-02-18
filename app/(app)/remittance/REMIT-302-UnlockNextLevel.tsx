"use client"

import { useState } from "react"

export default function UnlockNextLevelScreen() {
  const [currentTier] = useState({
    id: "verified",
    name: "Verified",
    badge: "✅",
    limit: 2000,
  })

  const [nextTier] = useState({
    id: "trusted",
    name: "Trusted",
    badge: "⭐",
    color: "#F59E0B",
    limit: 10000,
    benefits: [
      "Send up to $10,000/month",
      "Lower fees on large transfers",
      "Priority customer support",
      "Instant transfers to all countries",
    ],
  })

  const [verificationSteps, setVerificationSteps] = useState([
    {
      id: "identity",
      title: "Verify Identity",
      description: "Government ID + Selfie",
      icon: "🪪",
      status: "completed",
      estimatedTime: "2 minutes",
    },
    {
      id: "address",
      title: "Confirm Address",
      description: "Utility bill or bank statement",
      icon: "🏠",
      status: "current",
      estimatedTime: "2 minutes",
    },
    {
      id: "source",
      title: "Source of Funds",
      description: "Quick questionnaire",
      icon: "💼",
      status: "locked",
      estimatedTime: "1 minute",
    },
  ])

  const completedSteps = verificationSteps.filter((s) => s.status === "completed").length
  const totalSteps = verificationSteps.length
  const progressPercentage = (completedSteps / totalSteps) * 100
  const currentStep = verificationSteps.find((s) => s.status === "current")

  const handleBack = () => console.log("Navigate back")
  const handleStartStep = (step: any) => console.log(`Starting step: ${step.id}`)
  const handleSkipForNow = () => console.log("Skip for now")

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
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            onClick={handleBack}
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Unlock {nextTier.name} Level</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {totalSteps - completedSteps} steps to go
            </p>
          </div>
        </div>

        {/* Next Level Preview */}
        <div
          style={{
            background: `linear-gradient(135deg, ${nextTier.color}30, ${nextTier.color}10)`,
            borderRadius: "16px",
            padding: "20px",
            border: `2px solid ${nextTier.color}40`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: nextTier.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                boxShadow: `0 4px 20px ${nextTier.color}60`,
              }}
            >
              {nextTier.badge}
            </div>
            <div>
              <p
                style={{ margin: 0, fontSize: "12px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "1px" }}
              >
                You're unlocking
              </p>
              <h2 style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700" }}>{nextTier.name} Sender</h2>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>Progress</span>
              <span style={{ fontSize: "12px", fontWeight: "600" }}>
                {completedSteps}/{totalSteps} complete
              </span>
            </div>
            <div
              style={{
                height: "8px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercentage}%`,
                  height: "100%",
                  background: "#FFFFFF",
                  borderRadius: "4px",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>

          {/* Estimated Time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: 0.9,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: "12px" }}>
              ~
              {verificationSteps
                .filter((s) => s.status !== "completed")
                .reduce((sum, s) => {
                  const mins = Number.parseInt(s.estimatedTime)
                  return sum + (isNaN(mins) ? 2 : mins)
                }, 0)}{" "}
              minutes to complete
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* What You'll Unlock */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            🎁 What You'll Unlock
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {nextTier.benefits.map((benefit, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  background: "#F0FDFB",
                  borderRadius: "10px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: "13px", color: "#0A2342" }}>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Steps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Verification Steps
          </h3>

          {verificationSteps.map((step, idx) => {
            const isCompleted = step.status === "completed"
            const isCurrent = step.status === "current"
            const isLocked = step.status === "locked"

            return (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px",
                  marginBottom: idx < verificationSteps.length - 1 ? "10px" : 0,
                  background: isCurrent ? "#F0FDFB" : isCompleted ? "#F9FAFB" : "#FAFAFA",
                  borderRadius: "12px",
                  border: isCurrent ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                {/* Step Icon */}
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: isCompleted ? "#00C6AE" : isCurrent ? "#0A2342" : "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isCompleted ? "20px" : "24px",
                  }}
                >
                  {isCompleted ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span>{step.icon}</span>
                  )}
                </div>

                {/* Step Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: "600",
                        color: isCompleted ? "#00897B" : "#0A2342",
                      }}
                    >
                      {step.title}
                    </p>
                    {isCompleted && (
                      <span
                        style={{
                          padding: "2px 6px",
                          background: "#D1FAE5",
                          color: "#059669",
                          fontSize: "9px",
                          fontWeight: "700",
                          borderRadius: "4px",
                        }}
                      >
                        DONE
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{step.description}</p>
                  {!isCompleted && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>⏱️ {step.estimatedTime}</p>
                  )}
                </div>

                {/* Action */}
                {isCurrent && (
                  <button
                    onClick={() => handleStartStep(step)}
                    style={{
                      padding: "10px 16px",
                      background: "#00C6AE",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Start
                  </button>
                )}
                {isLocked && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>

        {/* Security Note */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginTop: "20px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>
            Your data is encrypted and never shared with third parties
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
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
        {currentStep && (
          <button
            onClick={() => handleStartStep(currentStep)}
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
              marginBottom: "10px",
            }}
          >
            Continue: {currentStep.title}
          </button>
        )}
        <button
          onClick={handleSkipForNow}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "500",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          I'll do this later
        </button>
      </div>
    </div>
  )
}
