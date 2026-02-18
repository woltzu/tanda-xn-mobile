"use client"

import { useState } from "react"
import { ArrowLeft, DollarSign, Calendar, ChevronRight, CheckCircle, Info, Wallet, Target, Building2, Smartphone, CreditCard, Plus, Minus } from "lucide-react"

// Brand Colors
const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  offWhite: "#F5F7FA",
  white: "#FFFFFF",
  gray: "#6B7280",
  lightGray: "#E0E0E0",
  success: "#00C6AE",
  warning: "#F59E0B",
  error: "#EF4444",
}

export default function AddNewGoalScreen() {
  const [step, setStep] = useState(1)
  const [goal, setGoal] = useState({
    type: null as string | null,
    name: "",
    targetAmount: "",
    deadline: "",
    payoutAllocation: 0, // Percentage of payout to allocate to this goal (0-100)
    monthlyContribution: "",
  })

  const totalSteps = 4

  const suggestedGoals = [
    { id: "emergency", name: "Emergency Fund", icon: "🛡️", suggested: 5000, description: "3-6 months of expenses" },
    { id: "family", name: "Family Support Back Home", icon: "🏠", suggested: 2000, description: "Support loved ones" },
    { id: "travel", name: "Travel Home", icon: "✈️", suggested: 2500, description: "Visit family & friends" },
    { id: "education", name: "Education", icon: "🎓", suggested: 10000, description: "Invest in your future" },
    { id: "business", name: "Business", icon: "💼", suggested: 10000, description: "Start or grow a business" },
    { id: "wedding", name: "Wedding/Celebration", icon: "💍", suggested: 15000, description: "Life milestones" },
    { id: "car", name: "Vehicle", icon: "🚗", suggested: 8000, description: "Transportation needs" },
    { id: "custom", name: "Custom Goal", icon: "🎯", suggested: 0, description: "Define your own" },
  ]

  // Mock data for existing allocations (from other goals)
  const existingAllocations = 35 // 35% already allocated to other goals
  const availableAllocation = 100 - existingAllocations

  // Preset allocation options
  const allocationPresets = [10, 25, 50, 75, 100]

  const handleGoalTypeSelect = (goalType: (typeof suggestedGoals)[0]) => {
    setGoal({
      ...goal,
      type: goalType.id,
      name: goalType.id === "custom" ? "" : goalType.name,
      targetAmount: goalType.suggested > 0 ? goalType.suggested.toString() : "",
    })
  }

  const calculateMonthly = () => {
    if (!goal.targetAmount || !goal.deadline) return null
    const target = Number.parseFloat(goal.targetAmount)
    const deadlineDate = new Date(goal.deadline)
    const now = new Date()
    const months = Math.max(1, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    return Math.ceil(target / months)
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return goal.type !== null
      case 2:
        return Number.parseFloat(goal.targetAmount) > 0 && goal.name.trim().length > 0
      case 3:
        return goal.deadline.length > 0
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    } else {
      console.log("Goal created:", goal)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.offWhite,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header - Navy Gradient */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.navy} 0%, #143654 100%)`,
          padding: "20px",
          color: COLORS.white,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : console.log("Back"))}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <ArrowLeft size={24} color={COLORS.white} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: COLORS.white }}>Create New Goal</h1>
          </div>
          <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
            {step} of {totalSteps}
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: s <= step ? COLORS.teal : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 20px", paddingBottom: "140px" }}>
        {/* STEP 1: Goal Type Selection */}
        {step === 1 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: COLORS.navy }}>
              What are you saving for?
            </h2>
            <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: COLORS.gray }}>
              Select a goal type to get started
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
              }}
            >
              {suggestedGoals.map((goalType) => {
                const isSelected = goal.type === goalType.id

                return (
                  <button
                    key={goalType.id}
                    onClick={() => handleGoalTypeSelect(goalType)}
                    style={{
                      padding: "20px 16px",
                      borderRadius: "12px",
                      border: isSelected ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.lightGray}`,
                      background: isSelected ? `${COLORS.teal}10` : COLORS.white,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "32px",
                        marginBottom: "8px",
                      }}
                    >
                      {goalType.icon}
                    </div>
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: COLORS.navy,
                      }}
                    >
                      {goalType.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "11px",
                        color: COLORS.gray,
                      }}
                    >
                      {goalType.description}
                    </p>
                    {isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                        }}
                      >
                        <CheckCircle size={18} color={COLORS.teal} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* STEP 2: Amount & Name */}
        {step === 2 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: COLORS.navy }}>
              Set your target
            </h2>
            <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: COLORS.gray }}>How much do you want to save?</p>

            {/* Goal Name (if custom) */}
            {goal.type === "custom" && (
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: COLORS.navy,
                  }}
                >
                  Goal Name
                </label>
                <input
                  type="text"
                  value={goal.name}
                  onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                  placeholder="e.g., New Laptop, Medical Fund"
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: `1px solid ${COLORS.lightGray}`,
                    fontSize: "16px",
                    outline: "none",
                    boxSizing: "border-box",
                    color: COLORS.navy,
                  }}
                />
              </div>
            )}

            {/* Amount Input */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: COLORS.navy,
                }}
              >
                Target Amount
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: COLORS.white,
                  borderRadius: "12px",
                  border: `1px solid ${COLORS.lightGray}`,
                  padding: "0 16px",
                }}
              >
                <DollarSign size={24} color={COLORS.gray} />
                <input
                  type="number"
                  value={goal.targetAmount}
                  onChange={(e) => setGoal({ ...goal, targetAmount: e.target.value })}
                  placeholder="0"
                  style={{
                    flex: 1,
                    padding: "16px 0 16px 8px",
                    border: "none",
                    fontSize: "32px",
                    fontWeight: "700",
                    color: COLORS.navy,
                    outline: "none",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {[500, 1000, 2500, 5000, 10000, 25000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setGoal({ ...goal, targetAmount: amount.toString() })}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "20px",
                    border:
                      goal.targetAmount === amount.toString()
                        ? `2px solid ${COLORS.teal}`
                        : `1px solid ${COLORS.lightGray}`,
                    background: goal.targetAmount === amount.toString() ? `${COLORS.teal}10` : COLORS.white,
                    fontSize: "14px",
                    fontWeight: "600",
                    color: COLORS.navy,
                    cursor: "pointer",
                  }}
                >
                  ${amount.toLocaleString()}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 3: Timeline */}
        {step === 3 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: COLORS.navy }}>
              When do you need it?
            </h2>
            <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: COLORS.gray }}>
              Set a target date for "{goal.name}"
            </p>

            {/* Date Input */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: COLORS.navy,
                }}
              >
                Target Date
              </label>
              <input
                type="date"
                value={goal.deadline}
                onChange={(e) => setGoal({ ...goal, deadline: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  border: `1px solid ${COLORS.lightGray}`,
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                  color: COLORS.navy,
                }}
              />
            </div>

            {/* Quick Date Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {[
                { label: "3 months", months: 3 },
                { label: "6 months", months: 6 },
                { label: "1 year", months: 12 },
                { label: "2 years", months: 24 },
              ].map((option) => {
                const date = new Date()
                date.setMonth(date.getMonth() + option.months)
                const dateStr = date.toISOString().split("T")[0]
                const isSelected = goal.deadline === dateStr

                return (
                  <button
                    key={option.label}
                    onClick={() => setGoal({ ...goal, deadline: dateStr })}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: isSelected ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.lightGray}`,
                      background: isSelected ? `${COLORS.teal}10` : COLORS.white,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "15px", fontWeight: "600", color: COLORS.navy }}>{option.label}</span>
                    <span style={{ fontSize: "13px", color: COLORS.gray }}>
                      {date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Calculation Preview */}
            {goal.deadline && goal.targetAmount && (
              <div
                style={{
                  background: COLORS.navy,
                  borderRadius: "14px",
                  padding: "20px",
                  color: COLORS.white,
                }}
              >
                <p style={{ margin: "0 0 4px 0", fontSize: "13px", opacity: 0.8 }}>
                  To reach ${Number.parseFloat(goal.targetAmount).toLocaleString()}
                </p>
                <p style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>
                  ${calculateMonthly()?.toLocaleString()}
                  <span style={{ fontSize: "16px", fontWeight: "400" }}>/month</span>
                </p>
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Calendar size={16} color={COLORS.teal} />
                  <span style={{ fontSize: "13px", opacity: 0.9 }}>
                    {(() => {
                      const months = Math.ceil(
                        (new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30),
                      )
                      return `${months} months to reach your goal`
                    })()}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* STEP 4: Payout Allocation */}
        {step === 4 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700", color: COLORS.navy }}>
              Auto-fund from payouts
            </h2>
            <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: COLORS.gray }}>
              Automatically allocate a portion of your circle payouts to this goal
            </p>

            {/* Current Allocation Summary */}
            <div
              style={{
                background: COLORS.navy,
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "24px",
                color: COLORS.white,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Allocating to this goal</p>
                  <p style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>{goal.payoutAllocation}%</p>
                </div>
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: `conic-gradient(${COLORS.teal} ${(goal.payoutAllocation / 100) * 360}deg, rgba(255,255,255,0.2) 0deg)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: COLORS.navy,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Target size={24} color={COLORS.teal} />
                  </div>
                </div>
              </div>

              {/* Allocation Bar */}
              <div style={{ marginBottom: "12px" }}>
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
                      width: `${existingAllocations + goal.payoutAllocation}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, #6B7280 ${(existingAllocations / (existingAllocations + goal.payoutAllocation || 1)) * 100}%, ${COLORS.teal} 0%)`,
                      borderRadius: "4px",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", opacity: 0.8 }}>
                <span>Other goals: {existingAllocations}%</span>
                <span>Available: {availableAllocation}%</span>
              </div>
            </div>

            {/* Adjustment Controls */}
            <div
              style={{
                background: COLORS.white,
                borderRadius: "14px",
                padding: "20px",
                marginBottom: "16px",
                border: `1px solid ${COLORS.lightGray}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", marginBottom: "20px" }}>
                <button
                  onClick={() => setGoal({ ...goal, payoutAllocation: Math.max(0, goal.payoutAllocation - 5) })}
                  disabled={goal.payoutAllocation <= 0}
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    border: `1px solid ${goal.payoutAllocation <= 0 ? COLORS.lightGray : COLORS.teal}`,
                    background: COLORS.white,
                    cursor: goal.payoutAllocation <= 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Minus size={24} color={goal.payoutAllocation <= 0 ? COLORS.lightGray : COLORS.teal} />
                </button>

                <div style={{ textAlign: "center", minWidth: "100px" }}>
                  <p style={{ margin: 0, fontSize: "48px", fontWeight: "700", color: COLORS.navy }}>
                    {goal.payoutAllocation}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", color: COLORS.gray }}>percent</p>
                </div>

                <button
                  onClick={() => setGoal({ ...goal, payoutAllocation: Math.min(availableAllocation, goal.payoutAllocation + 5) })}
                  disabled={goal.payoutAllocation >= availableAllocation}
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    border: `1px solid ${goal.payoutAllocation >= availableAllocation ? COLORS.lightGray : COLORS.teal}`,
                    background: COLORS.white,
                    cursor: goal.payoutAllocation >= availableAllocation ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={24} color={goal.payoutAllocation >= availableAllocation ? COLORS.lightGray : COLORS.teal} />
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
                {allocationPresets.filter(p => p <= availableAllocation).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setGoal({ ...goal, payoutAllocation: preset })}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "20px",
                      border: goal.payoutAllocation === preset ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.lightGray}`,
                      background: goal.payoutAllocation === preset ? `${COLORS.teal}10` : COLORS.white,
                      fontSize: "14px",
                      fontWeight: "600",
                      color: COLORS.navy,
                      cursor: "pointer",
                    }}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            {/* Skip Option */}
            <button
              onClick={() => setGoal({ ...goal, payoutAllocation: 0 })}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: goal.payoutAllocation === 0 ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.lightGray}`,
                background: goal.payoutAllocation === 0 ? `${COLORS.teal}08` : COLORS.white,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "20px",
              }}
            >
              <Wallet size={18} color={goal.payoutAllocation === 0 ? COLORS.teal : COLORS.gray} />
              <span style={{ fontSize: "14px", fontWeight: "500", color: goal.payoutAllocation === 0 ? COLORS.teal : COLORS.gray }}>
                Skip - I'll fund manually
              </span>
              {goal.payoutAllocation === 0 && <CheckCircle size={16} color={COLORS.teal} />}
            </button>

            {/* Info Note */}
            <div
              style={{
                background: `${COLORS.teal}10`,
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <Info size={18} color={COLORS.teal} style={{ marginTop: "2px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "13px", color: COLORS.navy }}>
                When you receive a circle payout, {goal.payoutAllocation > 0 ? `${goal.payoutAllocation}% will automatically go to this goal` : "funds will go to your wallet"}. You can change this anytime in goal settings.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Bottom Action */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: COLORS.white,
          padding: "16px 20px 32px 20px",
          borderTop: `1px solid ${COLORS.lightGray}`,
        }}
      >
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canProceed() ? COLORS.teal : COLORS.lightGray,
            fontSize: "16px",
            fontWeight: "600",
            color: canProceed() ? COLORS.white : COLORS.gray,
            cursor: canProceed() ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {step === totalSteps ? "Create Goal" : "Continue"}
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
