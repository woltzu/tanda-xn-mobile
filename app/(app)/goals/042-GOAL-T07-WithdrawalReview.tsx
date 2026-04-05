"use client"
import { useSavings } from "@/context/SavingsContext"
import { useWithdrawalWizard } from "@/context/WithdrawalWizardContext"
import { useGoalParams, navigateToGoalScreen, goBack } from "./useGoalParams"
import { ArrowLeft, Check, AlertTriangle, Shield, Lock, Unlock } from "lucide-react"
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

export default function WithdrawalReviewScreen() {
  const [confirmed, setConfirmed] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { goalId } = useGoalParams()
  const { state, updateFields } = useWithdrawalWizard()
  const { withdraw } = useSavings()

  // Derive tier display info from penalty percent
  const tierDisplay = state.penaltyPercent >= 5
    ? { name: "Locked", penalty: state.penaltyPercent, color: "#8B5CF6", icon: Lock }
    : state.penaltyPercent > 0
      ? { name: "Emergency", penalty: state.penaltyPercent, color: "#3B82F6", icon: Shield }
      : { name: "Flexible", penalty: 0, color: "#10B981", icon: Unlock }

  const TierIcon = tierDisplay.icon

  const handleConfirm = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      const tx = await withdraw(state.goalId!, state.amount, `Withdrawal: ${state.reason}`)
      updateFields({ transactionId: tx.id })
      navigateToGoalScreen("043-GOAL-T08-WithdrawalSuccess", { goalId: state.goalId! })
    } catch (err: any) {
      setError(err.message || "Withdrawal failed. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const canConfirm = tierDisplay.penalty === 0 || confirmed

  const steps = [
    { num: 1, label: "Amount", completed: true, active: false },
    { num: 2, label: "Reason", completed: true, active: false },
    { num: 3, label: "Review", completed: false, active: true },
    { num: 4, label: "Done", completed: false, active: false },
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
            No withdrawal in progress
          </p>
          <p style={{ color: colors.textSecondary, fontSize: "14px", margin: "0 0 20px 0" }}>
            Please start from the withdrawal amount screen.
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
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
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>Review Withdrawal</h1>
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
                      background: step.completed || step.active ? colors.accentTeal : "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: step.completed || step.active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                      margin: "0 auto 4px auto",
                    }}
                  >
                    {step.completed ? <Check size={16} /> : step.num}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color: step.completed || step.active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
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
                      background: step.completed ? colors.accentTeal : "rgba(255,255,255,0.2)",
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
        {/* Error Banner */}
        {error && (
          <div
            style={{
              background: "#FEF2F2",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              border: "1px solid #FECACA",
            }}
          >
            <AlertTriangle size={20} color="#DC2626" />
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#DC2626" }}>
                Withdrawal Failed
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#991B1B" }}>{error}</p>
            </div>
          </div>
        )}

        {/* Main Amount Card */}
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
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: colors.textSecondary }}>You'll receive</p>
          <p style={{ margin: 0, fontSize: "48px", fontWeight: "700", color: colors.accentTeal }}>
            ${state.receiveAmount.toLocaleString()}
          </p>
          {tierDisplay.penalty > 0 && (
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: colors.warningAmber }}>
              After ${state.penaltyAmount} penalty
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
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${colors.borders}`,
            }}
          >
            <span style={{ fontSize: "14px", color: colors.textSecondary }}>From</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>{state.goalEmoji}</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: colors.primaryNavy }}>{state.goalName}</span>
            </div>
          </div>

          {/* Withdrawal Amount */}
          <div
            style={{
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${colors.borders}`,
            }}
          >
            <span style={{ fontSize: "14px", color: colors.textSecondary }}>Withdrawal</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: colors.primaryNavy }}>
              ${state.amount.toLocaleString()}
            </span>
          </div>

          {/* Penalty - Only show if applicable */}
          {tierDisplay.penalty > 0 && (
            <div
              style={{
                padding: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `1px solid ${colors.borders}`,
                background: "#FEF3C7",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={16} color={colors.warningAmber} />
                <span style={{ fontSize: "14px", color: "#92400E" }}>Penalty ({tierDisplay.penalty}%)</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: colors.warningAmber }}>
                -${state.penaltyAmount.toLocaleString()}
              </span>
            </div>
          )}

          {/* Reason */}
          <div
            style={{
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${colors.borders}`,
            }}
          >
            <span style={{ fontSize: "14px", color: colors.textSecondary }}>Reason</span>
            <span style={{ fontSize: "14px", fontWeight: "500", color: colors.primaryNavy }}>{state.reason}</span>
          </div>

          {/* Remaining Balance */}
          <div
            style={{
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "14px", color: colors.textSecondary }}>Remaining balance</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: colors.primaryNavy }}>
              ${state.remainingBalance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Timeline Card */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: colors.primaryNavy }}>
            What happens next
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: colors.accentTeal,
              }}
            />
            <p style={{ margin: 0, fontSize: "13px", color: colors.textSecondary }}>
              Funds arrive in <strong style={{ color: colors.primaryNavy }}>1-2 business days</strong>
            </p>
          </div>
        </div>

        {/* Confirmation Checkbox - Only for penalty tiers */}
        {tierDisplay.penalty > 0 && (
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              marginTop: "20px",
              cursor: "pointer",
              padding: "16px",
              background: colors.cards,
              borderRadius: "12px",
              border: `1px solid ${colors.borders}`,
            }}
          >
            <div
              onClick={() => setConfirmed(!confirmed)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "8px",
                border: confirmed ? "none" : `2px solid ${colors.borders}`,
                background: confirmed ? colors.accentTeal : colors.cards,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              {confirmed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: "13px", color: colors.textSecondary, lineHeight: "1.5" }}>
              I understand a <strong style={{ color: colors.warningAmber }}>${state.penaltyAmount} penalty</strong> will be
              deducted from my withdrawal
            </span>
          </label>
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
          onClick={handleConfirm}
          disabled={!canConfirm || isProcessing}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: "16px",
            border: "none",
            background:
              canConfirm && !isProcessing
                ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)`
                : colors.borders,
            fontSize: "16px",
            fontWeight: "600",
            color: canConfirm && !isProcessing ? "#FFFFFF" : colors.textSecondary,
            cursor: canConfirm && !isProcessing ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            boxShadow: canConfirm && !isProcessing ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
          }}
        >
          {isProcessing ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Processing...
            </span>
          ) : (
            `Confirm Withdrawal`
          )}
        </button>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
