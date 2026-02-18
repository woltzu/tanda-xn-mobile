"use client"

import { useState } from "react"

export default function InviteToCircle() {
  const circle = {
    name: "Family Savings",
    inviteCode: "FAMILY2025",
    inviteLink: "https://tandaxn.com/join/FAMILY2025",
    size: 6,
    currentMembers: 4,
  }

  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (type: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
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
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Invite Members</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle.name}</p>
          </div>
        </div>

        {/* Circle Stats */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
            }}
          >
            👥
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>{circle.currentMembers} members</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              No limit - invite as many as you want!
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Invite Code */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Circle Invite Code</p>
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "32px",
              fontWeight: "700",
              color: "#0A2342",
              letterSpacing: "4px",
            }}
          >
            {circle.inviteCode}
          </p>
          <button
            onClick={() => handleCopy("code", circle.inviteCode)}
            style={{
              padding: "12px 24px",
              background: copied === "code" ? "#00C6AE" : "#F5F7FA",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {copied === "code" ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Copied!</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Invite Link */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Invite Link</p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#6B7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {circle.inviteLink}
            </div>
            <button
              onClick={() => handleCopy("link", circle.inviteLink)}
              style={{
                padding: "12px 16px",
                background: copied === "link" ? "#00C6AE" : "#0A2342",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              {copied === "link" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Share Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Share Via</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => console.log("Share WhatsApp")}
              style={{
                flex: 1,
                padding: "14px",
                background: "#25D366",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "24px" }}>💬</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#FFFFFF" }}>WhatsApp</span>
            </button>
            <button
              onClick={() => console.log("Share SMS")}
              style={{
                flex: 1,
                padding: "14px",
                background: "#0A2342",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "24px" }}>📱</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#FFFFFF" }}>SMS</span>
            </button>
            <button
              onClick={() => console.log("Share Email")}
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "24px" }}>✉️</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#0A2342" }}>Email</span>
            </button>
          </div>
        </div>

        {/* Invite from Contacts */}
        <button
          onClick={() => console.log("Invite from contacts")}
          style={{
            width: "100%",
            padding: "16px",
            background: "#00C6AE",
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          <span style={{ fontSize: "16px", fontWeight: "600", color: "#FFFFFF" }}>Invite from Contacts</span>
        </button>

        {/* Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Anyone with the invite code or link can request to join. You'll need to approve new members before they can
            participate.
          </p>
        </div>
      </div>
    </div>
  )
}
