"use client"

import { useState } from "react"
import { ArrowLeft, DollarSign, Calendar, TrendingUp, Check, Shield, Lock, Wallet, Info } from "lucide-react"

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

export default function GoalSetupScreen() {
  const selectedGoals = [
    { id: "home", label: "Buy a Home" },
    { id: "education", label: "Education / School Fees" },
  ]

  const [currentGoalIndex, setCurrentGoalIndex] = useState(0)
  const [goalConfigs, setGoalConfigs] = useState(
    selectedGoals.map((goal) => ({
      ...goal,
      targetAmount: "",
      targetDate: "",
      tier: 2,
      monthlyCapacity: "$100 - $250",
    })),
  )
  const [showTierInfo, setShowTierInfo] = useState(false)

  const currentGoal = goalConfigs[currentGoalIndex]
  const isLastGoal = currentGoalIndex === selectedGoals.length - 1

  const tierOptions = [
    {
      tier: 1,
      icon: Wallet,
      name: "Flexible",
      emoji: "💰",
      color: "#10B981",
      bgColor: "#D1FAE5",
      description: "Withdraw anytime",
      features: ["No fees", "No questions", "Maximum freedom"],
      bestFor: "Short-term goals, vacation funds",
    },
    {
      tier: 2,
      icon: Shield,
      name: "Emergency Fund",
      emoji: "🏥",
      color: "#3B82F6",
      bgColor: "#DBEAFE",
      description: "Smart accountability",
      features: ["Must state reason", "2% fee if non-emergency", "Builds discipline"],
      bestFor: "Safety nets, planned purchases",
      recommended: true,
    },
    {
      tier: 3,
      icon: Lock,
      name: "Locked Savings",
      emoji: "🔒",
      color: "#8B5CF6",
      bgColor: "#EDE9FE",
      description: "Maximum discipline",
      features: ["Cannot withdraw early", "10% penalty if needed", "Strongest commitment"],
      bestFor: "Home down payment, retirement",
    },
  ]

  const updateCurrentGoal = (field, value) => {
    const updated = [...goalConfigs]
    updated[currentGoalIndex] = { ...updated[currentGoalIndex], [field]: value }
    setGoalConfigs(updated)
  }

  const formatCurrency = (value) => {
    const num = value.replace(/[^\d]/g, "")
    return num ? Number.parseInt(num).toLocaleString() : ""
  }

  const handleAmountChange = (e) => {
    const formatted = formatCurrency(e.target.value)
    updateCurrentGoal("targetAmount", formatted)
  }

  const calculateMonths = () => {
    if (!currentGoal.targetDate) return 0
    const target = new Date(currentGoal.targetDate)
    const today = new Date()
    return Math.max(1, (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()))
  }

  const calculateMonthly = () => {
    const amount = Number.parseFloat(currentGoal.targetAmount.replace(/,/g, "")) || 0
    const months = calculateMonths()
    return months > 0 ? Math.ceil(amount / months) : 0
  }

  const handleNext = () => {
    if (isLastGoal) {
      console.log("Complete setup", goalConfigs)
    } else {
      setCurrentGoalIndex(currentGoalIndex + 1)
    }
  }

  const handleBack = () => {
    if (currentGoalIndex > 0) {
      setCurrentGoalIndex(currentGoalIndex - 1)
    } else {
      console.log("Back to previous screen")
    }
  }

  const canProceed = currentGoal.targetAmount && currentGoal.targetDate && currentGoal.tier

  return (
    <div
      style={{
        background: colors.background,
        minHeight: "100vh",
        paddingBottom: "100px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header - Navy background */}
      <div
        style={{
          background: colors.primaryNavy,
          padding: "0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Status Bar Spacer */}
        <div style={{ height: "44px", background: colors.primaryNavy }} />

        {/* Navigation Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "10px",
              width: "40px",
              height: "40px",
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </button>

          {/* Step Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              Step 6 of 8
            </span>
          </div>

          {/* Spacer for alignment */}
          <div style={{ width: "40px" }} />
        </div>

        {/* Overall Progress Bar (Step 6 of 8) */}
        <div
          style={{
            padding: "0 20px 12px 20px",
          }}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "4px",
              height: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: colors.accentTeal,
                height: "100%",
                width: "75%",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Goal Progress Indicator */}
        {selectedGoals.length > 1 && (
          <div
            style={{
              padding: "0 20px 16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Goal {currentGoalIndex + 1} of {selectedGoals.length}
            </span>
            <div
              style={{
                display: "flex",
                gap: "4px",
              }}
            >
              {selectedGoals.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: idx <= currentGoalIndex ? colors.accentTeal : "rgba(255, 255, 255, 0.3)",
                    transition: "background 0.2s ease",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Title Section */}
        <div
          style={{
            padding: "8px 20px 24px 20px",
          }}
        >
          <h1
            style={{
              color: "#FFFFFF",
              fontSize: "24px",
              fontWeight: "700",
              margin: "0 0 8px 0",
              lineHeight: "1.2",
            }}
          >
            Set Up: {currentGoal.label}
          </h1>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              margin: 0,
              fontSize: "15px",
              lineHeight: "1.5",
            }}
          >
            Define your target and choose your savings style
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Target Amount */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: colors.primaryNavy,
              marginBottom: "8px",
            }}
          >
            Target Amount
          </label>
          <div style={{ position: "relative" }}>
            <DollarSign
              size={18}
              color={colors.textSecondary}
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="10,000"
              value={currentGoal.targetAmount}
              onChange={handleAmountChange}
              style={{
                width: "100%",
                padding: "16px 16px 16px 44px",
                borderRadius: "14px",
                border: `1px solid ${colors.borders}`,
                fontSize: "18px",
                fontWeight: "600",
                boxSizing: "border-box",
                background: colors.cards,
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Target Date */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: colors.primaryNavy,
              marginBottom: "8px",
            }}
          >
            Target Date
          </label>
          <div style={{ position: "relative" }}>
            <Calendar
              size={18}
              color={colors.textSecondary}
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              type="date"
              value={currentGoal.targetDate}
              onChange={(e) => updateCurrentGoal("targetDate", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              style={{
                width: "100%",
                padding: "16px 16px 16px 44px",
                borderRadius: "14px",
                border: `1px solid ${colors.borders}`,
                fontSize: "16px",
                boxSizing: "border-box",
                background: colors.cards,
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Projection Card */}
        {currentGoal.targetAmount && currentGoal.targetDate && (
          <div
            style={{
              background: colors.primaryNavy,
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "24px",
              color: "#FFFFFF",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <TrendingUp size={18} color={colors.accentTeal} />
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Your Savings Plan</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "14px", opacity: 0.8 }}>Goal amount:</span>
              <span style={{ fontSize: "16px", fontWeight: "600" }}>${currentGoal.targetAmount}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "14px", opacity: 0.8 }}>Time to reach:</span>
              <span style={{ fontSize: "16px", fontWeight: "600" }}>{calculateMonths()} months</span>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.2)",
                paddingTop: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "14px" }}>Monthly savings needed:</span>
              <span style={{ fontSize: "24px", fontWeight: "700", color: colors.accentTeal }}>
                ${calculateMonthly().toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* 3-TIER SELECTION */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <label
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: colors.primaryNavy,
              }}
            >
              Choose Your Savings Style
            </label>
            <button
              onClick={() => setShowTierInfo(!showTierInfo)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: colors.accentTeal,
                fontSize: "12px",
                fontWeight: "600",
                fontFamily: "inherit",
              }}
            >
              <Info size={14} />
              Learn more
            </button>
          </div>

          {/* Tier Info Expanded */}
          {showTierInfo && (
            <div
              style={{
                background: "#F0FDFB",
                border: `1px solid ${colors.accentTeal}`,
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "13px",
                  color: colors.primaryNavy,
                  fontWeight: "600",
                }}
              >
                How do tiers work?
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: colors.textSecondary,
                  lineHeight: "1.5",
                }}
              >
                Tiers help you stay disciplined. Higher tiers make it harder to withdraw, which helps you reach your
                goals. You can upgrade anytime, but cannot downgrade.
              </p>
            </div>
          )}

          {/* Tier Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {tierOptions.map((option) => {
              const isSelected = currentGoal.tier === option.tier

              return (
                <button
                  key={option.tier}
                  onClick={() => updateCurrentGoal("tier", option.tier)}
                  style={{
                    background: isSelected ? option.bgColor : colors.cards,
                    border: isSelected ? `2px solid ${option.color}` : `1px solid ${colors.borders}`,
                    borderRadius: "14px",
                    padding: "16px",
                    cursor: "pointer",
                    textAlign: "left",
                    position: "relative",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                  }}
                >
                  {/* Recommended Badge */}
                  {option.recommended && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-10px",
                        right: "12px",
                        background: option.color,
                        color: "#FFFFFF",
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "4px 8px",
                        borderRadius: "8px",
                        textTransform: "uppercase",
                      }}
                    >
                      Recommended
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {/* Emoji */}
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        background: option.bgColor,
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "22px",
                      }}
                    >
                      {option.emoji}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: "600",
                            color: colors.primaryNavy,
                          }}
                        >
                          {option.name}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: colors.textSecondary,
                        }}
                      >
                        {option.description}
                      </p>
                    </div>

                    {/* Selection Indicator */}
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: isSelected ? "none" : `2px solid ${colors.borders}`,
                        background: isSelected ? option.color : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && <Check size={14} color="#FFFFFF" />}
                    </div>
                  </div>

                  {/* Expanded Features (when selected) */}
                  {isSelected && (
                    <div
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: `1px solid ${option.color}30`,
                      }}
                    >
                      {option.features.map((feature, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: idx < option.features.length - 1 ? "6px" : 0,
                          }}
                        >
                          <Check size={12} color={option.color} />
                          <span style={{ fontSize: "12px", color: colors.textSecondary }}>{feature}</span>
                        </div>
                      ))}
                      <p
                        style={{
                          margin: "8px 0 0 0",
                          fontSize: "11px",
                          color: option.color,
                          fontWeight: "600",
                        }}
                      >
                        Best for: {option.bestFor}
                      </p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button */}
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
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={handleNext}
          disabled={!canProceed}
          style={{
            width: "100%",
            background: canProceed ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)` : colors.borders,
            color: canProceed ? "#FFFFFF" : colors.textSecondary,
            border: "none",
            borderRadius: "14px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: canProceed ? "pointer" : "not-allowed",
            boxShadow: canProceed ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
            fontFamily: "inherit",
          }}
        >
          {isLastGoal ? "Complete Setup" : `Next Goal (${currentGoalIndex + 2}/${selectedGoals.length})`}
        </button>
      </div>
    </div>
  )
}
