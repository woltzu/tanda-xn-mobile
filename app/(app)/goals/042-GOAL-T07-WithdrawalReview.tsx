"use client"
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

  const goal = {
    name: "Emergency Fund",
    emoji: "🛡️",
    tier: "emergency",
    currentAmount: 3200,
  }

  const withdrawalAmount = 1000
  const penaltyAmount = 20
  const receiveAmount = 980
  const reason = "Medical"

  const tiers = {
    flexible: { name: "Flexible", penalty: 0, color: "#10B981", icon: Unlock },
    emergency: { name: "Emergency", penalty: 2, color: "#3B82F6", icon: Shield },
    locked: { name: "Locked", penalty: 7, color: "#8B5CF6", icon: Lock },
  }

  const tierInfo = tiers[goal.tier]
  const TierIcon = tierInfo.icon
  const remainingBalance = goal.currentAmount - withdrawalAmount

  const handleConfirm = async () => {
    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    console.log("Withdrawal confirmed")
  }

  const canConfirm = tierInfo.penalty === 0 || confirmed

  const steps = [
    { num: 1, label: "Amount", completed: true, active: false },
    { num: 2, label: "Reason", completed: true, active: false },
    { num: 3, label: "Review", completed: false, active: true },
    { num: 4, label: "Done", completed: false, active: false },
  ]

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
              onClick={() => console.log("Back")}
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
            ${receiveAmount.toLocaleString()}
          </p>
          {tierInfo.penalty > 0 && (
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: colors.warningAmber }}>
              After ${penaltyAmount} penalty
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
              <span style={{ fontSize: "20px" }}>{goal.emoji}</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: colors.primaryNavy }}>{goal.name}</span>
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
              ${withdrawalAmount.toLocaleString()}
            </span>
          </div>

          {/* Penalty - Only show if applicable */}
          {tierInfo.penalty > 0 && (
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
                <span style={{ fontSize: "14px", color: "#92400E" }}>Penalty ({tierInfo.penalty}%)</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: colors.warningAmber }}>
                -${penaltyAmount.toLocaleString()}
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
            <span style={{ fontSize: "14px", fontWeight: "500", color: colors.primaryNavy }}>{reason}</span>
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
              ${remainingBalance.toLocaleString()}
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
        {tierInfo.penalty > 0 && (
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
              I understand a <strong style={{ color: colors.warningAmber }}>${penaltyAmount} penalty</strong> will be
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
