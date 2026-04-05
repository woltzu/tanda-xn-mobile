"use client"
import { useSavings } from "@/context/SavingsContext"
import { useWithdrawalWizard } from "@/context/WithdrawalWizardContext"
import { useGoalParams, navigateToGoalScreen, goBack } from "./useGoalParams"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"

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

export default function WithdrawalAmountScreen() {
  const [amount, setAmount] = useState("")
  const [isInitialized, setIsInitialized] = useState(false)

  const { goalId } = useGoalParams()
  const { getGoalById, isLoading: savingsLoading } = useSavings()
  const { state, updateFields, initFromGoal } = useWithdrawalWizard()

  // Load goal from context and initialize wizard
  useEffect(() => {
    if (!goalId || isInitialized) return
    const goal = getGoalById(goalId)
    if (goal) {
      initFromGoal({
        id: goal.id,
        name: goal.name,
        emoji: goal.emoji,
        type: goal.type,
        currentBalance: goal.currentBalance,
        earlyWithdrawalPenalty: goal.earlyWithdrawalPenalty,
      })
      setIsInitialized(true)
    }
  }, [goalId, getGoalById, initFromGoal, isInitialized])

  const withdrawAmount = Number.parseFloat(amount) || 0
  const penaltyAmount = Math.round((withdrawAmount * state.penaltyPercent) / 100)
  const receiveAmount = withdrawAmount - penaltyAmount

  const quickAmounts = [
    { label: "25%", value: Math.round(state.currentBalance * 0.25) },
    { label: "50%", value: Math.round(state.currentBalance * 0.5) },
    { label: "All", value: state.currentBalance },
  ]

  const isValid = withdrawAmount > 0 && withdrawAmount <= state.currentBalance

  const handleContinue = () => {
    updateFields({
      amount: withdrawAmount,
      penaltyAmount,
      receiveAmount,
      remainingBalance: state.currentBalance - withdrawAmount,
    })
    navigateToGoalScreen("041-GOAL-T06-WithdrawalReason", { goalId: state.goalId! })
  }

  const steps = [
    { num: 1, label: "Amount", active: true },
    { num: 2, label: "Reason", active: false },
    { num: 3, label: "Review", active: false },
    { num: 4, label: "Done", active: false },
  ]

  // Loading state
  if (savingsLoading || (!isInitialized && goalId)) {
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
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: `3px solid ${colors.borders}`,
              borderTopColor: colors.accentTeal,
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 12px auto",
            }}
          />
          <p style={{ color: colors.textSecondary, fontSize: "14px" }}>Loading goal...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // Error state - goal not found
  if (!goalId || (!savingsLoading && isInitialized && !state.goalId)) {
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
            Goal not found
          </p>
          <p style={{ color: colors.textSecondary, fontSize: "14px", margin: "0 0 20px 0" }}>
            The savings goal could not be loaded.
          </p>
          <button
            onClick={() => goBack()}
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
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Derive tier display info from penalty percent
  const tierDisplay = state.penaltyPercent >= 5
    ? { name: "Locked", color: "#8B5CF6" }
    : state.penaltyPercent > 0
      ? { name: "Emergency", color: "#3B82F6" }
      : { name: "Flexible", color: "#10B981" }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "160px",
      }}
    >
      {/* Header */}
      <div style={{ background: colors.primaryNavy }}>
        <div style={{ height: "44px" }} />

        <div style={{ padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
              <ArrowLeft size={20} color="#FFFFFF" />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>
                Withdraw from {state.goalName}
              </h1>
            </div>
          </div>
        </div>

        {/* Progress Timeline */}
        <div style={{ padding: "16px 20px 24px 20px" }}>
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
                      background: step.active ? colors.accentTeal : "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: step.active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                      margin: "0 auto 4px auto",
                    }}
                  >
                    {step.num}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: step.active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                      fontWeight: step.active ? "600" : "400",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: "2px",
                      background: "rgba(255,255,255,0.2)",
                      margin: "0 8px",
                      marginBottom: "18px",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Available Balance Card */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "16px",
            textAlign: "center",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: colors.background,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              margin: "0 auto 12px auto",
            }}
          >
            {state.goalEmoji}
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: colors.textSecondary }}>Available Balance</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: colors.primaryNavy }}>
            ${state.currentBalance.toLocaleString()}
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: tierDisplay.color + "15",
              padding: "6px 12px",
              borderRadius: "20px",
              marginTop: "12px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: tierDisplay.color,
              }}
            />
            <span style={{ fontSize: "12px", fontWeight: "600", color: tierDisplay.color }}>
              {tierDisplay.name} • {state.penaltyPercent}% penalty
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "20px",
            padding: "20px",
            marginBottom: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: colors.primaryNavy }}>
            How much?
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: colors.background,
              borderRadius: "16px",
              padding: "4px 20px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "32px", fontWeight: "300", color: colors.textSecondary }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              max={state.currentBalance}
              style={{
                flex: 1,
                padding: "16px 0 16px 8px",
                border: "none",
                fontSize: "40px",
                fontWeight: "700",
                color: colors.primaryNavy,
                outline: "none",
                background: "transparent",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Quick Amount Buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            {quickAmounts.map((qa) => (
              <button
                key={qa.label}
                onClick={() => setAmount(qa.value.toString())}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  borderRadius: "12px",
                  border:
                    Number.parseFloat(amount) === qa.value
                      ? `2px solid ${colors.accentTeal}`
                      : `1px solid ${colors.borders}`,
                  background: Number.parseFloat(amount) === qa.value ? colors.accentTeal + "10" : colors.cards,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: "700",
                    color: Number.parseFloat(amount) === qa.value ? colors.accentTeal : colors.primaryNavy,
                  }}
                >
                  {qa.label}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: colors.textSecondary }}>
                  ${qa.value.toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* You'll Receive Card - Only show when amount entered */}
        {withdrawAmount > 0 && (
          <div
            style={{
              background: state.penaltyPercent > 0 ? "#FEF3C7" : "#F0FDF4",
              borderRadius: "16px",
              padding: "16px",
              border: `1px solid ${state.penaltyPercent > 0 ? "#FDE68A" : "#BBF7D0"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "12px", color: state.penaltyPercent > 0 ? "#92400E" : "#166534" }}>
                  You'll receive
                </p>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "28px",
                    fontWeight: "700",
                    color: state.penaltyPercent > 0 ? "#D97706" : "#16A34A",
                  }}
                >
                  ${receiveAmount.toLocaleString()}
                </p>
              </div>
              {state.penaltyPercent > 0 && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "11px", color: "#92400E" }}>Penalty ({state.penaltyPercent}%)</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "600", color: "#D97706" }}>
                    -${penaltyAmount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
          onClick={handleContinue}
          disabled={!isValid}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: "16px",
            border: "none",
            background: isValid ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)` : colors.borders,
            fontSize: "16px",
            fontWeight: "600",
            color: isValid ? "#FFFFFF" : colors.textSecondary,
            cursor: isValid ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: isValid ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
          }}
        >
          Continue
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
