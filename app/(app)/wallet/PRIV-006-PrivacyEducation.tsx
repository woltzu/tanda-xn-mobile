"use client"

import { useState } from "react"

export default function PrivacyEducationScreen() {
  const [expandedTopic, setExpandedTopic] = useState(null)

  const topics = [
    {
      id: "why",
      icon: "🛡️",
      title: "Why Privacy Matters",
      summary: "Protect your financial information from prying eyes",
      content: [
        "Your savings amounts are personal - you choose who knows",
        "Family situations can be complicated - control what relatives see",
        "Avoid unwanted attention from strangers knowing your finances",
        "Protect yourself from potential scammers who target savers",
      ],
    },
    {
      id: "stealth",
      icon: "🥷",
      title: "Stealth Mode Explained",
      summary: "Become completely invisible when you need it",
      content: [
        "You won't appear in member searches",
        "Your activity won't show in public feeds",
        "Profile hidden from people who don't know you",
        "Useful when you need complete discretion",
      ],
      action: { label: "Enable Stealth Mode", setting: "stealth" },
    },
    {
      id: "lowprofile",
      icon: "🕶️",
      title: "Low Profile Mode",
      summary: "Stay visible but hide sensitive details",
      content: [
        "Hide your total savings amount",
        "Hide how many circles you're in",
        "Show initials instead of full name",
        "Perfect for staying connected while being discreet",
      ],
      action: { label: "Configure Low Profile", setting: "lowprofile" },
    },
    {
      id: "contacts",
      icon: "📱",
      title: "Contact Controls",
      summary: "Decide who can reach you",
      content: [
        "Block unwanted messages from strangers",
        "Only allow circle members to contact you",
        "Control who can invite you to circles",
        "Hide your online status and last seen",
      ],
      action: { label: "Manage Contact Privacy", setting: "contacts" },
    },
    {
      id: "notifications",
      icon: "🔔",
      title: "Notification Privacy",
      summary: "Control what appears on your screen",
      content: [
        "Hide payment amounts from lock screen",
        "Show only generic 'New notification' message",
        "Require Face ID to see notification content",
        "Keep sensitive info private from shoulder surfers",
      ],
      action: { label: "Set Notification Privacy", setting: "notifications" },
    },
    {
      id: "data",
      icon: "📊",
      title: "Your Data Rights",
      summary: "What we collect and how to control it",
      content: [
        "We never sell your personal information",
        "You can export all your data anytime",
        "Request deletion of your account and data",
        "We only share what's needed for payments",
      ],
      action: { label: "Manage Your Data", setting: "data" },
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
          padding: "20px 20px 60px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Privacy Guide</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Learn how to protect yourself</p>
          </div>
        </div>

        {/* Hero Message */}
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "48px" }}>🔐</span>
          <p style={{ margin: "12px 0 0 0", fontSize: "14px", opacity: 0.9, lineHeight: 1.6 }}>
            <em>"Tu vies mieux cachée"</em> - Sometimes privacy is power.
            <br />
            Control what others see about your finances.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-30px", padding: "0 20px" }}>
        {/* Topics */}
        {topics.map((topic) => {
          const isExpanded = expandedTopic === topic.id
          return (
            <div
              key={topic.id}
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                marginBottom: "12px",
                border: "1px solid #E5E7EB",
                overflow: "hidden",
              }}
            >
              {/* Topic Header */}
              <button
                onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{topic.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                    {topic.title}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{topic.summary}</p>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #F5F7FA" }}>
                  <ul
                    style={{
                      margin: "12px 0 0 0",
                      paddingLeft: "20px",
                      fontSize: "13px",
                      color: "#6B7280",
                      lineHeight: 1.8,
                    }}
                  >
                    {topic.content.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>

                  {topic.action && (
                    <button
                      onClick={() => console.log("Navigate to:", topic.action.setting)}
                      style={{
                        width: "100%",
                        marginTop: "12px",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#0A2342",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      {topic.action.label}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Quick Setup Card */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "16px",
            padding: "20px",
            marginTop: "8px",
            textAlign: "center",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            🚀 Quick Privacy Setup
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>
            Not sure where to start? Let us help you configure recommended privacy settings.
          </p>
          <button
            onClick={() => console.log("Start wizard")}
            style={{
              padding: "14px 28px",
              borderRadius: "12px",
              border: "none",
              background: "#00C6AE",
              fontSize: "14px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Start Privacy Wizard
          </button>
        </div>

        {/* Contact Support */}
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
              Still have questions?
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Our team is here to help</p>
          </div>
          <button
            onClick={() => console.log("Contact support")}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Contact Us
          </button>
        </div>
      </div>
    </div>
  )
}
