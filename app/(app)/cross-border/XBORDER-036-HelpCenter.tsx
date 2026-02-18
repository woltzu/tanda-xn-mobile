"use client"

import { useState } from "react"

export default function HelpCenterScreen() {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const faqs = [
    {
      id: 1,
      category: "Sending",
      question: "How long does a transfer take?",
      answer:
        "Most mobile money transfers arrive within seconds. Bank transfers may take 1-2 business days depending on the destination country.",
    },
    {
      id: 2,
      category: "Sending",
      question: "What's the maximum I can send?",
      answer:
        "Limits depend on your verification level. Basic users can send up to $2,000 per transfer. Verify your identity to increase limits up to $10,000 per transfer.",
    },
    {
      id: 3,
      category: "Fees",
      question: "What are the fees?",
      answer:
        "We charge a flat fee starting at $2.99 per transfer, with no hidden markups on exchange rates. The exact fee depends on the amount and destination.",
    },
    {
      id: 4,
      category: "Fees",
      question: "Is the exchange rate good?",
      answer:
        "We use the real mid-market rate with no hidden markup. You can compare our rates to competitors right in the app.",
    },
    {
      id: 5,
      category: "Delivery",
      question: "What if my transfer fails?",
      answer:
        "If a transfer fails, your money is automatically returned to your wallet. We'll notify you immediately with options to retry or contact support.",
    },
    {
      id: 6,
      category: "Delivery",
      question: "How does cash pickup work?",
      answer:
        "We'll provide a pickup code that you share with your recipient. They take this code and valid ID to our partner agent location to collect the cash.",
    },
  ]

  const filteredFaqs = searchQuery
    ? faqs.filter(
        (f) =>
          f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : faqs

  const handleBack = () => console.log("Back")
  const handleContactSupport = () => console.log("Contact support")
  const handleChatNow = () => console.log("Chat now")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <button
            onClick={handleBack}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Help Center</h1>
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: "15px",
              color: "#FFFFFF",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <button
            onClick={handleChatNow}
            style={{
              flex: 1,
              padding: "16px",
              background: "#00C6AE",
              borderRadius: "14px",
              border: "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>💬</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>Chat Now</span>
          </button>
          <button
            onClick={handleContactSupport}
            style={{
              flex: 1,
              padding: "16px",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>📧</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Email Us</span>
          </button>
        </div>

        {/* FAQs */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
          Frequently Asked Questions
        </h3>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => (
              <div key={faq.id}>
                <button
                  onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    background: "#FFFFFF",
                    border: "none",
                    borderBottom: idx < filteredFaqs.length - 1 || expandedId === faq.id ? "1px solid #F5F7FA" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <span
                      style={{
                        padding: "2px 6px",
                        background: "#F5F7FA",
                        borderRadius: "4px",
                        fontSize: "9px",
                        fontWeight: "600",
                        color: "#6B7280",
                        marginRight: "8px",
                      }}
                    >
                      {faq.category}
                    </span>
                    <p style={{ margin: "6px 0 0 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                      {faq.question}
                    </p>
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280"
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
                      padding: "0 16px 14px 16px",
                      background: "#FFFFFF",
                      borderBottom: idx < filteredFaqs.length - 1 ? "1px solid #F5F7FA" : "none",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: 1.6 }}>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No results for "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Still Need Help */}
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            background: "#0A2342",
            borderRadius: "14px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
            Still need help?
          </p>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
            Our support team is available 24/7
          </p>
          <button
            onClick={handleChatNow}
            style={{
              padding: "12px 24px",
              background: "#00C6AE",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Start Live Chat
          </button>
        </div>
      </div>
    </div>
  )
}
