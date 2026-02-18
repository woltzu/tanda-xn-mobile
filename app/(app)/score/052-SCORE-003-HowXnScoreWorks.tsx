"use client"
import { useState } from "react"

export default function HowXnScoreWorksScreen() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [expandedFactor, setExpandedFactor] = useState<number | null>(null)

  // 6 Tiers based on V3.0 algorithm
  const scoreTiers = [
    {
      min: 90,
      max: 100,
      label: "Elite",
      color: "#FFD700",
      icon: "⭐",
      description: "2+ years perfect history",
      benefits: "Any slot • 0.5% early fee • 3% late bonus • $5K loans",
    },
    {
      min: 75,
      max: 89,
      label: "Excellent",
      color: "#00C6AE",
      icon: "🏆",
      description: "12+ months strong track record",
      benefits: "Any slot • 1% early fee • 2.5% late bonus • $3K loans",
    },
    {
      min: 60,
      max: 74,
      label: "Good",
      color: "#00C6AE",
      icon: "✓",
      description: "6-12 months solid behavior",
      benefits: "Slot 4+ • 2% early fee • 2% late bonus • $1.5K loans",
    },
    {
      min: 45,
      max: 59,
      label: "Fair",
      color: "#D97706",
      icon: "⚠",
      description: "New or some issues",
      benefits: "Slot 7+ • 4% early fee • 1% late bonus • $500 loans",
    },
    {
      min: 25,
      max: 44,
      label: "Poor",
      color: "#EF4444",
      icon: "⚡",
      description: "Building trust",
      benefits: "Last 3 slots • 7% early fee • No late bonus • No loans",
    },
    {
      min: 0,
      max: 24,
      label: "Critical",
      color: "#991B1B",
      icon: "🚫",
      description: "Account under review",
      benefits: "Cannot join new circles",
    },
  ]

  // 6 Factors based on V3.0 algorithm
  const scoringFactors = [
    {
      name: "Payment History",
      weight: "35 pts",
      icon: "💳",
      description: "Your payment reliability",
      subFactors: [
        { name: "On-Time Rate", points: "20 pts", detail: "(On-time payments / Total) × 20" },
        { name: "Payment Streak", points: "10 pts", detail: "Consecutive on-time payments ÷ 5 (max 10)" },
        { name: "No Defaults", points: "5 pts", detail: "+5 if never defaulted, -5 if any default (permanent)" },
      ],
      tip: "One late payment resets your streak to 0. Defaults are permanent.",
    },
    {
      name: "Circle Completion",
      weight: "25 pts",
      icon: "🎯",
      description: "Finishing what you start",
      subFactors: [
        { name: "Completion Rate", points: "15 pts", detail: "(Completed circles / Joined) × 15" },
        { name: "Full Cycles", points: "10 pts", detail: "1 cycle=2pts, 2=4pts, 3=6pts, 4=8pts, 5+=10pts" },
      ],
      tip: "Early exits in the last 12 months cost 3 points each.",
    },
    {
      name: "Time & Reliability",
      weight: "20 pts",
      icon: "⏰",
      description: "Account age and consistency",
      subFactors: [
        { name: "Account Age", points: "10 pts", detail: "(Days active / 730) × 10 — max at 24 months" },
        { name: "Sustained Activity", points: "10 pts", detail: "Active months ratio × 10 — gaps >3mo penalized" },
      ],
      tip: "This factor rewards patience. Time cannot be rushed.",
    },
    {
      name: "Security Deposit",
      weight: "10 pts",
      icon: "🔒",
      description: "Skin in the game",
      subFactors: [
        { name: "Deposit Amount", points: "0-10 pts", detail: "3× contribution=10pts, 2×=7pts, 1.5×=5pts, 1×=3pts" },
      ],
      tip: "Deposit must be locked for 90+ days to count. Withdrawing loses all points.",
    },
    {
      name: "Diversity & Social",
      weight: "7 pts",
      icon: "🤝",
      description: "Multiple circles and trust network",
      subFactors: [
        { name: "Circle Diversity", points: "5 pts", detail: "1 pt per unique circle (90+ days, 3+ payments)" },
        { name: "Social Validation", points: "2 pts", detail: "Vouchers from members with 70+ score" },
      ],
      tip: "Circles must be 90+ days old to count. Each person can only vouch for 3 others.",
    },
    {
      name: "Engagement",
      weight: "3 pts",
      icon: "✅",
      description: "Profile and verification",
      subFactors: [
        { name: "Profile Complete", points: "1 pt", detail: "Photo, bio, phone verified" },
        { name: "KYC Verified", points: "1 pt", detail: "Government ID verified" },
        { name: "Longevity", points: "1 pt", detail: "Active for 12+ months" },
      ],
      tip: "Quick points to earn right away!",
    },
  ]

  // Age-based caps
  const ageCaps = [
    { months: "0-6", maxScore: 75, description: "Building trust" },
    { months: "6-12", maxScore: 85, description: "Establishing history" },
    { months: "12-18", maxScore: 90, description: "Proving reliability" },
    { months: "18+", maxScore: 100, description: "Full potential unlocked" },
  ]

  // Updated FAQs for V3.0
  const faqs = [
    {
      question: "How is XnScore different from a credit score?",
      answer:
        "XnScore is internal to TandaXn only. We don't report to credit bureaus or check your credit. It measures your behavior within our platform — how you pay, complete circles, and participate.",
    },
    {
      question: "Why can't I reach 100 yet?",
      answer:
        "We cap scores based on account age to prevent gaming. Under 6 months: max 75. Under 12 months: max 85. Under 18 months: max 90. This ensures high scores are truly earned over time.",
    },
    {
      question: "What's the fastest way to improve?",
      answer:
        "Focus on Payment History (35%) — pay on time every time. Complete your circles fully. Lock a security deposit. The rest takes time and consistency.",
    },
    {
      question: "Can my score go down?",
      answer:
        "Yes. Late payments, missed payments, and early circle exits reduce your score. A default (missed payment never recovered) is a permanent -5 penalty that never expires. Two defaults result in account ban.",
    },
    {
      question: "What's the First Circle Bonus?",
      answer:
        "When you complete your very first full circle, you get a one-time +5 bonus. This rewards proving you can finish what you start. It only applies once.",
    },
    {
      question: "How do vouchers work?",
      answer:
        "Members with 70+ XnScore can vouch for you. Each voucher adds +1 point (max 2). But each person can only vouch for 3 others — so vouches are valuable and limited.",
    },
    {
      question: "What if I had a default but recovered?",
      answer:
        "Unfortunately, defaults leave a permanent -5 scar on your score. Even with perfect behavior after, you'll max out around 95. This is intentional — defaults are serious.",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>How XnScore Works</h1>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9, lineHeight: 1.6 }}>
            XnScore is your <strong>trust rating</strong> on TandaXn. It&apos;s built on <strong>6 factors</strong> that
            measure how reliably you save, pay, and participate over time.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Score Tiers (6 tiers) */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            6 Score Tiers (0-100)
          </h3>

          {/* Tier bar visualization */}
          <div
            style={{
              height: "28px",
              borderRadius: "14px",
              overflow: "hidden",
              display: "flex",
              marginBottom: "16px",
            }}
          >
            {scoreTiers.map((tier, idx) => (
              <div
                key={idx}
                style={{
                  flex: tier.max - tier.min + 1,
                  background: tier.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <span style={{ fontSize: "10px" }}>{tier.icon}</span>
                <span style={{ fontSize: "9px", fontWeight: "700", color: "#FFFFFF" }}>{tier.label}</span>
              </div>
            ))}
          </div>

          {/* Tier details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {scoreTiers.map((tier, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  borderLeft: `4px solid ${tier.color}`,
                }}
              >
                <span style={{ fontSize: "18px" }}>{tier.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{tier.label}</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: tier.color }}>
                      {tier.min}-{tier.max}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 4px 0", fontSize: "10px", color: "#6B7280" }}>{tier.description}</p>
                  <p style={{ margin: 0, fontSize: "10px", color: "#0A2342" }}>{tier.benefits}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6 Scoring Factors (Expandable) */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            6 Factors That Affect Your Score
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#6B7280" }}>
            Tap each factor to see detailed breakdown
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {scoringFactors.map((factor, idx) => (
              <div key={idx}>
                <button
                  onClick={() => setExpandedFactor(expandedFactor === idx ? null : idx)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: expandedFactor === idx ? "#F0FDFB" : "#F5F7FA",
                    border: expandedFactor === idx ? "1px solid #00C6AE" : "1px solid #E5E7EB",
                    borderRadius: expandedFactor === idx ? "10px 10px 0 0" : "10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>{factor.icon}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{factor.name}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{factor.description}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        background: "#0A2342",
                        color: "#FFFFFF",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "700",
                      }}
                    >
                      {factor.weight}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#6B7280"
                      strokeWidth="2"
                      style={{ transform: expandedFactor === idx ? "rotate(180deg)" : "none", transition: "0.2s" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {expandedFactor === idx && (
                  <div
                    style={{
                      padding: "14px",
                      background: "#F0FDFB",
                      borderRadius: "0 0 10px 10px",
                      border: "1px solid #00C6AE",
                      borderTop: "none",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                      {factor.subFactors.map((sub, subIdx) => (
                        <div
                          key={subIdx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            padding: "8px 10px",
                            background: "#FFFFFF",
                            borderRadius: "8px",
                          }}
                        >
                          <div>
                            <p style={{ margin: 0, fontSize: "12px", fontWeight: "500", color: "#0A2342" }}>
                              {sub.name}
                            </p>
                            <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{sub.detail}</p>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              color: "#00C6AE",
                            }}
                          >
                            {sub.points}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        padding: "8px 10px",
                        background: "#FEF3C7",
                        borderRadius: "8px",
                        display: "flex",
                        gap: "8px",
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ fontSize: "12px" }}>💡</span>
                      <p style={{ margin: 0, fontSize: "11px", color: "#92400E" }}>{factor.tip}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Age-Based Caps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Age-Based Score Caps</h3>
          </div>

          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            To prevent gaming, we cap your maximum score based on account age. Even with perfect behavior, you
            can&apos;t rush to 100 — trust takes time.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ageCaps.map((cap, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "#F5F7FA",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: idx === 3 ? "#00C6AE" : "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    {idx === 3 ? "🔓" : "🔒"}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                      {cap.months} months
                    </p>
                    <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>{cap.description}</p>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: idx === 3 ? "#00C6AE" : "#0A2342",
                  }}
                >
                  Max {cap.maxScore}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* First Circle Bonus */}
        <div
          style={{
            background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "32px" }}>🎁</span>
          <div>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              First Circle Bonus: +5 Points
            </h4>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#0A2342", opacity: 0.8 }}>
              Complete your first full circle and earn a one-time +5 bonus!
            </p>
          </div>
        </div>

        {/* FAQs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            Common Questions
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {faqs.map((faq, idx) => (
              <div key={idx}>
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: expandedFaq === idx ? "#F5F7FA" : "transparent",
                    border: "1px solid #E5E7EB",
                    borderRadius: expandedFaq === idx ? "10px 10px 0 0" : "10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342", paddingRight: "12px" }}>
                    {faq.question}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280"
                    strokeWidth="2"
                    style={{
                      transform: expandedFaq === idx ? "rotate(180deg)" : "none",
                      transition: "0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {expandedFaq === idx && (
                  <div
                    style={{
                      padding: "12px",
                      background: "#F5F7FA",
                      borderRadius: "0 0 10px 10px",
                      border: "1px solid #E5E7EB",
                      borderTop: "none",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.6 }}>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => console.log("Improve tips")}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#00C6AE",
            fontSize: "15px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          Tips to Improve Your Score
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
