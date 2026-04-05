"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Info,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  Shield,
  Lock,
  Unlock,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { useSavings } from "@/context/SavingsContext"
import { useGoalParams, navigateToGoalScreen, goBack } from "./useGoalParams"

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

/** Derive the 3-tier concept from DB goal type properties */
const deriveTierFromType = (goalType: { lock_period_days: number; early_withdrawal_penalty_percent: number }): "flexible" | "emergency" | "locked" => {
  if (goalType.lock_period_days >= 365 && goalType.early_withdrawal_penalty_percent >= 5) return "locked"
  if (goalType.lock_period_days > 0 || goalType.early_withdrawal_penalty_percent > 0) return "emergency"
  return "flexible"
}

const TIER_ICON_MAP: Record<string, JSX.Element> = {
  flexible: <Unlock size={28} color={COLORS.teal} />,
  emergency: <Shield size={28} color={COLORS.teal} />,
  locked: <Lock size={28} color={COLORS.teal} />,
}

const TIER_META: Record<string, { valueProposition: string; benefits: string[]; tradeoffs: string[]; bestFor: string }> = {
  flexible: {
    valueProposition: "Convenience & Tracking",
    benefits: ["Withdraw any amount, anytime", "No early withdrawal penalty", "Track progress without commitment"],
    tradeoffs: ["Easier to break your savings habit", "No behavioral commitment device"],
    bestFor: "Short-term goals, travel funds, gadgets",
  },
  emergency: {
    valueProposition: "Protection & Discipline",
    benefits: [
      "Small penalty discourages impulse withdrawals",
      "Still accessible in true emergencies",
      "Builds savings discipline",
    ],
    tradeoffs: ["Small fee if you withdraw early", "Requires more commitment"],
    bestFor: "Rainy day funds, medical reserves, buffer savings",
  },
  locked: {
    valueProposition: "Powerful Commitment",
    benefits: [
      "Strongest protection against impulse spending",
      "Penalty is a real deterrent",
      "Best for big, important goals",
    ],
    tradeoffs: ["Limited withdrawal at once", "Notice period to downgrade tier", "Penalty on early withdrawals"],
    bestFor: "Down payments, weddings, major life purchases",
  },
}

export default function TierSelectionScreen() {
  const { goalId } = useGoalParams()
  const { getGoalById, getGoalTypesList, upgradeTier, isLoading: contextLoading } = useSavings()

  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goal = goalId ? getGoalById(goalId) : undefined
  const goalName = goal?.name || "Savings Goal"
  const currentTierCode = goal?.savingsGoalTypeCode || null

  // Build tier options from DB goal types, grouped by derived tier
  const allGoalTypes = getGoalTypesList()

  // Group goal types by derived tier and pick the representative one for each tier
  const tierGroups: Record<string, typeof allGoalTypes> = {}
  allGoalTypes.forEach((gt) => {
    const tier = deriveTierFromType(gt)
    if (!tierGroups[tier]) tierGroups[tier] = []
    tierGroups[tier].push(gt)
  })

  // Build display tiers in order
  const tierOrder: Array<"flexible" | "emergency" | "locked"> = ["flexible", "emergency", "locked"]
  const tiers = tierOrder
    .filter((t) => tierGroups[t] && tierGroups[t].length > 0)
    .map((tierKey) => {
      const group = tierGroups[tierKey]
      // Use the first type in the group as the representative
      const rep = group[0]
      const penalty = rep.early_withdrawal_penalty_percent
      const lockDays = rep.lock_period_days
      const meta = TIER_META[tierKey] || TIER_META.flexible

      return {
        id: tierKey,
        code: rep.code,
        name: rep.name,
        icon: TIER_ICON_MAP[tierKey] || <Unlock size={28} color={COLORS.teal} />,
        penalty: `${penalty}%`,
        penaltyValue: penalty,
        withdrawLimit: lockDays >= 365 ? "25%" : "100%",
        lockPeriod: lockDays > 0 ? `${lockDays} days` : "None",
        valueProposition: meta.valueProposition,
        description: rep.description || meta.bestFor,
        benefits: meta.benefits,
        tradeoffs: meta.tradeoffs,
        bestFor: meta.bestFor,
        // All type codes in this tier group (for the upgrade call)
        typeCodes: group.map((g) => g.code),
      }
    })

  // Default selected tier to current goal's tier or first option
  if (selectedTier === null && tiers.length > 0) {
    const currentTierKey = goal?.type || tiers[0].id
    // Use setTimeout-free approach: set during render if needed
    // We'll handle this with a check
  }
  const effectiveSelectedTier = selectedTier || goal?.type || (tiers.length > 0 ? tiers[0].id : "flexible")
  const selectedTierData = tiers.find((t) => t.id === effectiveSelectedTier)

  // Handle tier upgrade
  const handleSelectTier = async () => {
    if (!goalId || !selectedTierData) return
    setError(null)
    setIsUpgrading(true)
    try {
      await upgradeTier(goalId, selectedTierData.code)
      goBack()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update tier")
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
          background: COLORS.offWhite,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <Loader2 size={32} color={COLORS.teal} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ color: COLORS.gray, fontSize: "14px" }}>Loading tier options...</p>
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
          background: COLORS.offWhite,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px",
          padding: "20px",
        }}
      >
        <AlertTriangle size={32} color={COLORS.error} />
        <p style={{ color: COLORS.navy, fontSize: "16px", fontWeight: "600" }}>Goal not found</p>
        <button
          onClick={() => goBack()}
          style={{
            padding: "12px 24px",
            borderRadius: "10px",
            border: "none",
            background: COLORS.teal,
            color: COLORS.white,
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
            onClick={() => goBack()}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: COLORS.white }}>Choose Savings Type</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{goalName}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Error Banner */}
        {error && (
          <div
            style={{
              background: `${COLORS.error}15`,
              borderRadius: "12px",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              border: `1px solid ${COLORS.error}30`,
            }}
          >
            <AlertTriangle size={18} color={COLORS.error} />
            <p style={{ margin: 0, fontSize: "13px", color: COLORS.error }}>{error}</p>
          </div>
        )}

        {/* Explainer */}
        <div
          style={{
            background: `${COLORS.teal}10`,
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <Info size={20} color={COLORS.teal} style={{ marginTop: "2px", flexShrink: 0 }} />
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: COLORS.navy }}>
              How This Works
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: COLORS.gray }}>
              Early withdrawal penalties are <strong>behavioral tools</strong>, not fees. They help you stick to your
              savings goals by making it costly to break your commitment.
            </p>
          </div>
        </div>

        {/* Tier Cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {tiers.map((tier) => {
            const isSelected = effectiveSelectedTier === tier.id
            const isCurrent = currentTierCode ? tier.typeCodes.includes(currentTierCode) : false

            return (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                style={{
                  width: "100%",
                  padding: "20px",
                  borderRadius: "16px",
                  border: isSelected ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.lightGray}`,
                  background: isSelected ? `${COLORS.teal}08` : COLORS.white,
                  cursor: "pointer",
                  textAlign: "left",
                  position: "relative",
                }}
              >
                {isCurrent && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-10px",
                      right: "12px",
                      background: COLORS.teal,
                      color: COLORS.white,
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontSize: "10px",
                      fontWeight: "700",
                    }}
                  >
                    CURRENT
                  </span>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "14px",
                      background: COLORS.offWhite,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {tier.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: COLORS.navy }}>
                        {tier.name}
                      </h3>
                      {isSelected && <CheckCircle size={18} color={COLORS.teal} />}
                    </div>

                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: COLORS.teal,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {tier.valueProposition}
                    </p>

                    <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: COLORS.gray }}>{tier.description}</p>

                    {/* Key Stats */}
                    <div style={{ display: "flex", gap: "24px" }}>
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "10px",
                            color: COLORS.gray,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Penalty
                        </p>
                        <p
                          style={{
                            margin: "2px 0 0 0",
                            fontSize: "20px",
                            fontWeight: "700",
                            color: tier.penaltyValue === 0 ? COLORS.success : COLORS.navy,
                          }}
                        >
                          {tier.penalty}
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "10px",
                            color: COLORS.gray,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Max Withdraw
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: COLORS.navy }}>
                          {tier.withdrawLimit}
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "10px",
                            color: COLORS.gray,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Lock
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: COLORS.navy }}>
                          {tier.lockPeriod}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Compare Button */}
        <button
          onClick={() => setShowComparison(!showComparison)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: `1px solid ${COLORS.lightGray}`,
            background: COLORS.white,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "20px",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: "600", color: COLORS.navy }}>
            {showComparison ? "Hide Details" : "Compare All Options"}
          </span>
          <ChevronDown
            size={18}
            color={COLORS.gray}
            style={{
              transform: showComparison ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {/* Comparison Table */}
        {showComparison && (
          <div
            style={{
              background: COLORS.white,
              borderRadius: "16px",
              overflow: "hidden",
              border: `1px solid ${COLORS.lightGray}`,
              marginBottom: "20px",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                background: COLORS.offWhite,
                borderBottom: `1px solid ${COLORS.lightGray}`,
              }}
            >
              <div style={{ width: "100px", padding: "12px", fontSize: "11px", fontWeight: "600", color: COLORS.gray }}>
                Feature
              </div>
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    textAlign: "center",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: COLORS.navy,
                  }}
                >
                  {tier.name.split(" ")[0]}
                </div>
              ))}
            </div>

            {/* Rows - built from DB data */}
            {[
              { label: "Penalty", values: tiers.map((t) => t.penalty) },
              { label: "Max Withdraw", values: tiers.map((t) => t.withdrawLimit) },
              { label: "Lock Period", values: tiers.map((t) => t.lockPeriod) },
              { label: "Best For", values: tiers.map((t) => {
                if (t.id === "flexible") return "Short-term"
                if (t.id === "emergency") return "Protection"
                return "Long-term"
              }) },
            ].map((row, idx) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  borderBottom: idx < 3 ? `1px solid ${COLORS.offWhite}` : "none",
                }}
              >
                <div
                  style={{
                    width: "100px",
                    padding: "12px",
                    fontSize: "12px",
                    color: COLORS.gray,
                    background: COLORS.offWhite,
                  }}
                >
                  {row.label}
                </div>
                {row.values.map((value, vidx) => (
                  <div
                    key={vidx}
                    style={{
                      flex: 1,
                      padding: "12px 8px",
                      textAlign: "center",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: COLORS.navy,
                    }}
                  >
                    {value}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Selected Tier Details */}
        {selectedTierData && (
          <div
            style={{
              background: COLORS.white,
              borderRadius: "16px",
              padding: "20px",
              border: `1px solid ${COLORS.lightGray}`,
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: COLORS.navy }}>
              What You Get with {selectedTierData.name}
            </h3>

            {/* Benefits */}
            <div style={{ marginBottom: "16px" }}>
              {selectedTierData.benefits.map((benefit, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "8px",
                  }}
                >
                  <CheckCircle size={16} color={COLORS.success} />
                  <span style={{ fontSize: "14px", color: COLORS.navy }}>{benefit}</span>
                </div>
              ))}
            </div>

            {/* Trade-offs */}
            {selectedTierData.tradeoffs.length > 0 && (
              <div
                style={{
                  background: `${COLORS.warning}10`,
                  borderRadius: "10px",
                  padding: "12px",
                }}
              >
                <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "600", color: COLORS.warning }}>
                  Trade-offs
                </p>
                {selectedTierData.tradeoffs.map((tradeoff, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: idx < selectedTierData.tradeoffs.length - 1 ? "4px" : 0,
                    }}
                  >
                    <AlertTriangle size={14} color={COLORS.warning} />
                    <span style={{ fontSize: "13px", color: COLORS.navy }}>{tradeoff}</span>
                  </div>
                ))}
              </div>
            )}

            <p
              style={{
                margin: "16px 0 0 0",
                fontSize: "13px",
                color: COLORS.gray,
                padding: "12px",
                background: COLORS.offWhite,
                borderRadius: "8px",
              }}
            >
              <strong style={{ color: COLORS.navy }}>Best for:</strong> {selectedTierData.bestFor}
            </p>
          </div>
        )}
      </div>

      {/* Action Button */}
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
          onClick={handleSelectTier}
          disabled={isUpgrading}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isUpgrading ? COLORS.lightGray : COLORS.teal,
            fontSize: "16px",
            fontWeight: "600",
            color: COLORS.white,
            cursor: isUpgrading ? "not-allowed" : "pointer",
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
              Updating...
            </>
          ) : currentTierCode && selectedTierData?.typeCodes.includes(currentTierCode) ? (
            "Keep Current Type"
          ) : (
            <>
              Select {selectedTierData?.name}
              <ChevronRight size={20} />
            </>
          )}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
