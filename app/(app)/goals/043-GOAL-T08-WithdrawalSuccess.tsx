"use client"
import { useWithdrawalWizard } from "@/context/WithdrawalWizardContext"
import { useGoalParams, navigateToGoalScreen } from "./useGoalParams"
import { Check, Copy, Clock, ArrowRight } from "lucide-react"
import { useState } from "react"

// Brand Colors
const colors = {
  primaryNavy: "#0A2342",
  accentTeal: "#00C6AE",
  warningAmber: "#D97706",
  background: "#F5F7FA",
  cards: "#FFFFFF",
  borders: "#E5E7EB",
  textSecondary: "#6B7280",
}

export default function WithdrawalSuccessScreen() {
  const [copied, setCopied] = useState(false)

  const { goalId } = useGoalParams()
  const { state, resetWizard } = useWithdrawalWizard()

  const copyTransactionId = () => {
    if (state.transactionId) {
      navigator.clipboard?.writeText(state.transactionId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDone = () => {
    resetWizard()
    navigateToGoalScreen("030-GOAL-001-GoalsDashboard")
  }

  const handleViewGoal = () => {
    const gId = state.goalId
    resetWizard()
    navigateToGoalScreen("031-GOAL-002-GoalDetail", { goalId: gId! })
  }

  // Progress steps - all completed
  const steps = [
    { num: 1, label: "Amount", completed: true },
    { num: 2, label: "Reason", completed: true },
    { num: 3, label: "Review", completed: true },
    { num: 4, label: "Done", completed: true },
  ]

  // If wizard state is empty (user navigated directly), show error
  if (!state.goalId || state.amount === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p style={{ fontSize: "48px", marginBottom: "12px" }}>😕</p>
          <p style={{ color: colors.primaryNavy, fontSize: "18px", fontWeight: "600", margin: "0 0 8px 0" }}>
            No withdrawal data
          </p>
          <p style={{ color: colors.textSecondary, fontSize: "14px", margin: "0 0 20px 0" }}>
            The withdrawal session has expired.
          </p>
          <button
            onClick={() => navigateToGoalScreen("030-GOAL-001-GoalsDashboard")}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              background: colors.accentTeal,
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "160px",
      }}
    >
      {/* Success Header */}
      <div
        style={{
          background: colors.primaryNavy,
          textAlign: "center",
        }}
      >
        <div style={{ height: "44px" }} />

        {/* Progress Timeline - All Complete */}
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {steps.map((step, idx) => (
              <div
                key={step.num}
                style={{ display: "flex", alignItems: "center", flex: idx < steps.length - 1 ? 1 : "none" }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: colors.accentTeal,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 4px auto",
                    }}
                  >
                    <Check size={16} color="#FFFFFF" />
                  </div>
                  <span style={{ fontSize: "10px", color: "#FFFFFF" }}>{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: "2px",
                      background: colors.accentTeal,
                      margin: "0 8px",
                      marginBottom: "18px",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Success Icon */}
        <div style={{ padding: "20px 20px 40px 20px" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: colors.accentTeal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              boxShadow: "0 8px 32px rgba(0, 198, 174, 0.4)",
            }}
          >
            <Check size={40} color="#FFFFFF" strokeWidth={3} />
          </div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>
            Withdrawal Complete!
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>Your funds are on the way</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px", marginTop: "-20px" }}>
        {/* Amount Card */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "16px",
            textAlign: "center",
            border: `1px solid ${colors.borders}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: colors.textSecondary }}>Amount received</p>
          <p style={{ margin: 0, fontSize: "44px", fontWeight: "700", color: colors.accentTeal }}>
            ${state.receiveAmount.toLocaleString()}
          </p>
          {state.penaltyAmount > 0 && (
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: colors.warningAmber }}>
              ${state.penaltyAmount} penalty applied
            </p>
          )}
        </div>

        {/* Details Card */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            overflow: "hidden",
            marginBottom: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          {/* From */}
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${colors.borders}`,
            }}
          >
            <span style={{ fontSize: "13px", color: colors.textSecondary }}>From</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "18px" }}>{state.goalEmoji}</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: colors.primaryNavy }}>{state.goalName}</span>
            </div>
          </div>

          {/* Withdrawal Amount */}
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${colors.borders}`,
            }}
          >
            <span style={{ fontSize: "13px", color: colors.textSecondary }}>Withdrawn</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: colors.primaryNavy }}>
              ${state.amount.toLocaleString()}
            </span>
          </div>

          {/* Transaction ID */}
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "13px", color: colors.textSecondary }}>Transaction ID</span>
            <button
              onClick={copyTransactionId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: "500", color: colors.primaryNavy }}>
                {state.transactionId ? state.transactionId.slice(0, 16) + "..." : "N/A"}
              </span>
              <Copy size={14} color={copied ? colors.accentTeal : colors.textSecondary} />
            </button>
          </div>
        </div>

        {/* Remaining Balance */}
        <div
          style={{
            background: colors.accentTeal + "10",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: colors.cards,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              {state.goalEmoji}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: colors.textSecondary }}>Remaining in goal</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: colors.primaryNavy }}>
                ${state.remainingBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", fontWeight: "600", color: colors.primaryNavy }}>
            Timeline
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {/* Step 1 - Complete */}
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: colors.accentTeal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={14} color="#FFFFFF" />
                </div>
                <div
                  style={{
                    width: "2px",
                    height: "24px",
                    background: colors.accentTeal,
                  }}
                />
              </div>
              <div style={{ paddingTop: "4px" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: colors.primaryNavy }}>
                  Withdrawal processed
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: colors.textSecondary }}>Just now</p>
              </div>
            </div>

            {/* Step 2 - Pending */}
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: colors.borders,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Clock size={14} color={colors.textSecondary} />
                </div>
              </div>
              <div style={{ paddingTop: "4px" }}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: colors.textSecondary }}>
                  Funds arrive in your account
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>1-2 business days</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: colors.cards,
          padding: "16px 20px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          borderTop: `1px solid ${colors.borders}`,
        }}
      >
        <button
          onClick={handleDone}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: "16px",
            border: "none",
            background: `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)`,
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: "12px",
            boxShadow: "0 8px 24px rgba(0, 198, 174, 0.3)",
          }}
        >
          Done
        </button>

        <button
          onClick={handleViewGoal}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "600",
            color: colors.accentTeal,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          View Goal
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
