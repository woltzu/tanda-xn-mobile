"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"
import type { Circle, MyContributionStatus } from "../../../context/CirclesContext"

export default function MakeContributionScreen() {
  const { circleId } = useCircleParams()
  const { getCircleById, getMyContributionStatus, makeContribution } = useCircles()

  const [circle, setCircle] = useState<Circle | null>(null)
  const [status, setStatus] = useState<MyContributionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [walletBalance] = useState(450)

  const paymentMethods = [
    { id: "wallet", name: "TandaXn Wallet", balance: walletBalance, icon: "\uD83D\uDCB3", default: true },
    { id: "bank", name: "Bank Account \u2022\u2022\u2022\u2022 4532", icon: "\uD83C\uDFE6" },
    { id: "card", name: "Visa \u2022\u2022\u2022\u2022 8821", icon: "\uD83D\uDCB3" },
  ]

  const [selectedMethod, setSelectedMethod] = useState("wallet")

  // Load circle and contribution status
  useEffect(() => {
    if (!circleId) return
    let cancelled = false

    const c = getCircleById(circleId)
    if (c) setCircle(c)

    const loadStatus = async () => {
      try {
        const s = await getMyContributionStatus(circleId)
        if (!cancelled) setStatus(s)
      } catch (err) {
        console.error("Failed to load contribution status:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadStatus()
    return () => { cancelled = true }
  }, [circleId, getCircleById, getMyContributionStatus])

  const hasEnoughBalance = selectedMethod === "wallet" ? walletBalance >= (circle?.amount || 0) : true

  const handlePay = async () => {
    if (!circleId || !circle) return
    setPaymentError(null)
    setIsProcessing(true)
    try {
      await makeContribution(circleId, circle.amount)
      navigateToCircleScreen("CIRC-403 Contribution Success", { circleId })
    } catch (err: any) {
      setPaymentError(err.message || "Payment failed. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
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
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // Already paid this cycle
  if (status?.currentCyclePaid) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          paddingBottom: "120px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Make Contribution</h1>
          </div>
        </div>

        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
            Already Paid This Cycle
          </h2>
          <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
            You have already made your contribution for Cycle {circle?.currentCycle || 1} of {circle?.name || "this circle"}.
          </p>
          <button
            onClick={() => goBack()}
            style={{
              padding: "14px 32px",
              borderRadius: "12px",
              border: "none",
              background: "#00C6AE",
              fontSize: "15px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Back to Circle
          </button>
        </div>
      </div>
    )
  }

  const dueDate = status?.nextDueDate
    ? new Date(status.nextDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "TBD"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Make Contribution</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Circle Info */}
        <div
          style={{
            background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontSize: "28px",
            }}
          >
            {circle?.emoji || "\uD83D\uDD04"}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700" }}>{circle?.name || "Circle"}</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", opacity: 0.8 }}>
            Cycle {circle?.currentCycle || 1} • Due {dueDate}
          </p>

          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Contribution Amount</p>
            <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>${circle?.amount || 0}</p>
          </div>
        </div>

        {/* Payment Error */}
        {paymentError && (
          <div
            style={{
              padding: "14px",
              background: "#FEE2E2",
              borderRadius: "12px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", color: "#DC2626", flex: 1 }}>{paymentError}</p>
            <button
              onClick={() => setPaymentError(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: "16px" }}
            >
              x
            </button>
          </div>
        )}

        {/* Payment Method */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Pay From</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "24px" }}>{method.icon}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{method.name}</p>
                  {method.balance !== undefined && (
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      Balance: ${method.balance.toLocaleString()}
                    </p>
                  )}
                </div>
                {selectedMethod === method.id && (
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Low Balance Warning */}
          {selectedMethod === "wallet" && !hasEnoughBalance && (
            <div
              style={{
                marginTop: "12px",
                padding: "14px",
                background: "#FEF3C7",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>Insufficient balance</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#B45309" }}>
                  You need ${((circle?.amount || 0) - walletBalance).toFixed(2)} more
                </p>
              </div>
              <button
                onClick={() => console.log("Add Funds")}
                style={{
                  background: "#D97706",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Add Funds
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Summary</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Contribution</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>${(circle?.amount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Processing Fee</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>$0.00</span>
            </div>
            <div
              style={{
                borderTop: "1px solid #E5E7EB",
                paddingTop: "10px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>${(circle?.amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <p
          style={{
            margin: "16px 0 0 0",
            fontSize: "11px",
            color: "#9CA3AF",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          By contributing, you agree to the circle's terms. Contributions are non-refundable once the cycle begins.
        </p>
      </div>

      {/* Confirm Button */}
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
          onClick={handlePay}
          disabled={!hasEnoughBalance || isProcessing}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: hasEnoughBalance && !isProcessing ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: hasEnoughBalance && !isProcessing ? "#FFFFFF" : "#9CA3AF",
            cursor: hasEnoughBalance && !isProcessing ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isProcessing ? (
            <>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid #FFFFFF",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Processing...
            </>
          ) : (
            `Pay $${circle?.amount || 0}`
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
