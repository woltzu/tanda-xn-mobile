"use client"

import { useState } from "react"
import { ArrowLeft, Unlock, Shield, Lock, Check, X, HelpCircle, ChevronDown, ChevronUp, ArrowRight } from "lucide-react"

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
  lockedPurple: "#8B5CF6",
}

export default function TierComparisonScreen() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const currentTier = null // null if selecting for new goal

  const tiers = [
    {
      id: "flexible",
      name: "Flexible",
      subtitle: "Freedom & Tracking",
      icon: "💰",
      lucideIcon: Unlock,
      color: colors.flexibleGreen,
      bgColor: "#D1FAE5",
      lightBg: "#F0FDF4",
      penalty: "0%",
      penaltyDesc: "No penalty",
      xnBonus: "+0",
      successRate: "72%",
      features: [
        { text: "Withdraw anytime", included: true },
        { text: "No questions asked", included: true },
        { text: "Basic goal tracking", included: true },
        { text: "XnScore bonus", included: false },
        { text: "Priority circle matching", included: false },
      ],
      bestFor: "Short-term goals, vacation funds, flexible savings",
      whoShouldUse: "People who want tracking without restrictions",
    },
    {
      id: "emergency",
      name: "Emergency Fund",
      subtitle: "Smart Accountability",
      icon: "🛡️",
      lucideIcon: Shield,
      color: colors.emergencyBlue,
      bgColor: "#DBEAFE",
      lightBg: "#EFF6FF",
      penalty: "2%",
      penaltyDesc: "Small speed bump",
      xnBonus: "+1",
      successRate: "85%",
      recommended: true,
      features: [
        { text: "Withdraw with reason", included: true },
        { text: "2% fee = pause to think", included: true },
        { text: "Advanced goal tracking", included: true },
        { text: "+1 XnScore on completion", included: true },
        { text: "Priority circle matching", included: false },
      ],
      bestFor: "Emergency funds, planned purchases, mid-term goals",
      whoShouldUse: "People who want a small barrier to impulse spending",
    },
    {
      id: "locked",
      name: "Locked Saving",
      subtitle: "Maximum Commitment",
      icon: "🔒",
      lucideIcon: Lock,
      color: colors.lockedPurple,
      bgColor: "#EDE9FE",
      lightBg: "#F5F3FF",
      penalty: "7%",
      penaltyDesc: "Strong commitment",
      xnBonus: "+3",
      successRate: "93%",
      features: [
        { text: "Locked until goal date", included: true },
        { text: "7% = powerful commitment", included: true },
        { text: "Premium goal tracking", included: true },
        { text: "+3 XnScore on completion", included: true },
        { text: "Priority circle matching", included: true },
      ],
      bestFor: "Home down payment, retirement, major life goals",
      whoShouldUse: "Serious savers who want maximum accountability",
    },
  ]

  const faqs = [
    {
      q: "Can I change my tier later?",
      a: "You can upgrade to a higher commitment tier at any time. However, you cannot downgrade - this is intentional to maintain your commitment. Choose wisely!",
    },
    {
      q: "What counts as an 'emergency' for Emergency Fund tier?",
      a: "You select a reason when withdrawing (medical, job loss, car repair, etc.). We don't verify - the 2% fee is simply a 'speed bump' to make you pause and consider if it's truly necessary.",
    },
    {
      q: "What happens if I REALLY need money from Locked tier?",
      a: "You can still withdraw, but you'll pay the 7% penalty. This is designed to be painful enough to prevent impulse withdrawals while still providing an emergency escape valve.",
    },
    {
      q: "How does the XnScore bonus work?",
      a: "When you successfully reach your goal amount by your target date, you receive the bonus XnScore points. Higher tiers = bigger bonus because you demonstrated stronger commitment.",
    },
    {
      q: "Which tier has the best success rate?",
      a: "Locked tier users reach their goals 93% of the time, compared to 85% for Emergency Fund and 72% for Flexible. The accountability makes a real difference!",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: currentTier === null ? "120px" : "40px",
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
            padding: "12px 20px 20px 20px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
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
                fontSize: "22px",
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              Compare Savings Tiers
            </h1>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "13px",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Choose your commitment level
            </p>
          </div>
        </div>
      </div>

      {/* Tier Cards - Horizontal Scroll on Mobile */}
      <div
        style={{
          padding: "20px",
          paddingBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            overflowX: "auto",
            paddingBottom: "8px",
            margin: "0 -20px",
            padding: "0 20px 8px 20px",
            scrollSnapType: "x mandatory",
          }}
        >
          {tiers.map((tier) => {
            const Icon = tier.lucideIcon
            const isSelected = selectedTier === tier.id
            const isCurrent = currentTier === tier.id

            return (
              <div
                key={tier.id}
                onClick={() => !isCurrent && setSelectedTier(tier.id)}
                style={{
                  minWidth: "280px",
                  background: colors.cards,
                  borderRadius: "20px",
                  padding: "20px",
                  border: isSelected
                    ? `3px solid ${tier.color}`
                    : isCurrent
                      ? `2px solid ${colors.borders}`
                      : `1px solid ${colors.borders}`,
                  cursor: isCurrent ? "default" : "pointer",
                  position: "relative",
                  scrollSnapAlign: "start",
                  transition: "all 0.2s ease",
                  opacity: isCurrent ? 0.6 : 1,
                  boxShadow: isSelected ? `0 8px 24px ${tier.color}25` : "none",
                }}
              >
                {/* Recommended Badge */}
                {tier.recommended && !isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      right: "16px",
                      background: tier.color,
                      color: "#FFFFFF",
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "4px 10px",
                      borderRadius: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    ⭐ Recommended
                  </div>
                )}

                {/* Current Badge */}
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      right: "16px",
                      background: colors.textSecondary,
                      color: "#FFFFFF",
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "4px 10px",
                      borderRadius: "10px",
                      textTransform: "uppercase",
                    }}
                  >
                    Current
                  </div>
                )}

                {/* Tier Header */}
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "16px",
                      background: tier.bgColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      margin: "0 auto 12px auto",
                    }}
                  >
                    {tier.icon}
                  </div>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: "18px",
                      fontWeight: "700",
                      color: colors.primaryNavy,
                    }}
                  >
                    {tier.name}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: colors.textSecondary,
                    }}
                  >
                    {tier.subtitle}
                  </p>
                </div>

                {/* Key Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      background: tier.lightBg,
                      borderRadius: "10px",
                      padding: "12px",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "20px",
                        fontWeight: "700",
                        color: tier.color,
                      }}
                    >
                      {tier.penalty}
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
                      Penalty
                    </p>
                  </div>
                  <div
                    style={{
                      background: tier.lightBg,
                      borderRadius: "10px",
                      padding: "12px",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "20px",
                        fontWeight: "700",
                        color: tier.color,
                      }}
                    >
                      {tier.successRate}
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
                      Success
                    </p>
                  </div>
                </div>

                {/* Features List */}
                <div style={{ marginBottom: "16px" }}>
                  {tier.features.map((feature, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 0",
                        borderBottom: idx < tier.features.length - 1 ? `1px solid ${colors.background}` : "none",
                      }}
                    >
                      {feature.included ? (
                        <Check size={14} color={tier.color} strokeWidth={3} />
                      ) : (
                        <X size={14} color="#D1D5DB" strokeWidth={2} />
                      )}
                      <span
                        style={{
                          fontSize: "13px",
                          color: feature.included ? colors.primaryNavy : "#9CA3AF",
                        }}
                      >
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Best For */}
                <div
                  style={{
                    background: colors.background,
                    borderRadius: "10px",
                    padding: "12px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      color: colors.textSecondary,
                      textTransform: "uppercase",
                      fontWeight: "600",
                      marginBottom: "4px",
                    }}
                  >
                    Best for
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: colors.primaryNavy,
                      lineHeight: "1.4",
                    }}
                  >
                    {tier.bestFor}
                  </p>
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      left: "16px",
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: tier.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Comparison Table */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "16px",
            fontWeight: "700",
            color: colors.primaryNavy,
          }}
        >
          Quick Comparison
        </h3>
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            overflow: "hidden",
            border: `1px solid ${colors.borders}`,
          }}
        >
          {[
            { label: "Withdrawal", values: ["Anytime", "With reason", "At goal date"] },
            { label: "Penalty", values: ["0%", "2%", "7%"] },
            { label: "XnScore Bonus", values: ["+0", "+1", "+3"] },
            { label: "Can Downgrade", values: ["—", "No", "No"] },
            { label: "Success Rate", values: ["72%", "85%", "93%"] },
          ].map((row, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                borderBottom: idx < 4 ? `1px solid ${colors.background}` : "none",
              }}
            >
              <div
                style={{
                  padding: "12px",
                  background: colors.background,
                  fontSize: "12px",
                  fontWeight: "600",
                  color: colors.textSecondary,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {row.label}
              </div>
              {row.values.map((value, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: colors.primaryNavy,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: selectedTier === tiers[i].id ? tiers[i].lightBg : "transparent",
                  }}
                >
                  {value}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "16px",
            fontWeight: "700",
            color: colors.primaryNavy,
          }}
        >
          Common Questions
        </h3>
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            overflow: "hidden",
            border: `1px solid ${colors.borders}`,
          }}
        >
          {faqs.map((faq, idx) => (
            <div key={idx}>
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "none",
                  borderBottom:
                    idx < faqs.length - 1 && expandedFaq !== idx ? `1px solid ${colors.background}` : "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontFamily: "inherit",
                }}
              >
                <HelpCircle size={18} color={colors.accentTeal} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    fontSize: "14px",
                    fontWeight: "600",
                    color: colors.primaryNavy,
                  }}
                >
                  {faq.q}
                </span>
                {expandedFaq === idx ? (
                  <ChevronUp size={18} color={colors.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={colors.textSecondary} />
                )}
              </button>
              {expandedFaq === idx && (
                <div
                  style={{
                    padding: "0 16px 16px 46px",
                    background: colors.background,
                    borderBottom: idx < faqs.length - 1 ? `1px solid ${colors.borders}` : "none",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: colors.textSecondary,
                      lineHeight: "1.6",
                    }}
                  >
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Bottom - Only show if selecting tier */}
      {currentTier === null && (
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
            onClick={() => selectedTier && console.log("Select tier:", selectedTier)}
            disabled={!selectedTier}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: selectedTier
                ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)`
                : colors.borders,
              fontSize: "16px",
              fontWeight: "600",
              color: selectedTier ? "#FFFFFF" : colors.textSecondary,
              cursor: selectedTier ? "pointer" : "not-allowed",
              boxShadow: selectedTier ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {selectedTier ? (
              <>
                Select {tiers.find((t) => t.id === selectedTier)?.name} Tier
                <ArrowRight size={18} />
              </>
            ) : (
              "Select a Tier to Continue"
            )}
          </button>
        </div>
      )}
    </div>
  )
}
