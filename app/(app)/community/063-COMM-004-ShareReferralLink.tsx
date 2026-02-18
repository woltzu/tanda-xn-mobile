"use client"

import { useState } from "react"

export default function ShareReferralLinkScreen() {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("qr")

  const referralCode = "FRANCK2024"
  const referralLink = "https://tandaxn.com/join/FRANCK2024"
  const rewardAmount = 25

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleCopy = () => {
    console.log("Copy link clicked")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareVia = (platformId: string) => {
    console.log("Share via:", platformId)
  }

  const shareMessage = `Join TandaXn and save together with me! Use my code ${referralCode} to get $10 bonus. ${referralLink}`

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "20px",
          borderBottom: "1px solid #E5E7EB",
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
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              margin: "-8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>Share Your Code</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Tabs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "20px",
            display: "flex",
            gap: "4px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => setActiveTab("qr")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "qr" ? "#0A2342" : "transparent",
              color: activeTab === "qr" ? "#FFFFFF" : "#6B7280",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            QR Code
          </button>
          <button
            onClick={() => setActiveTab("link")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === "link" ? "#0A2342" : "transparent",
              color: activeTab === "link" ? "#FFFFFF" : "#6B7280",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Link
          </button>
        </div>

        {/* QR Code Tab */}
        {activeTab === "qr" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Let friends scan this code to join
            </p>

            {/* QR Code Placeholder */}
            <div
              style={{
                width: "200px",
                height: "200px",
                background: "#FFFFFF",
                border: "2px solid #0A2342",
                borderRadius: "16px",
                margin: "0 auto 20px auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {/* Simulated QR Code */}
              <div
                style={{
                  width: "160px",
                  height: "160px",
                  background: `
                  repeating-linear-gradient(
                    0deg,
                    #0A2342,
                    #0A2342 8px,
                    #FFFFFF 8px,
                    #FFFFFF 16px
                  )
                `,
                  opacity: 0.8,
                }}
              />
              {/* Center Logo */}
              <div
                style={{
                  position: "absolute",
                  width: "50px",
                  height: "50px",
                  borderRadius: "10px",
                  background: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                <span style={{ fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>Xn</span>
              </div>
            </div>

            {/* Code Display */}
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Your Code</p>
              <p
                style={{
                  margin: 0,
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#0A2342",
                  letterSpacing: "3px",
                }}
              >
                {referralCode}
              </p>
            </div>

            {/* Save QR Button */}
            <button
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save QR Code
            </button>
          </div>
        )}

        {/* Link Tab */}
        {activeTab === "link" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid #E5E7EB",
            }}
          >
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#6B7280" }}>Share your personal link</p>

            {/* Link Box */}
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#0A2342",
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {referralLink}
              </p>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: copied ? "#0A2342" : "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                color: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginBottom: "20px",
              }}
            >
              {copied ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>

            {/* Message Preview */}
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>
                Share Message:
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#0A2342", lineHeight: 1.5 }}>{shareMessage}</p>
            </div>
          </div>
        )}

        {/* Reward Info */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginTop: "20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            🎁
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
              You get ${rewardAmount} for each friend
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
              They get $10 signup bonus
            </p>
          </div>
        </div>

        {/* Share Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          {[
            { id: "whatsapp", icon: "💬", label: "WhatsApp" },
            { id: "sms", icon: "📱", label: "SMS" },
            { id: "email", icon: "✉️", label: "Email" },
            { id: "more", icon: "•••", label: "More" },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => handleShareVia(option.id)}
              style={{
                background: "#FFFFFF",
                borderRadius: "12px",
                padding: "14px 8px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "24px" }}>{option.icon}</span>
              <span style={{ fontSize: "11px", color: "#6B7280", fontWeight: "500" }}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
