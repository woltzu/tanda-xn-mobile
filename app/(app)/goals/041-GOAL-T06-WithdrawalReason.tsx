"use client"
import { ArrowLeft, ChevronRight, Check } from "lucide-react"
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

export default function WithdrawalReasonScreen() {
  const [selectedReason, setSelectedReason] = useState(null)

  const goal = {
    id: "g1",
    name: "Emergency Fund",
    emoji: "🛡️",
    currentAmount: 3200,
    tier: "emergency",
  }

  const withdrawalAmount = 1000
  const penaltyAmount = 20
  const receiveAmount = 980

  const reasons = [
    { id: "emergency", icon: "🚨", label: "Emergency" },
    { id: "medical", icon: "🏥", label: "Medical" },
    { id: "family", icon: "👨‍👩‍👧", label: "Family" },
    { id: "job_loss", icon: "💼", label: "Job Change" },
    { id: "opportunity", icon: "💡", label: "Opportunity" },
    { id: "goal_change", icon: "🎯", label: "Plans Changed" },
  ]

  const tiers = {
    flexible: { name: "Flexible", penalty: 0, color: "#10B981" },
    emergency: { name: "Emergency", penalty: 2, color: "#3B82F6" },
    locked: { name: "Locked", penalty: 7, color: "#8B5CF6" },
  }

  const tierInfo = tiers[goal.tier]

  const canContinue = selectedReason !== null

  const steps = [
    { num: 1, label: "Amount", completed: true, active: false },
    { num: 2, label: "Reason", completed: false, active: true },
    { num: 3, label: "Review", completed: false, active: false },
    { num: 4, label: "Done", completed: false, active: false },
  ]

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
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>
                Why are you withdrawing?
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
                      background: step.completed
                        ? colors.accentTeal
                        : step.active
                          ? colors.accentTeal
                          : "rgba(255,255,255,0.2)",
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
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: colors.background,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              {goal.emoji}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "13px", color: colors.textSecondary }}>Withdrawing</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: colors.primaryNavy }}>
                ${withdrawalAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "12px", color: colors.textSecondary }}>You'll get</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: colors.accentTeal }}>
              ${receiveAmount.toLocaleString()}
            </p>
          </div>
        </div>

        <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: colors.primaryNavy }}>
          Select a reason
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
          }}
        >
          {reasons.map((reason) => (
            <button
              key={reason.id}
              onClick={() => setSelectedReason(reason.id)}
              style={{
                padding: "20px 12px",
                borderRadius: "16px",
                border: selectedReason === reason.id ? `2px solid ${colors.accentTeal}` : `1px solid ${colors.borders}`,
                background: selectedReason === reason.id ? colors.accentTeal + "10" : colors.cards,
                cursor: "pointer",
                textAlign: "center",
                position: "relative",
                fontFamily: "inherit",
              }}
            >
              {selectedReason === reason.id && (
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: colors.accentTeal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </div>
              )}
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>{reason.icon}</div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: "600",
                  color: selectedReason === reason.id ? colors.accentTeal : colors.primaryNavy,
                }}
              >
                {reason.label}
              </p>
            </button>
          ))}
        </div>

        {tierInfo.penalty > 0 && (
          <div
            style={{
              background: "#FEF3C7",
              borderRadius: "12px",
              padding: "14px",
              marginTop: "20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>💡</span>
            <p style={{ margin: 0, fontSize: "12px", color: "#92400E", lineHeight: "1.5" }}>
              <strong>${penaltyAmount}</strong> penalty will be applied. Consider if this is truly necessary.
            </p>
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
          onClick={() => console.log("Continue with reason:", selectedReason)}
          disabled={!canContinue}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: "16px",
            border: "none",
            background: canContinue ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)` : colors.borders,
            fontSize: "16px",
            fontWeight: "600",
            color: canContinue ? "#FFFFFF" : colors.textSecondary,
            cursor: canContinue ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: canContinue ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
          }}
        >
          Continue
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
