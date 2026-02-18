"use client"
import { ArrowLeft, ChevronRight } from "lucide-react"
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

export default function WithdrawalAmountScreen() {
  const [amount, setAmount] = useState("")

  const goal = {
    id: "g1",
    name: "Emergency Fund",
    emoji: "🛡️",
    currentAmount: 3200,
    tier: "emergency",
  }

  const tiers = {
    flexible: { name: "Flexible", penalty: 0, color: "#10B981" },
    emergency: { name: "Emergency", penalty: 2, color: "#3B82F6" },
    locked: { name: "Locked", penalty: 7, color: "#8B5CF6" },
  }

  const tierInfo = tiers[goal.tier]
  const withdrawAmount = Number.parseFloat(amount) || 0
  const penaltyAmount = Math.round((withdrawAmount * tierInfo.penalty) / 100)
  const receiveAmount = withdrawAmount - penaltyAmount

  const quickAmounts = [
    { label: "25%", value: Math.round(goal.currentAmount * 0.25) },
    { label: "50%", value: Math.round(goal.currentAmount * 0.5) },
    { label: "All", value: goal.currentAmount },
  ]

  const isValid = withdrawAmount > 0 && withdrawAmount <= goal.currentAmount

  const steps = [
    { num: 1, label: "Amount", active: true },
    { num: 2, label: "Reason", active: false },
    { num: 3, label: "Review", active: false },
    { num: 4, label: "Done", active: false },
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
                Withdraw from {goal.name}
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
            {goal.emoji}
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: colors.textSecondary }}>Available Balance</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: colors.primaryNavy }}>
            ${goal.currentAmount.toLocaleString()}
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: tierInfo.color + "15",
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
                background: tierInfo.color,
              }}
            />
            <span style={{ fontSize: "12px", fontWeight: "600", color: tierInfo.color }}>
              {tierInfo.name} • {tierInfo.penalty}% penalty
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
              max={goal.currentAmount}
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
              background: tierInfo.penalty > 0 ? "#FEF3C7" : "#F0FDF4",
              borderRadius: "16px",
              padding: "16px",
              border: `1px solid ${tierInfo.penalty > 0 ? "#FDE68A" : "#BBF7D0"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "12px", color: tierInfo.penalty > 0 ? "#92400E" : "#166534" }}>
                  You'll receive
                </p>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "28px",
                    fontWeight: "700",
                    color: tierInfo.penalty > 0 ? "#D97706" : "#16A34A",
                  }}
                >
                  ${receiveAmount.toLocaleString()}
                </p>
              </div>
              {tierInfo.penalty > 0 && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "11px", color: "#92400E" }}>Penalty ({tierInfo.penalty}%)</p>
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
          onClick={() =>
            console.log("Continue with", { amount: withdrawAmount, penalty: penaltyAmount, receive: receiveAmount })
          }
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
