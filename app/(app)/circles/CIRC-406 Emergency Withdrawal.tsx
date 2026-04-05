"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack } from "./useCircleParams"

import type { Circle, MyContributionStatus } from "../../../context/CirclesContext"

export default function EmergencyWithdrawalScreen() {
  const { circleId } = useCircleParams()
  const { getCircleById, getMyContributionStatus, requestEmergencyWithdrawal } = useCircles()
  const { user } = useAuth()

  const [circle, setCircle] = useState<Circle | undefined>(undefined)
  const [myStatus, setMyStatus] = useState<MyContributionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState("")
  const [hasDocument, setHasDocument] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    if (!circleId) return

    const loadData = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const circleData = getCircleById(circleId)
        setCircle(circleData)

        const status = await getMyContributionStatus(circleId)
        setMyStatus(status)
      } catch (err: any) {
        setLoadError(err.message || "Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [circleId])

  const maxWithdrawable = myStatus?.totalContributed || 0

  const reasons = [
    {
      id: "medical",
      emoji: "🏥",
      title: "Medical Emergency",
      description: "Urgent medical expenses for you or family",
    },
    {
      id: "family",
      emoji: "👨‍👩‍👧",
      title: "Family Emergency",
      description: "Death, illness, or urgent family situation",
    },
    {
      id: "job_loss",
      emoji: "💼",
      title: "Job Loss",
      description: "Lost employment and need funds",
    },
    {
      id: "housing",
      emoji: "🏠",
      title: "Housing Emergency",
      description: "Eviction or urgent housing issue",
    },
    {
      id: "other",
      emoji: "📝",
      title: "Other Emergency",
      description: "Another urgent situation",
    },
  ]

  const requestedAmount = Number.parseFloat(amount) || 0
  const isValidAmount = requestedAmount > 0 && requestedAmount <= maxWithdrawable
  const canSubmit = isValidAmount && reason && details.length >= 20 && agreedToTerms

  const handleSubmit = async () => {
    if (!canSubmit || !circleId || !reason) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await requestEmergencyWithdrawal(circleId, reason, requestedAmount)
      setSubmitSuccess(true)
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit emergency request")
    } finally {
      setIsSubmitting(false)
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
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (loadError) {
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
          <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "12px" }}>{loadError}</p>
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

  if (submitSuccess) {
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
        <div style={{ textAlign: "center", maxWidth: "320px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
            Request Submitted
          </h2>
          <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
            Your emergency withdrawal request for ${requestedAmount.toLocaleString()} has been submitted for review.
          </p>
          <button
            onClick={() => goBack()}
            style={{
              padding: "14px 32px",
              background: "#0A2342",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            Back to Circle
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
        paddingBottom: "160px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Emergency Request</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle?.name || "Circle"}</p>
          </div>
        </div>

        {/* Available Amount */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Maximum you can request</p>
          <p style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "#00C6AE" }}>
            ${maxWithdrawable.toLocaleString()}
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "11px", opacity: 0.7 }}>
            Based on your contributions of ${myStatus?.totalContributed || 0}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
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
              This is for emergencies only
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#B45309", lineHeight: 1.4 }}>
              Emergency withdrawals require Elder approval and may affect your XnScore and payout position.
            </p>
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div
            style={{
              background: "#FEF2F2",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", color: "#DC2626" }}>{submitError}</p>
          </div>
        )}

        {/* Amount Input */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            How much do you need?
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "10px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "600", color: "#0A2342" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              max={maxWithdrawable}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "32px",
                fontWeight: "700",
                color: "#0A2342",
                outline: "none",
                width: "100%",
              }}
            />
          </div>

          {/* Quick Amount Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            {[100, 200, 400, maxWithdrawable].map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: amount === amt.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: amount === amt.toString() ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                {amt === maxWithdrawable ? "Max" : `$${amt}`}
              </button>
            ))}
          </div>

          {requestedAmount > maxWithdrawable && (
            <p style={{ margin: "12px 0 0 0", fontSize: "12px", color: "#DC2626" }}>
              Amount exceeds your available balance
            </p>
          )}
        </div>

        {/* Reason Selection */}
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
            Reason for emergency
          </h3>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {reasons.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                style={{
                  padding: "12px 16px",
                  background: reason === r.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                  border: reason === r.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "18px" }}>{r.emoji}</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{r.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Explain your situation
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            This helps the Elder understand and approve faster
          </p>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe your emergency situation..."
            maxLength={500}
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
          <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#6B7280", textAlign: "right" }}>
            {details.length}/500
          </p>
        </div>

        {/* Supporting Document */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => setHasDocument(!hasDocument)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: 0,
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "6px",
                border: hasDocument ? "none" : "2px solid #D1D5DB",
                background: hasDocument ? "#00C6AE" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {hasDocument && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                I can provide documentation
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                Medical bills, eviction notice, etc. (optional but helps approval)
              </p>
            </div>
          </button>
        </div>

        {/* Review by Elder */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#00C6AE",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            E
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
              Reviewed by: Circle Elder
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
              Usually responds within 24-48 hours
            </p>
          </div>
        </div>

        {/* Terms Agreement */}
        <button
          onClick={() => setAgreedToTerms(!agreedToTerms)}
          style={{
            width: "100%",
            padding: "14px",
            background: agreedToTerms ? "#F0FDFB" : "#FFFFFF",
            borderRadius: "12px",
            border: agreedToTerms ? "2px solid #00C6AE" : "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              border: agreedToTerms ? "none" : "2px solid #D1D5DB",
              background: agreedToTerms ? "#00C6AE" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "1px",
            }}
          >
            {agreedToTerms && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "#374151", lineHeight: 1.5 }}>
            I understand this emergency withdrawal will be reviewed by the Elder, may affect my payout position and
            XnScore, and I will need to continue contributing to the circle.
          </span>
        </button>
      </div>

      {/* Submit Button */}
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
        {isValidAmount && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
            }}
          >
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Request amount</span>
            <span style={{ fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              ${requestedAmount.toLocaleString()}
            </span>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canSubmit && !isSubmitting ? "#D97706" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canSubmit && !isSubmitting ? "#FFFFFF" : "#9CA3AF",
            cursor: canSubmit && !isSubmitting ? "pointer" : "not-allowed",
          }}
        >
          {isSubmitting ? "Submitting..." : "Submit Emergency Request"}
        </button>
      </div>
    </div>
  )
}
