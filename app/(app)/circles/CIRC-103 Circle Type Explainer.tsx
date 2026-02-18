"use client"
import { useState } from "react"
import {
  ArrowLeft,
  Users,
  Briefcase,
  Heart,
  Globe,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Calendar,
  TrendingUp,
  CheckCircle,
} from "lucide-react"

export default function CircleTypeExplainer() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const circleTypes = [
    {
      id: "family",
      icon: Heart,
      name: "Family Circles",
      color: "#3B82F6",
      bgColor: "#DBEAFE",
      description: "Perfect for relatives pooling resources to support each other or send money back home.",
      features: [
        "Trusted family members only",
        "Flexible contribution schedules",
        "Great for diaspora remittances",
        "Elder oversight recommended",
      ],
      idealFor: "Families, relatives, close-knit groups",
    },
    {
      id: "work",
      icon: Briefcase,
      name: "Work Circles",
      color: "#10B981",
      bgColor: "#D1FAE5",
      description: "Colleagues and professionals saving together with structured schedules.",
      features: [
        "Verified workplace groups",
        "Higher contribution limits",
        "Strict payment schedules",
        "Professional accountability",
      ],
      idealFor: "Coworkers, professional networks, industry groups",
    },
    {
      id: "community",
      icon: Globe,
      name: "Community Circles",
      color: "#F59E0B",
      bgColor: "#FEF3C7",
      description: "Local or cultural communities saving together for shared goals.",
      features: [
        "Open to community members",
        "Cultural traditions respected",
        "Local meetup options",
        "Community elder facilitation",
      ],
      idealFor: "Neighborhood groups, cultural associations, religious communities",
    },
    {
      id: "friends",
      icon: Users,
      name: "Friends Circles",
      color: "#8B5CF6",
      bgColor: "#EDE9FE",
      description: "Casual savings groups among trusted friends.",
      features: ["Invite-only membership", "Flexible rules", "Social accountability", "Fun and supportive"],
      idealFor: "Friend groups, social clubs, hobby groups",
    },
  ]

  const faqs = [
    {
      question: "How does the payout order work?",
      answer:
        "Members take turns receiving the full pool. The order is determined by XnScore (our trust rating), with higher scores getting earlier positions. This ensures the most reliable members get priority while everyone gets their turn.",
    },
    {
      question: "What happens if someone misses a payment?",
      answer:
        "There's typically a 2-day grace period. After that, a 10% penalty may apply. If a member defaults, the circle Elder helps mediate. In some cases, another member can cover the payment temporarily. The platform also has a backstop fund for emergencies.",
    },
    {
      question: "How is my position in the payout order determined?",
      answer:
        "Your XnScore determines your position. It's calculated based on payment history, tenure, contribution amounts, and community standing. Higher scores = earlier payouts. You can improve your score by paying on time consistently.",
    },
    {
      question: "Can I leave a circle early?",
      answer:
        "Yes, but there may be consequences depending on when you leave. If you've already received a payout, you must fulfill your remaining contribution obligations. Leaving early without completing obligations will negatively impact your XnScore.",
    },
    {
      question: "What is a Circle Elder?",
      answer:
        "An Elder is a trusted community member who oversees the circle, mediates disputes, and ensures fair operation. They have high XnScores and experience running multiple successful circles. You can choose your Elder when creating a circle.",
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
          background: "linear-gradient(135deg, #0A2342 0%, #1A3A5A 100%)",
          padding: "20px 20px 60px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </button>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>How Circles Work</h1>
        </div>

        {/* Hero Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "rgba(0, 198, 174, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <Users size={28} color="#00C6AE" />
          </div>
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "20px",
              fontWeight: "700",
            }}
          >
            What is a Savings Circle?
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              lineHeight: "1.6",
              opacity: 0.9,
            }}
          >
            A savings circle (also called Tanda, Chit, or ROSCA) is a group of people who contribute money regularly and
            take turns receiving the pool. It's a time-tested tradition used by communities worldwide to save and
            support each other.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div
        style={{
          margin: "-40px 20px 20px 20px",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "700",
            color: "#0A2342",
          }}
        >
          How It Works
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            {
              step: 1,
              icon: Users,
              title: "Join or Create",
              desc: "Find a circle that fits your goals or create your own",
            },
            {
              step: 2,
              icon: DollarSign,
              title: "Contribute Regularly",
              desc: "Make your agreed contribution on schedule",
            },
            {
              step: 3,
              icon: Calendar,
              title: "Wait Your Turn",
              desc: "Your XnScore determines your payout position",
            },
            {
              step: 4,
              icon: TrendingUp,
              title: "Receive Your Payout",
              desc: "Get the full pool when it's your turn",
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.step} style={{ display: "flex", alignItems: "start", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "#F0FDFB",
                    border: "2px solid #00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "#00C6AE",
                    }}
                  >
                    {item.step}
                  </span>
                </div>
                <div>
                  <p
                    style={{
                      margin: "0 0 2px 0",
                      fontSize: "15px",
                      fontWeight: "600",
                      color: "#0A2342",
                    }}
                  >
                    {item.title}
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Circle Types */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "700",
            color: "#0A2342",
          }}
        >
          Circle Types
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {circleTypes.map((type) => {
            const Icon = type.icon
            return (
              <div
                key={type.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  border: "1px solid #E0E0E0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: type.bgColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={22} color={type.color} />
                  </div>
                  <div>
                    <h4
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "16px",
                        fontWeight: "700",
                        color: "#0A2342",
                      }}
                    >
                      {type.name}
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#666",
                        lineHeight: "1.4",
                      }}
                    >
                      {type.description}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: "#F5F7FA",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {type.features.map((feature, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <CheckCircle size={12} color="#10B981" />
                        <span style={{ fontSize: "12px", color: "#444" }}>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                  <span style={{ fontWeight: "600" }}>Ideal for:</span> {type.idealFor}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* FAQs */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "700",
            color: "#0A2342",
          }}
        >
          Frequently Asked Questions
        </h3>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid #E0E0E0",
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
                  borderBottom: idx < faqs.length - 1 ? "1px solid #F5F7FA" : "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <HelpCircle size={18} color="#00C6AE" />
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#0A2342",
                    }}
                  >
                    {faq.question}
                  </span>
                </div>
                {expandedFaq === idx ? <ChevronUp size={18} color="#999" /> : <ChevronDown size={18} color="#999" />}
              </button>

              {expandedFaq === idx && (
                <div
                  style={{
                    padding: "0 16px 16px 44px",
                    background: "#F5F7FA",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#444",
                      lineHeight: "1.6",
                    }}
                  >
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <button
          onClick={() => console.log("Browse Circles")}
          style={{
            width: "100%",
            padding: "16px",
            background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "14px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0, 198, 174, 0.3)",
          }}
        >
          Browse Circles
        </button>
      </div>
    </div>
  )
}
