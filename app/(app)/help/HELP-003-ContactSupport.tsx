"use client"

import { useState } from "react"

export default function ContactSupportScreen() {
  const [selectedTopic, setSelectedTopic] = useState(null)

  const topics = [
    { id: "circles", label: "Savings Circles", icon: "🔄" },
    { id: "payments", label: "Payments Issue", icon: "💳" },
    { id: "transfers", label: "International Transfer", icon: "🌍" },
    { id: "account", label: "Account Access", icon: "👤" },
    { id: "other", label: "Other", icon: "📋" },
  ]

  const contactMethods = [
    {
      id: "chat",
      icon: "💬",
      title: "Live Chat",
      description: "Chat with an agent now",
      availability: "Available 24/7",
      primary: true,
    },
    {
      id: "call",
      icon: "📞",
      title: "Phone Support",
      description: "+1 (800) 555-TANDA",
      availability: "Mon-Fri 9AM-6PM EST",
      primary: false,
    },
    {
      id: "email",
      icon: "✉️",
      title: "Email Us",
      description: "support@tandaxn.com",
      availability: "Response within 24 hours",
      primary: false,
    },
    {
      id: "schedule",
      icon: "📅",
      title: "Schedule a Call",
      description: "Book a callback time",
      availability: "Next available: Tomorrow",
      primary: false,
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Contact Support</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>We're here to help</p>
          </div>
        </div>

        {/* Response Time Banner */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "10px",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "18px" }}>⚡</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600" }}>Average response time</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Under 2 minutes for live chat</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-30px", padding: "0 20px" }}>
        {/* Select Topic */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What do you need help with?
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic.id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "20px",
                  border: selectedTopic === topic.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: selectedTopic === topic.id ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: selectedTopic === topic.id ? "#00897B" : "#6B7280",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{topic.icon}</span>
                {topic.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact Methods */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            How would you like to reach us?
          </h3>

          {contactMethods.map((method, idx) => (
            <button
              key={method.id}
              onClick={() => console.log(`${method.title} clicked`)}
              style={{
                width: "100%",
                padding: "16px",
                marginBottom: idx < contactMethods.length - 1 ? "10px" : 0,
                background: method.primary ? "#F0FDFB" : "#F5F7FA",
                borderRadius: "12px",
                border: method.primary ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: method.primary ? "#00C6AE" : "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                }}
              >
                {method.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  {method.title}
                  {method.primary && (
                    <span
                      style={{
                        marginLeft: "8px",
                        padding: "2px 6px",
                        background: "#00C6AE",
                        color: "#FFFFFF",
                        fontSize: "9px",
                        fontWeight: "700",
                        borderRadius: "4px",
                      }}
                    >
                      FASTEST
                    </span>
                  )}
                </p>
                <p style={{ margin: "0 0 2px 0", fontSize: "13px", color: "#6B7280" }}>{method.description}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{method.availability}</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
