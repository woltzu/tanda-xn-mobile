"use client"

import { useState } from "react"

export default function HelpCenterScreen() {
  const [searchQuery, setSearchQuery] = useState("")

  const faqCategories = [
    { id: "getting_started", icon: "🚀", title: "Getting Started", count: 8 },
    { id: "payments", icon: "💳", title: "Payments & Deposits", count: 12 },
    { id: "circles", icon: "👥", title: "Savings Circles", count: 15 },
    { id: "payouts", icon: "💰", title: "Payouts & Withdrawals", count: 10 },
    { id: "xnscore", icon: "📊", title: "XnScore & Credit", count: 6 },
    { id: "security", icon: "🔒", title: "Security & Privacy", count: 9 },
    { id: "cross_border", icon: "🌍", title: "Sending Money Home", count: 11 },
  ]

  const popularArticles = [
    { id: "a1", title: "How do savings circles work?", views: "2.4k" },
    { id: "a2", title: "When will I receive my payout?", views: "1.8k" },
    { id: "a3", title: "How is my XnScore calculated?", views: "1.5k" },
    { id: "a4", title: "What fees does TandaXn charge?", views: "1.2k" },
  ]

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSearch = () => {
    console.log("Search:", searchQuery)
  }

  const handleSelectCategory = (category: any) => {
    console.log("Select category:", category)
  }

  const handleSelectArticle = (article: any) => {
    console.log("Select article:", article)
  }

  const handleContactSupport = () => {
    console.log("Contact support")
  }

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
          padding: "20px 20px 70px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Help Center</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>How can we help you?</p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help..."
            style={{
              width: "100%",
              padding: "14px 14px 14px 48px",
              borderRadius: "12px",
              border: "none",
              background: "rgba(255,255,255,0.15)",
              fontSize: "15px",
              color: "#FFFFFF",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="2"
            style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-30px", padding: "0 20px" }}>
        {/* Quick Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={handleContactSupport}
            style={{
              flex: 1,
              padding: "14px",
              background: "#F0FDFB",
              borderRadius: "12px",
              border: "1px solid #00C6AE",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px auto",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Chat with Us</p>
          </button>
          <button
            onClick={() => handleSelectCategory({ id: "getting_started" })}
            style={{
              flex: 1,
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px auto",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>FAQs</p>
          </button>
        </div>

        {/* Popular Articles */}
        <div style={{ marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Popular Articles
          </h3>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            {popularArticles.map((article, idx) => (
              <button
                key={article.id}
                onClick={() => handleSelectArticle(article)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "#FFFFFF",
                  border: "none",
                  borderBottom: idx < popularArticles.length - 1 ? "1px solid #F5F7FA" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span style={{ flex: 1, fontSize: "14px", color: "#0A2342", textAlign: "left" }}>{article.title}</span>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>{article.views} views</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Browse by Topic
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {faqCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleSelectCategory(category)}
                style={{
                  padding: "16px",
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  border: "1px solid #E5E7EB",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>{category.icon}</span>
                <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  {category.title}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{category.count} articles</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
