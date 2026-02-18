"use client"

import { useState } from "react"

export default function FAQListScreen() {
  const [expandedId, setExpandedId] = useState(null)

  const category = "General"
  const faqs = [
    {
      id: "f1",
      question: "What is TandaXn?",
      answer:
        "TandaXn is a digital platform that modernizes traditional rotating savings circles (tandas/ROSCAs). We help communities save together, track contributions, and send money home to family in Africa and beyond.",
    },
    {
      id: "f2",
      question: "How do savings circles work?",
      answer:
        "In a savings circle, a group of members contribute a fixed amount regularly. Each round, one member receives the full pot. This continues until everyone has received a payout. It's a proven savings method used worldwide.",
    },
    {
      id: "f3",
      question: "Is my money safe with TandaXn?",
      answer:
        "Yes. Your funds are held with licensed banking partners and protected by industry-standard security. We use bank-level encryption, multi-factor authentication, and regular security audits to protect your money and data.",
    },
    {
      id: "f4",
      question: "What is XnScore?",
      answer:
        "XnScore is your financial trust score on TandaXn (0-100). It's based on payment history (40%), circle completion (30%), account tenure (20%), and contribution diversity (10%). Higher scores unlock better benefits.",
    },
    {
      id: "f5",
      question: "What fees does TandaXn charge?",
      answer:
        "We charge a small platform fee on circle payouts (2-3%) and competitive rates on international transfers. There are no monthly fees or hidden charges. All fees are shown before you confirm any transaction.",
    },
    {
      id: "f6",
      question: "How do I send money internationally?",
      answer:
        "Go to 'Send Money Home', select a recipient or country, enter the amount, and confirm. We support Mobile Money (MTN, Orange, M-Pesa), bank transfers, and cash pickup in most African countries.",
    },
    {
      id: "f7",
      question: "What happens if a member doesn't pay?",
      answer:
        "Late contributions incur a penalty (typically 5%). There's a grace period of 2-3 days. If defaults continue, the member's XnScore decreases and they may be removed from circles. The circle is protected through our guarantee fund.",
    },
    {
      id: "f8",
      question: "Can I withdraw early from a circle?",
      answer:
        "Early withdrawal is possible in most circles but may incur a fee (typically 10%) to protect other members. Check your specific circle's terms. Personal savings can be withdrawn anytime with no penalty from flexible accounts.",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>FAQ</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {category} • {faqs.length} questions
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {faqs.map((faq, idx) => (
            <div key={faq.id}>
              <button
                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: expandedId === faq.id ? "#F0FDFB" : "#FFFFFF",
                  border: "none",
                  borderBottom: idx < faqs.length - 1 && expandedId !== faq.id ? "1px solid #F5F7FA" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: expandedId === faq.id ? "#00C6AE" : "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: expandedId === faq.id ? "#FFFFFF" : "#6B7280",
                    flexShrink: 0,
                  }}
                >
                  ?
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#0A2342",
                    lineHeight: 1.4,
                  }}
                >
                  {faq.question}
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={expandedId === faq.id ? "#00C6AE" : "#9CA3AF"}
                  strokeWidth="2"
                  style={{
                    transform: expandedId === faq.id ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {expandedId === faq.id && (
                <div
                  style={{
                    padding: "0 16px 16px 52px",
                    background: "#F0FDFB",
                    borderBottom: idx < faqs.length - 1 ? "1px solid #E5E7EB" : "none",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "#374151",
                      lineHeight: 1.7,
                    }}
                  >
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Prompt */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
              Didn't find your answer?
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Our team is ready to help</p>
          </div>
          <button
            onClick={() => console.log("Ask support")}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: "#00C6AE",
              fontSize: "12px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Ask Us
          </button>
        </div>
      </div>
    </div>
  )
}
