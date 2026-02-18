"use client"

import { useState } from "react"
import {
  ArrowLeft,
  DollarSign,
  Clock,
  AlertTriangle,
  Calendar,
  Award,
  Info,
  ChevronDown,
  ChevronUp,
  Users,
  FileText,
} from "lucide-react"

export default function CircleRulesScreen() {
  const [expandedSection, setExpandedSection] = useState("payment")
  const [agreed, setAgreed] = useState(false)

  const circle = {
    name: "Diaspora Family Fund",
    type: "family",
    contribution: 200,
    frequency: "monthly",
    maxMembers: 12,
    totalPool: 2400,
    paymentDue: "5th of each month",
    gracePeriod: 2,
    latePenalty: 10,
    defaultPenalty: 10,
    minScore: 50,
    elder: {
      name: "Grace M.",
      responsibilities: [
        "Mediating disputes between members",
        "Approving new member applications",
        "Managing payout order adjustments",
        "Handling emergency situations",
      ],
    },
  }

  const sections = [
    {
      id: "payment",
      title: "Payment Rules",
      icon: DollarSign,
      color: "#00C6AE",
      rules: [
        {
          title: "Contribution Amount",
          description: `Each member contributes $${circle.contribution} per ${circle.frequency === "monthly" ? "month" : circle.frequency === "biweekly" ? "two weeks" : "week"}.`,
        },
        {
          title: "Payment Due Date",
          description: `Contributions are due by the ${circle.paymentDue}.`,
        },
        {
          title: "Payment Methods",
          description: "Payments can be made via linked bank account, debit card, or wallet balance.",
        },
        {
          title: "Auto-Pay Option",
          description: "Members can enable auto-pay to ensure on-time contributions.",
        },
      ],
    },
    {
      id: "grace",
      title: "Grace Period & Penalties",
      icon: Clock,
      color: "#F59E0B",
      rules: [
        {
          title: "Grace Period",
          description: `There is a ${circle.gracePeriod}-day grace period after the due date for late payments.`,
        },
        {
          title: "Late Payment Penalty",
          description: `Payments made after the grace period incur a ${circle.latePenalty}% penalty fee.`,
        },
        {
          title: "Default Consequences",
          description: "If payment is not received within 7 days, the member is marked as defaulted.",
        },
        {
          title: "XnScore Impact",
          description:
            "Late payments and defaults negatively impact your XnScore, affecting your payout position in future circles.",
        },
      ],
    },
    {
      id: "default",
      title: "Default Handling",
      icon: AlertTriangle,
      color: "#EF4444",
      rules: [
        {
          title: "Default Definition",
          description: "A member is in default if they fail to pay within 7 days of the due date.",
        },
        {
          title: "Default Penalty",
          description: `Defaulting members are charged a ${circle.defaultPenalty}% penalty on the missed contribution.`,
        },
        {
          title: "Member Replacement",
          description: "Defaulting members may be replaced by new members approved by the Elder.",
        },
        {
          title: "Platform Backstop",
          description: "In case of defaults, the platform may cover the shortfall to protect other members.",
        },
      ],
    },
    {
      id: "payout",
      title: "Payout Rules",
      icon: Calendar,
      color: "#0A2342",
      rules: [
        {
          title: "Payout Amount",
          description: `Each recipient receives the full pool of $${circle.totalPool} (${circle.maxMembers} × $${circle.contribution}).`,
        },
        {
          title: "Payout Order",
          description: "Payout order is determined by XnScore at circle start. Higher scores get earlier positions.",
        },
        {
          title: "Payout Schedule",
          description: `Payouts occur ${circle.frequency} after all contributions are received.`,
        },
        {
          title: "Payout Method",
          description: "Funds are deposited to your linked bank account or wallet within 1-2 business days.",
        },
      ],
    },
    {
      id: "elder",
      title: "Elder Oversight",
      icon: Award,
      color: "#00C6AE",
      rules: [
        {
          title: "Circle Elder",
          description: `${circle.elder.name} serves as the Elder for this circle.`,
        },
        {
          title: "Elder Responsibilities",
          description: circle.elder.responsibilities.join(". ") + ".",
        },
        {
          title: "Dispute Resolution",
          description: "The Elder mediates any disputes between members with final decisions within 48 hours.",
        },
        {
          title: "Elder Accountability",
          description: "Elders are held to higher standards and can be removed for misconduct.",
        },
      ],
    },
    {
      id: "membership",
      title: "Membership Rules",
      icon: Users,
      color: "#00C6AE",
      rules: [
        {
          title: "Minimum XnScore",
          description: `New members must have an XnScore of at least ${circle.minScore} to join.`,
        },
        {
          title: "Leaving the Circle",
          description:
            "Members who have received their payout must complete all remaining contributions before leaving.",
        },
        {
          title: "Early Exit",
          description: "Members who haven't received payout may leave but forfeit contributions made.",
        },
        {
          title: "Behavior Standards",
          description: "All members must treat each other with respect. Harassment results in removal.",
        },
      ],
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Header - Navy Gradient */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
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
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <div>
            <h1 style={{ margin: "0 0 2px 0", fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Circle Rules</h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{circle.name}</p>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div
        style={{
          margin: "20px",
          background: "linear-gradient(135deg, #0A2342 0%, #1A3A5A 100%)",
          borderRadius: "16px",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <FileText size={20} color="#00C6AE" />
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Key Terms Summary</h3>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "11px", opacity: 0.7 }}>Contribution</p>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
              ${circle.contribution}/{circle.frequency === "monthly" ? "mo" : "2wk"}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "11px", opacity: 0.7 }}>Pool Size</p>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>${circle.totalPool}</p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "11px", opacity: 0.7 }}>Grace Period</p>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{circle.gracePeriod} days</p>
          </div>
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "11px", opacity: 0.7 }}>Late Penalty</p>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{circle.latePenalty}%</p>
          </div>
        </div>
      </div>

      {/* Rules Accordion */}
      <div style={{ padding: "0 20px" }}>
        {sections.map((section) => {
          const Icon = section.icon
          const isExpanded = expandedSection === section.id

          return (
            <div
              key={section.id}
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                marginBottom: "12px",
                border: "1px solid #E0E0E0",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setExpandedSection(isExpanded ? "" : section.id)}
                style={{
                  width: "100%",
                  padding: "16px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: `${section.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} color={section.color} />
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#0A2342",
                  }}
                >
                  {section.title}
                </span>
                {isExpanded ? <ChevronUp size={20} color="#999" /> : <ChevronDown size={20} color="#999" />}
              </button>

              {isExpanded && (
                <div
                  style={{
                    padding: "0 16px 16px 68px",
                    borderTop: "1px solid #F5F7FA",
                  }}
                >
                  {section.rules.map((rule, idx) => (
                    <div
                      key={idx}
                      style={{
                        paddingTop: "16px",
                        borderTop: idx > 0 ? "1px solid #F5F7FA" : "none",
                        marginTop: idx > 0 ? "16px" : 0,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#0A2342",
                        }}
                      >
                        {rule.title}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#666",
                          lineHeight: "1.5",
                        }}
                      >
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Platform Terms */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            gap: "10px",
          }}
        >
          <Info size={18} color="#00897B" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>
              Platform Terms Apply
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#1E3A8A", lineHeight: "1.5" }}>
              These circle rules are in addition to TandaXn's platform Terms of Service and Privacy Policy. All disputes
              are subject to platform mediation.
            </p>
          </div>
        </div>
      </div>

      {/* Agreement Footer */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E0E0E0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "start",
            gap: "12px",
            marginBottom: "16px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{
              width: "20px",
              height: "20px",
              marginTop: "2px",
              accentColor: "#00C6AE",
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: "13px", color: "#444", lineHeight: "1.5" }}>
            I have read and agree to the circle rules, including payment obligations, penalties, and Elder oversight. I
            understand my XnScore affects my payout position.
          </span>
        </label>

        <button
          onClick={() => console.log("Agree and continue")}
          disabled={!agreed}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: agreed ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E0E0E0",
            color: agreed ? "#FFFFFF" : "#999",
            fontSize: "16px",
            fontWeight: "600",
            cursor: agreed ? "pointer" : "not-allowed",
            boxShadow: agreed ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
          }}
        >
          I Agree - Continue to Join
        </button>
      </div>
    </div>
  )
}
