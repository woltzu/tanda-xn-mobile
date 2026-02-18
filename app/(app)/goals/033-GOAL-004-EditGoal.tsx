"use client"

import { useState } from "react"
import { ArrowLeft, Save, Info, ChevronRight, DollarSign, Calendar, Shield, Lock, Unlock } from "lucide-react"

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

export default function EditGoalScreen() {
  const [goal, setGoal] = useState({
    id: "g1",
    name: "Emergency Fund",
    emoji: "🛡️",
    description: "3 months of expenses for unexpected situations",
    targetAmount: 5000,
    currentAmount: 3200,
    tier: "emergency",
    deadline: "2025-06-30",
    monthlyContribution: 400,
    autoContribute: true,
  })
  const [hasChanges, setHasChanges] = useState(false)

  const tiers = {
    flexible: {
      name: "Flexible Goal",
      icon: <Unlock size={20} color={COLORS.teal} />,
      penalty: "0%",
      penaltyValue: 0,
      description: "Full access anytime",
    },
    emergency: {
      name: "Emergency Fund",
      icon: <Shield size={20} color={COLORS.teal} />,
      penalty: "2%",
      penaltyValue: 2,
      description: "Small penalty for discipline",
    },
    locked: {
      name: "Locked Saving",
      icon: <Lock size={20} color={COLORS.teal} />,
      penalty: "5%",
      penaltyValue: 5,
      description: "Strong commitment device",
    },
  }

  const updateGoal = (updates: Partial<typeof goal>) => {
    setGoal({ ...goal, ...updates })
    setHasChanges(true)
  }

  const calculateMonthly = () => {
    if (!goal.targetAmount || !goal.deadline) return null
    const remaining = goal.targetAmount - goal.currentAmount
    const deadlineDate = new Date(goal.deadline)
    const now = new Date()
    const months = Math.max(1, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    return Math.ceil(remaining / months)
  }

  const currentTier = tiers[goal.tier as keyof typeof tiers] || tiers.flexible

  const handleSave = () => {
    if (hasChanges) {
      console.log("Saving goal:", goal)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.offWhite,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
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
          }}
        >
          <button
            onClick={() => console.log("Back")}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: COLORS.white }}>Edit Goal</h1>
          </div>
          {hasChanges && (
            <span
              style={{
                background: "rgba(217,119,6,0.3)",
                color: "#FCD34D",
                padding: "4px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Unsaved
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Goal Preview */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px",
            border: `1px solid ${COLORS.lightGray}`,
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: COLORS.offWhite,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
            }}
          >
            {goal.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700", color: COLORS.navy }}>
              {goal.name}
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: COLORS.gray }}>
              ${goal.currentAmount.toLocaleString()} of ${goal.targetAmount.toLocaleString()} saved
            </p>
          </div>
        </div>

        {/* Goal Name */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "12px",
            border: `1px solid ${COLORS.lightGray}`,
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: COLORS.navy }}
          >
            Goal Name
          </label>
          <input
            type="text"
            value={goal.name}
            onChange={(e) => updateGoal({ name: e.target.value })}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: `1px solid ${COLORS.lightGray}`,
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
              color: COLORS.navy,
            }}
          />
        </div>

        {/* Description */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "12px",
            border: `1px solid ${COLORS.lightGray}`,
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: COLORS.navy }}
          >
            Description (optional)
          </label>
          <textarea
            value={goal.description}
            onChange={(e) => updateGoal({ description: e.target.value })}
            placeholder="Add a note to remind yourself..."
            rows={3}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: `1px solid ${COLORS.lightGray}`,
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
              resize: "none",
              color: COLORS.navy,
            }}
          />
        </div>

        {/* Target Amount */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "12px",
            border: `1px solid ${COLORS.lightGray}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.navy }}>Target Amount</label>
            <span style={{ fontSize: "11px", color: COLORS.gray }}>
              Min: ${goal.currentAmount.toLocaleString()} (already saved)
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: COLORS.offWhite,
              borderRadius: "10px",
              padding: "0 12px",
            }}
          >
            <DollarSign size={20} color={COLORS.gray} />
            <input
              type="number"
              value={goal.targetAmount}
              onChange={(e) => {
                const value = Math.max(goal.currentAmount, Number.parseInt(e.target.value) || 0)
                updateGoal({ targetAmount: value })
              }}
              style={{
                flex: 1,
                padding: "14px 0 14px 8px",
                border: "none",
                fontSize: "18px",
                fontWeight: "600",
                color: COLORS.navy,
                outline: "none",
                background: "transparent",
              }}
            />
          </div>
        </div>

        {/* Target Date */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "12px",
            border: `1px solid ${COLORS.lightGray}`,
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: COLORS.navy }}
          >
            Target Date
          </label>
          <input
            type="date"
            value={goal.deadline}
            onChange={(e) => updateGoal({ deadline: e.target.value })}
            min={new Date().toISOString().split("T")[0]}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: `1px solid ${COLORS.lightGray}`,
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
              color: COLORS.navy,
            }}
          />
        </div>

        {/* Calculation Card */}
        {goal.deadline && goal.targetAmount && (
          <div
            style={{
              background: COLORS.navy,
              borderRadius: "14px",
              padding: "20px",
              marginBottom: "12px",
              color: COLORS.white,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Remaining to save</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>
                  ${(goal.targetAmount - goal.currentAmount).toLocaleString()}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Monthly needed</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: COLORS.teal }}>
                  ${calculateMonthly()?.toLocaleString()}
                </p>
              </div>
            </div>

            <div
              style={{
                paddingTop: "16px",
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
                  return `${months} months remaining`
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Monthly Contribution */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "12px",
            border: `1px solid ${COLORS.lightGray}`,
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: COLORS.navy }}
          >
            Your Monthly Contribution
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: COLORS.offWhite,
              borderRadius: "10px",
              padding: "0 12px",
            }}
          >
            <DollarSign size={20} color={COLORS.gray} />
            <input
              type="number"
              value={goal.monthlyContribution}
              onChange={(e) => updateGoal({ monthlyContribution: Number.parseInt(e.target.value) || 0 })}
              style={{
                flex: 1,
                padding: "14px 0 14px 8px",
                border: "none",
                fontSize: "18px",
                fontWeight: "600",
                color: COLORS.navy,
                outline: "none",
                background: "transparent",
              }}
            />
            <span style={{ fontSize: "14px", color: COLORS.gray }}>/mo</span>
          </div>

          {calculateMonthly() && goal.monthlyContribution < calculateMonthly() && (
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: "12px",
                color: COLORS.warning,
              }}
            >
              ⚠️ You need ${calculateMonthly()}/mo to reach your goal on time
            </p>
          )}
        </div>

        {/* Auto-Contribute Toggle */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "12px",
            border: `1px solid ${COLORS.lightGray}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: COLORS.navy }}>Auto-Save</p>
            <p style={{ margin: 0, fontSize: "12px", color: COLORS.gray }}>Automatically contribute each month</p>
          </div>
          <button
            onClick={() => updateGoal({ autoContribute: !goal.autoContribute })}
            style={{
              width: "52px",
              height: "32px",
              borderRadius: "16px",
              border: "none",
              background: goal.autoContribute ? COLORS.teal : COLORS.lightGray,
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                background: COLORS.white,
                position: "absolute",
                top: "3px",
                left: goal.autoContribute ? "23px" : "3px",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>

        {/* Current Tier */}
        <button
          onClick={() => console.log("Upgrade tier")}
          style={{
            width: "100%",
            background: COLORS.white,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "12px",
            border: `1px solid ${COLORS.lightGray}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: COLORS.offWhite,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {currentTier.icon}
            </div>
            <div>
              <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: COLORS.navy }}>
                {currentTier.name}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: COLORS.gray }}>
                {currentTier.penalty} early withdrawal penalty
              </p>
            </div>
          </div>
          <ChevronRight size={20} color={COLORS.gray} />
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
            Changes take effect immediately. Your current balance and transaction history will not be affected.
          </p>
        </div>
      </div>

      {/* Save Button */}
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
          onClick={handleSave}
          disabled={!hasChanges}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: hasChanges ? COLORS.teal : COLORS.lightGray,
            fontSize: "16px",
            fontWeight: "600",
            color: hasChanges ? COLORS.white : COLORS.gray,
            cursor: hasChanges ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Save size={20} />
          Save Changes
        </button>
      </div>
    </div>
  )
}
