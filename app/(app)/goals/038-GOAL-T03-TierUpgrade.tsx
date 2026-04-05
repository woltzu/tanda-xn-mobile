"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Lock,
  TrendingUp,
  Check,
  AlertTriangle,
  Star,
  Award,
  Info,
  Calendar,
  ChevronRight,
  Calculator,
  Users,
  Target,
  Loader2,
} from "lucide-react"
import { useSavings } from "@/context/SavingsContext"
import { useGoalParams, goBack } from "./useGoalParams"

// Brand Colors
const colors = {
  primaryNavy: "#0A2342",
  accentTeal: "#00C6AE",
  warningAmber: "#D97706",
  background: "#F5F7FA",
  cards: "#FFFFFF",
  borders: "#E5E7EB",
  textSecondary: "#6B7280",
  lockedPurple: "#8B5CF6",
  emergencyBlue: "#3B82F6",
  successGreen: "#10B981",
  error: "#EF4444",
}

export default function TierUpgradeScreen() {
  const { goalId } = useGoalParams()
  const { getGoalById, getGoalTypesList, upgradeTier, isLoading: contextLoading } = useSavings()

  const [selectedLockOption, setSelectedLockOption] = useState<string | null>(null)
  const [showPenaltyCalculator, setShowPenaltyCalculator] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goal = goalId ? getGoalById(goalId) : undefined
  const goalName = goal?.name || "Savings Goal"
  const currentAmount = goal?.currentBalance || 0
  const targetAmount = goal?.targetAmount || 0

  const allGoalTypes = getGoalTypesList()

  // Find current tier type and locked tier type from DB
  const currentGoalType = allGoalTypes.find((t) => t.code === goal?.savingsGoalTypeCode)
  const lockedType = allGoalTypes.find((t) => t.code === "locked")

  const currentPenaltyPercent = currentGoalType?.early_withdrawal_penalty_percent || 2
  const newPenaltyPercent = lockedType?.early_withdrawal_penalty_percent || 7
  const lockPeriodDays = lockedType?.lock_period_days || 365

  const [calculatorAmount, setCalculatorAmount] = useState(currentAmount > 0 ? currentAmount : 5400)

  // Calculate target date from goal metadata or default
  const currentTargetDate = goal?.maturityDate || new Date(Date.now() + lockPeriodDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  // Lock duration options
  const lockOptions = [
    {
      id: "goal_date",
      label: "Until Goal Date",
      date: currentTargetDate,
      description: "Locked until your target date",
      recommended: true,
    },
    {
      id: "6_months",
      label: "6 Months",
      date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      description: "Short-term commitment",
    },
    {
      id: "1_year",
      label: "1 Year",
      date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      description: "Medium-term commitment",
    },
    {
      id: "custom",
      label: "Custom Date",
      date: null,
      description: "Choose your own lock date",
    },
  ]

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Select date"
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  // Calculate days until unlock
  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return 0
    const now = new Date()
    const target = new Date(dateStr)
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  // Penalty calculations from DB data
  const currentPenalty = currentAmount * (currentPenaltyPercent / 100)
  const newPenalty = currentAmount * (newPenaltyPercent / 100)

  const selectedOption = lockOptions.find((o) => o.id === selectedLockOption)
  const canProceed = selectedLockOption && agreedToTerms

  const handleUpgrade = async () => {
    if (!goalId || !canProceed) return
    setError(null)
    setIsUpgrading(true)
    try {
      await upgradeTier(goalId, "locked")
      goBack()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upgrade tier")
    } finally {
      setIsUpgrading(false)
    }
  }

  // Loading state
  if (contextLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <Loader2 size={32} color={colors.accentTeal} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ color: colors.textSecondary, fontSize: "14px" }}>Loading upgrade details...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Error: no goal found
  if (goalId && !goal) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          padding: "20px",
        }}
      >
        <AlertTriangle size={32} color={colors.error} />
        <p style={{ color: colors.primaryNavy, fontSize: "16px", fontWeight: "600" }}>Goal not found</p>
        <button
          onClick={() => goBack()}
          style={{
            padding: "12px 24px",
            borderRadius: "10px",
            border: "none",
            background: colors.accentTeal,
            color: "#FFFFFF",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          Go Back
        </button>
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
      {/* Header - Navy */}
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
            padding: "12px 20px",
          }}
        >
          <button
            onClick={() => goBack()}
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

          <div style={{ marginLeft: "12px", flex: 1 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              Upgrade to Locked Saving
            </h1>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "13px",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {goalName} {currentAmount > 0 ? `• $${currentAmount.toLocaleString()} saved` : ""}
            </p>
          </div>
        </div>

        {/* Current vs New Visual */}
        <div style={{ padding: "16px 20px 24px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            {/* Current */}
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "16px 20px",
                textAlign: "center",
                minWidth: "120px",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>{currentGoalType?.emoji || "🛡️"}</div>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>Current</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                {currentGoalType?.name || "Emergency"}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: colors.emergencyBlue }}>
                {currentPenaltyPercent}% penalty
              </p>
            </div>

            {/* Arrow */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: colors.lockedPurple,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={20} color="#FFFFFF" />
            </div>

            {/* New */}
            <div
              style={{
                background: colors.lockedPurple,
                borderRadius: "16px",
                padding: "16px 20px",
                textAlign: "center",
                minWidth: "120px",
                boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>{lockedType?.emoji || "🔒"}</div>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Upgrade to</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                {lockedType?.name || "Locked"}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#E9D5FF" }}>
                {newPenaltyPercent}% penalty
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Error Banner */}
        {error && (
          <div
            style={{
              background: `${colors.error}15`,
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              border: `1px solid ${colors.error}30`,
            }}
          >
            <AlertTriangle size={18} color={colors.error} />
            <p style={{ margin: 0, fontSize: "13px", color: colors.error }}>{error}</p>
          </div>
        )}

        {/* Why Locked? Quick Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          {[
            { icon: TrendingUp, value: "93%", label: "Success Rate", color: colors.successGreen },
            { icon: Star, value: "+3", label: "XnScore Bonus", color: colors.lockedPurple },
            { icon: Users, value: "Priority", label: "Circle Access", color: colors.accentTeal },
          ].map((stat, idx) => {
            const Icon = stat.icon
            return (
              <div
                key={idx}
                style={{
                  background: colors.cards,
                  borderRadius: "14px",
                  padding: "14px 10px",
                  textAlign: "center",
                  border: `1px solid ${colors.borders}`,
                }}
              >
                <Icon size={18} color={stat.color} style={{ marginBottom: "6px" }} />
                <p
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "700",
                    color: stat.color,
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "10px",
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                    fontWeight: "600",
                  }}
                >
                  {stat.label}
                </p>
              </div>
            )
          })}
        </div>

        {/* Step 1: Select Lock Duration */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: colors.lockedPurple,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              1
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "700",
                color: colors.primaryNavy,
              }}
            >
              Choose Your Lock Period
            </h3>
          </div>

          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "13px",
              color: colors.textSecondary,
              lineHeight: "1.5",
            }}
          >
            When should your funds become available? Longer locks = stronger commitment.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {lockOptions.map((option) => {
              const isSelected = selectedLockOption === option.id
              const daysUntil = option.date ? getDaysUntil(option.date) : 0

              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedLockOption(option.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "16px",
                    background: isSelected ? colors.lockedPurple + "10" : colors.background,
                    borderRadius: "14px",
                    border: isSelected ? `2px solid ${colors.lockedPurple}` : `1px solid ${colors.borders}`,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Radio Circle */}
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      border: isSelected ? "none" : `2px solid ${colors.borders}`,
                      background: isSelected ? colors.lockedPurple : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: "600",
                          color: colors.primaryNavy,
                        }}
                      >
                        {option.label}
                      </span>
                      {option.recommended && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: "700",
                            color: colors.lockedPurple,
                            background: colors.lockedPurple + "15",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: colors.textSecondary,
                      }}
                    >
                      {option.description}
                    </span>
                  </div>

                  {/* Date/Duration */}
                  {option.date && (
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          fontWeight: "600",
                          color: colors.primaryNavy,
                        }}
                      >
                        {formatDate(option.date)}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0 0",
                          fontSize: "11px",
                          color: colors.textSecondary,
                        }}
                      >
                        {daysUntil} days
                      </p>
                    </div>
                  )}

                  {option.id === "custom" && <Calendar size={18} color={colors.textSecondary} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Understand the Penalty */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: colors.warningAmber,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              2
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "700",
                color: colors.primaryNavy,
              }}
            >
              Understand the Commitment
            </h3>
          </div>

          {/* Penalty Comparison */}
          <div
            style={{
              background: "#FEF3C7",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #FDE68A",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#92400E" }}>Early Withdrawal Penalty</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#FFFFFF",
                  padding: "4px 10px",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "14px", color: "#9CA3AF", textDecoration: "line-through" }}>
                  {currentPenaltyPercent}%
                </span>
                <span style={{ fontSize: "16px", fontWeight: "700", color: colors.warningAmber }}>
                  → {newPenaltyPercent}%
                </span>
              </div>
            </div>

            {/* Penalty Amount */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "10px",
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "11px", color: "#92400E", marginBottom: "4px" }}>
                  Current Penalty ({currentPenaltyPercent}%)
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "700",
                    color: "#9CA3AF",
                    textDecoration: "line-through",
                  }}
                >
                  ${currentPenalty.toLocaleString()}
                </p>
              </div>
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "10px",
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "11px", color: "#92400E", marginBottom: "4px" }}>
                  New Penalty ({newPenaltyPercent}%)
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "700",
                    color: colors.warningAmber,
                  }}
                >
                  ${newPenalty.toLocaleString()}
                </p>
              </div>
            </div>

            <p
              style={{
                margin: "12px 0 0 0",
                fontSize: "12px",
                color: "#92400E",
                textAlign: "center",
              }}
            >
              Based on your current balance of ${currentAmount.toLocaleString()}
            </p>
          </div>

          {/* Penalty Calculator Toggle */}
          <button
            onClick={() => setShowPenaltyCalculator(!showPenaltyCalculator)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "12px 16px",
              background: colors.background,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Calculator size={18} color={colors.lockedPurple} />
              <span style={{ fontSize: "14px", fontWeight: "600", color: colors.primaryNavy }}>Penalty Calculator</span>
            </div>
            <ChevronRight
              size={18}
              color={colors.textSecondary}
              style={{
                transform: showPenaltyCalculator ? "rotate(90deg)" : "none",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {/* Calculator Expanded */}
          {showPenaltyCalculator && (
            <div
              style={{
                marginTop: "12px",
                padding: "16px",
                background: colors.background,
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: colors.textSecondary }}>
                See penalty at different balances:
              </p>
              <input
                type="range"
                min="1000"
                max="50000"
                step="500"
                value={calculatorAmount}
                onChange={(e) => setCalculatorAmount(Number(e.target.value))}
                style={{ width: "100%", marginBottom: "12px" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: "12px", color: colors.textSecondary }}>Balance</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: colors.primaryNavy }}>
                    ${calculatorAmount.toLocaleString()}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: colors.textSecondary }}>
                    {newPenaltyPercent}% Penalty Would Be
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: colors.warningAmber }}>
                    ${(calculatorAmount * (newPenaltyPercent / 100)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* What This Means */}
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "700",
              color: colors.primaryNavy,
            }}
          >
            What This Means For You
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              {
                icon: Lock,
                title: "Funds Locked",
                description: selectedOption
                  ? `Your money stays locked until ${formatDate(selectedOption.date)}`
                  : "Select a lock period above",
                color: colors.lockedPurple,
              },
              {
                icon: AlertTriangle,
                title: "Emergency Access",
                description: `You CAN still withdraw, but you'll pay the ${newPenaltyPercent}% penalty`,
                color: colors.warningAmber,
              },
              {
                icon: Award,
                title: "Completion Bonus",
                description: "Earn +3 XnScore points when you reach your goal",
                color: colors.successGreen,
              },
              {
                icon: Target,
                title: "No Going Back",
                description: "You cannot downgrade to a lower tier after this",
                color: colors.primaryNavy,
              },
            ].map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "12px",
                    background: colors.background,
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: item.color + "15",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} color={item.color} />
                  </div>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: "600",
                        color: colors.primaryNavy,
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        fontSize: "12px",
                        color: colors.textSecondary,
                        lineHeight: "1.4",
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Info Note */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "16px",
            background: colors.lockedPurple + "10",
            borderRadius: "12px",
            border: `1px solid ${colors.lockedPurple}20`,
          }}
        >
          <Info size={18} color={colors.lockedPurple} style={{ flexShrink: 0, marginTop: "2px" }} />
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: colors.primaryNavy,
              lineHeight: "1.5",
            }}
          >
            <strong>Why {newPenaltyPercent}%?</strong> Research shows that a meaningful penalty (but not too harsh) is the most effective
            commitment device. It's enough to make you think twice, but still accessible in a true emergency.
          </p>
        </div>
      </div>

      {/* Fixed Bottom Action */}
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
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        }}
      >
        {/* Agreement Checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "16px",
            cursor: "pointer",
          }}
        >
          <div
            onClick={() => setAgreedToTerms(!agreedToTerms)}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "8px",
              border: agreedToTerms ? "none" : `2px solid ${colors.borders}`,
              background: agreedToTerms ? colors.lockedPurple : colors.cards,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
              transition: "all 0.2s ease",
            }}
          >
            {agreedToTerms && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </div>
          <span
            style={{
              fontSize: "13px",
              color: colors.textSecondary,
              lineHeight: "1.5",
            }}
          >
            I understand my funds will be{" "}
            <strong style={{ color: colors.primaryNavy }}>
              locked
              {selectedOption ? ` until ${formatDate(selectedOption.date)}` : ""}
            </strong>{" "}
            and early withdrawal incurs a <strong style={{ color: colors.warningAmber }}>{newPenaltyPercent}% penalty</strong>
          </span>
        </label>

        <button
          onClick={handleUpgrade}
          disabled={!canProceed || isUpgrading}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canProceed && !isUpgrading
              ? `linear-gradient(135deg, ${colors.lockedPurple} 0%, #7C3AED 100%)`
              : colors.borders,
            fontSize: "16px",
            fontWeight: "600",
            color: canProceed && !isUpgrading ? "#FFFFFF" : colors.textSecondary,
            cursor: canProceed && !isUpgrading ? "pointer" : "not-allowed",
            boxShadow: canProceed && !isUpgrading ? "0 8px 24px rgba(139, 92, 246, 0.3)" : "none",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          {isUpgrading ? (
            <>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              Upgrading...
            </>
          ) : (
            <>
              <Lock size={18} />
              {canProceed
                ? `Lock Until ${selectedOption ? formatDate(selectedOption.date) : ""}`
                : selectedLockOption
                  ? "Confirm Above to Continue"
                  : "Select a Lock Period First"}
            </>
          )}
        </button>

        <p
          style={{
            margin: "10px 0 0 0",
            fontSize: "11px",
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          This action cannot be undone
        </p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
