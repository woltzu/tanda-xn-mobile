"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Search,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  DollarSign,
  Users,
  Shield,
  Calendar,
  TrendingUp,
  X,
} from "lucide-react"

export default function CircleFAQScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategory, setExpandedCategory] = useState("Payments")
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)

  const circle = {
    name: "Diaspora Family Fund",
    contribution: 200,
    frequency: "monthly",
  }

  const faqs = [
    {
      category: "Payments",
      icon: DollarSign,
      color: "#00C6AE",
      questions: [
        {
          q: "How do I make my contribution?",
          a: "You can pay via your linked bank account, debit card, or wallet balance. Go to the circle home, tap 'Pay Now', and follow the prompts. You can also enable auto-pay for automatic payments.",
        },
        {
          q: "What if I can't pay on time?",
          a: "Contact the Elder before the due date if you're having trouble. There's a 2-day grace period, but late payments affect your XnScore. If you need more time, the Elder may be able to arrange an extension.",
        },
        {
          q: "Can I pay more than my contribution amount?",
          a: "No, all members contribute the same fixed amount. This ensures fairness in the pool distribution. If you want to save more, consider joining additional circles or using Goals.",
        },
        {
          q: "What payment methods are accepted?",
          a: "We accept bank transfers (ACH), debit cards, and wallet balance. Credit cards are not currently supported to prevent debt accumulation.",
        },
      ],
    },
    {
      category: "Payouts",
      icon: Calendar,
      color: "#0A2342",
      questions: [
        {
          q: "How is payout order determined?",
          a: "Payout order is based on XnScore at the start of the circle. Members with higher scores get earlier positions. This rewards reliable payment history.",
        },
        {
          q: "When will I receive my payout?",
          a: "Your payout is scheduled based on your position. Once all contributions are collected for your cycle, funds are deposited within 1-2 business days.",
        },
        {
          q: "Can I change my payout position?",
          a: "Positions can only be swapped with another member's agreement and Elder approval. There may be fees involved depending on timing.",
        },
        {
          q: "What if I need money before my turn?",
          a: "You can request an emergency swap through the Elder, or apply for a TandaXn loan if eligible. Regular position changes are not allowed.",
        },
      ],
    },
    {
      category: "Membership",
      icon: Users,
      color: "#00C6AE",
      questions: [
        {
          q: "Can I leave the circle early?",
          a: "If you haven't received your payout, you may leave but forfeit contributions made. If you've received your payout, you must complete all remaining contributions before leaving.",
        },
        {
          q: "What happens if a member leaves?",
          a: "The Elder will work to find a replacement member. The platform backstop ensures remaining members aren't affected by departures.",
        },
        {
          q: "Can I invite friends to join?",
          a: "Yes! Tap 'Invite Members' if spots are available. New members must meet the minimum XnScore requirement and be approved by the Elder.",
        },
        {
          q: "How many circles can I join?",
          a: "You can join multiple circles as long as your total contribution obligations don't exceed your verified income limits. Higher XnScores allow more circles.",
        },
      ],
    },
    {
      category: "Trust & Safety",
      icon: Shield,
      color: "#F59E0B",
      questions: [
        {
          q: "What if someone doesn't pay?",
          a: "Defaulting members face penalties and XnScore reduction. The platform has a backstop fund to cover shortfalls, protecting other members. Persistent defaulters are removed.",
        },
        {
          q: "How do I report a problem?",
          a: "Contact the Elder first for circle-specific issues. For serious concerns, use the 'Report' option in settings or contact TandaXn support directly.",
        },
        {
          q: "Is my money safe?",
          a: "Yes. Funds are held with licensed payment partners. The platform maintains a liquidity buffer and backstop fund to protect against defaults.",
        },
        {
          q: "What does the Elder do?",
          a: "The Elder mediates disputes, approves new members, manages emergencies, and ensures the circle runs smoothly. They have high XnScores and are accountable to the platform.",
        },
      ],
    },
    {
      category: "XnScore",
      icon: TrendingUp,
      color: "#00C6AE",
      questions: [
        {
          q: "How does my XnScore affect this circle?",
          a: "Your XnScore determined your initial payout position. Higher scores got earlier positions. Maintaining good payment history keeps your score high for future circles.",
        },
        {
          q: "What happens if my score drops?",
          a: "Score drops don't affect your current position, but they impact your eligibility and position in future circles. Focus on paying on time to rebuild.",
        },
        {
          q: "Can I improve my position with a higher score?",
          a: "Position is locked at circle start. However, better scores in future circles will give you better starting positions.",
        },
      ],
    },
  ]

  const filteredFaqs = searchQuery
    ? faqs
        .map((cat) => ({
          ...cat,
          questions: cat.questions.filter(
            (q) =>
              q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
              q.a.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
        }))
        .filter((cat) => cat.questions.length > 0)
    : faqs

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
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
            marginBottom: "16px",
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
            <h1 style={{ margin: "0 0 2px 0", fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Circle FAQ</h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{circle.name}</p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search
            size={18}
            color="#6B7280"
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px 12px 44px",
              borderRadius: "12px",
              border: "none",
              background: "#FFFFFF",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "#E0E0E0",
                border: "none",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={12} color="#666" />
            </button>
          )}
        </div>
      </div>

      {/* FAQ Categories */}
      {!searchQuery && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "16px 20px",
            overflowX: "auto",
          }}
        >
          {faqs.map((cat) => {
            const Icon = cat.icon
            const isActive = expandedCategory === cat.category
            return (
              <button
                key={cat.category}
                onClick={() => setExpandedCategory(cat.category)}
                style={{
                  background: isActive ? "#0A2342" : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "#666",
                  border: isActive ? "none" : "1px solid #E0E0E0",
                  borderRadius: "20px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Icon size={14} />
                {cat.category}
              </button>
            )
          })}
        </div>
      )}

      {/* FAQ List */}
      <div style={{ padding: "0 20px" }}>
        {filteredFaqs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
            }}
          >
            <HelpCircle size={48} color="#999" style={{ marginBottom: "16px" }} />
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#0A2342" }}>No questions found</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Try a different search or contact support</p>
          </div>
        ) : (
          filteredFaqs.map((category) => {
            const Icon = category.icon
            const isExpanded = searchQuery || expandedCategory === category.category

            if (!isExpanded && !searchQuery) return null

            return (
              <div key={category.category} style={{ marginBottom: "24px" }}>
                {searchQuery && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        background: `${category.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={14} color={category.color} />
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{category.category}</span>
                  </div>
                )}

                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "14px",
                    overflow: "hidden",
                    border: "1px solid #E0E0E0",
                  }}
                >
                  {category.questions.map((faq, idx) => {
                    const questionKey = `${category.category}-${idx}`
                    const isOpen = expandedQuestion === questionKey

                    return (
                      <div key={idx}>
                        <button
                          onClick={() => setExpandedQuestion(isOpen ? null : questionKey)}
                          style={{
                            width: "100%",
                            padding: "16px",
                            border: "none",
                            borderBottom: idx < category.questions.length - 1 && !isOpen ? "1px solid #F5F7FA" : "none",
                            background: isOpen ? "#F5F7FA" : "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            alignItems: "start",
                            gap: "12px",
                          }}
                        >
                          <HelpCircle size={18} color={category.color} style={{ flexShrink: 0, marginTop: "2px" }} />
                          <span
                            style={{
                              flex: 1,
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#0A2342",
                              lineHeight: "1.4",
                            }}
                          >
                            {faq.q}
                          </span>
                          {isOpen ? <ChevronUp size={18} color="#999" /> : <ChevronDown size={18} color="#999" />}
                        </button>

                        {isOpen && (
                          <div
                            style={{
                              padding: "0 16px 16px 46px",
                              background: "#F5F7FA",
                              borderBottom: idx < category.questions.length - 1 ? "1px solid #E0E0E0" : "none",
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
                              {faq.a}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Contact Support */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E0E0E0",
        }}
      >
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#00C6AE20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MessageCircle size={22} color="#00C6AE" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Still have questions?
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>Our support team is here to help</p>
          </div>
          <button
            onClick={() => console.log("Contact support")}
            style={{
              padding: "10px 20px",
              background: "#00C6AE",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Contact
          </button>
        </div>
      </div>
    </div>
  )
}
