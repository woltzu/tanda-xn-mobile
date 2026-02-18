"use client"

import { useState } from "react"

export default function HelpCenterScreen() {
  const [searchQuery, setSearchQuery] = useState("")

  const categories = [
    { id: "getting-started", icon: "🚀", title: "Getting Started", articles: 8 },
    { id: "circles", icon: "🔄", title: "Savings Circles", articles: 12 },
    { id: "payments", icon: "💳", title: "Payments & Deposits", articles: 10 },
    { id: "transfers", icon: "🌍", title: "International Transfers", articles: 7 },
    { id: "account", icon: "👤", title: "Account & Security", articles: 9 },
    { id: "fees", icon: "💰", title: "Fees & Pricing", articles: 5 },
  ]

  const popularArticles = [
    { id: "a1", title: "How to join a savings circle", category: "Circles" },
    { id: "a2", title: "Understanding XnScore", category: "Account" },
    { id: "a3", title: "Send money to Africa", category: "Transfers" },
    { id: "a4", title: "Withdrawal options explained", category: "Payments" },
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Help Center</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>How can we help you?</p>
          </div>
        </div>

        {/* Search Bar */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ padding: "10px 12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 12px 12px 0",
              border: "none",
              fontSize: "14px",
              color: "#FFFFFF",
              background: "transparent",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-30px", padding: "0 20px" }}>
        {/* Categories Grid */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Browse by Topic
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => console.log("Select category:", cat.id)}
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>{cat.icon}</span>
                <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  {cat.title}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{cat.articles} articles</p>
              </button>
            ))}
          </div>
        </div>

        {/* Popular Articles */}
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
            Popular Articles
          </h3>
          {popularArticles.map((article, idx) => (
            <button
              key={article.id}
              onClick={() => console.log("Select article:", article.id)}
              style={{
                width: "100%",
                padding: "12px 0",
                background: "none",
                border: "none",
                borderBottom: idx < popularArticles.length - 1 ? "1px solid #F5F7FA" : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "left",
              }}
            >
              <div>
                <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                  {article.title}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{article.category}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        {/* Contact Support */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}>💬</span>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            Still need help?
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>Our support team is available 24/7</p>
          <button
            onClick={() => console.log("Contact support")}
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "none",
              background: "#00C6AE",
              fontSize: "14px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  )
}
