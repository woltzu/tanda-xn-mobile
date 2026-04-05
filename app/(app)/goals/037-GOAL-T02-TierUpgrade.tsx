"use client"

import { useState } from "react"
import { ArrowLeft, Shield, TrendingUp, AlertTriangle, Star, Brain, Info, Loader2 } from "lucide-react"
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
  flexibleGreen: "#10B981",
  emergencyBlue: "#3B82F6",
  error: "#EF4444",
}

export default function TierUpgradeFlexibleToEmergency() {
  const { goalId } = useGoalParams()
  const { getGoalById, getGoalTypesList, upgradeTier, isLoading: contextLoading } = useSavings()

  const [isUpgrading, setIsUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goal = goalId ? getGoalById(goalId) : undefined
  const goalName = goal?.name || "Savings Goal"
  const currentAmount = goal?.currentBalance || 0
  const allGoalTypes = getGoalTypesList()

  // Find current tier type and emergency tier type from DB
  const currentGoalType = allGoalTypes.find((t) => t.code === goal?.savingsGoalTypeCode)
  const emergencyType = allGoalTypes.find((t) => t.code === "emergency")

  const currentTier = {
    name: currentGoalType?.name || "Flexible Goal",
    icon: currentGoalType?.emoji || "💰",
    penalty: currentGoalType?.early_withdrawal_penalty_percent || 0,
    penaltyLabel: `${currentGoalType?.early_withdrawal_penalty_percent || 0}%`,
    color: colors.flexibleGreen,
    bgColor: "#D1FAE5",
    xnBonus: "+0",
  }

  const upgradeTierData = {
    name: emergencyType?.name || "Emergency Fund",
    icon: emergencyType?.emoji || "🛡️",
    penalty: emergencyType?.early_withdrawal_penalty_percent || 2,
    penaltyLabel: `${emergencyType?.early_withdrawal_penalty_percent || 2}%`,
    color: colors.emergencyBlue,
    bgColor: "#DBEAFE",
    xnBonus: "+1",
  }

  const newPenaltyAmount = Math.round((currentAmount * upgradeTierData.penalty) / 100)

  const upgradeBenefits = [
    {
      icon: Brain,
      title: "Pause Before Spending",
      description: `The ${upgradeTierData.penaltyLabel} fee creates a 'speed bump' that makes you think twice before withdrawing`,
    },
    {
      icon: TrendingUp,
      title: "Higher Success Rate",
      description: "Emergency Fund users reach goals 85% of the time vs 72% for Flexible",
    },
    {
      icon: Star,
      title: "+1 XnScore Bonus",
      description: "Earn extra XnScore points when you successfully complete this goal",
    },
    {
      icon: Shield,
      title: "Better Accountability",
      description: "You'll need to state a reason for withdrawals, building awareness",
    },
  ]

  const handleUpgrade = async () => {
    if (!goalId) return
    setError(null)
    setIsUpgrading(true)
    try {
      await upgradeTier(goalId, "emergency")
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
        paddingBottom: "120px",
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

          <div style={{ marginLeft: "12px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              Increase Commitment
            </h1>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "13px",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {goalName}
            </p>
          </div>
        </div>

        {/* Tier Comparison Visual */}
        <div
          style={{
            padding: "20px",
            paddingTop: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            {/* Current Tier */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "36px",
                  margin: "0 auto 10px auto",
                  border: "2px solid rgba(255,255,255,0.2)",
                }}
              >
                {currentTier.icon}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                {currentTier.name}
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {currentTier.penaltyLabel} penalty
              </p>
            </div>

            {/* Arrow */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: `rgba(59, 130, 246, 0.3)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.emergencyBlue}
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>

            {/* New Tier */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "20px",
                  background: colors.emergencyBlue,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "36px",
                  margin: "0 auto 10px auto",
                  boxShadow: "0 8px 24px rgba(59, 130, 246, 0.4)",
                }}
              >
                {upgradeTierData.icon}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                {upgradeTierData.name}
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {upgradeTierData.penaltyLabel} penalty
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

        {/* Why Upgrade Card */}
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
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#F0FDF4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={18} color="#10B981" />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "700",
                color: colors.primaryNavy,
              }}
            >
              Why This Helps You Save
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {upgradeBenefits.map((benefit, idx) => {
              const Icon = benefit.icon
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "14px",
                    background: colors.background,
                    borderRadius: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: colors.emergencyBlue + "15",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} color={colors.emergencyBlue} />
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
                      {benefit.title}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "12px",
                        color: colors.textSecondary,
                        lineHeight: "1.4",
                      }}
                    >
                      {benefit.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* What Changes Card */}
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
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={18} color={colors.warningAmber} />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "700",
                color: colors.primaryNavy,
              }}
            >
              What Changes
            </h3>
          </div>

          {/* Penalty Change */}
          <div
            style={{
              padding: "16px",
              background: "#FEF3C7",
              borderRadius: "12px",
              marginBottom: "12px",
              border: "1px solid #FDE68A",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#92400E" }}>Early Withdrawal Penalty</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "14px",
                    color: "#9CA3AF",
                    textDecoration: "line-through",
                  }}
                >
                  {currentTier.penaltyLabel}
                </span>
                <span style={{ fontSize: "18px", fontWeight: "700", color: colors.warningAmber }}>
                  → {upgradeTierData.penaltyLabel}
                </span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#92400E", lineHeight: "1.5" }}>
              If you withdraw your ${currentAmount.toLocaleString()} early, you'd pay a{" "}
              <strong>${newPenaltyAmount.toLocaleString()}</strong> fee (small but meaningful!)
            </p>
          </div>

          {/* Comparison Grid */}
          <div
            style={{
              background: colors.background,
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {[
              { label: "Withdrawal Process", old: "Instant, no questions", new: "Must select a reason" },
              { label: "Downgrade Option", old: "N/A", new: "30-day notice" },
              { label: "XnScore Bonus", old: "+0 on completion", new: "+1 on completion" },
            ].map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: idx < 2 ? `1px solid ${colors.borders}` : "none",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: "13px",
                    color: colors.textSecondary,
                  }}
                >
                  {row.label}
                </span>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9CA3AF",
                      textDecoration: "line-through",
                      display: "block",
                    }}
                  >
                    {row.old}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: colors.primaryNavy,
                    }}
                  >
                    {row.new}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Note */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "16px",
            background: colors.emergencyBlue + "10",
            borderRadius: "12px",
            border: `1px solid ${colors.emergencyBlue}30`,
          }}
        >
          <Info size={18} color={colors.emergencyBlue} style={{ flexShrink: 0, marginTop: "2px" }} />
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: colors.primaryNavy,
              lineHeight: "1.5",
            }}
          >
            <strong>You can always upgrade further</strong> to Locked Saving later if you want even
            stronger commitment. You cannot downgrade without 30-day notice.
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
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={handleUpgrade}
          disabled={isUpgrading}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isUpgrading
              ? colors.borders
              : `linear-gradient(135deg, ${colors.emergencyBlue} 0%, #2563EB 100%)`,
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: isUpgrading ? "not-allowed" : "pointer",
            boxShadow: isUpgrading ? "none" : "0 8px 24px rgba(59, 130, 246, 0.3)",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            opacity: isUpgrading ? 0.7 : 1,
          }}
        >
          {isUpgrading ? (
            <>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              Upgrading...
            </>
          ) : (
            <>
              <Shield size={18} />
              Upgrade to {upgradeTierData.name}
            </>
          )}
        </button>

        <p
          style={{
            margin: "12px 0 0 0",
            fontSize: "12px",
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          Takes effect immediately
        </p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
