"use client"

import { useState } from "react"

export default function SettingsMainMenuScreen() {
  const [user] = useState({
    firstName: "Franck",
    lastName: "Kengne",
    email: "franck@example.com",
    phone: "+1 (555) 123-4567",
    avatar: null,
    kycStatus: "verified",
    memberSince: "Oct 2024",
  })

  const [quickStats] = useState({
    xnScore: 75,
    totalSaved: 4850,
    circlesJoined: 3,
  })

  const [settingsGroups] = useState([
    {
      title: "Account",
      items: [
        {
          id: "profile",
          icon: "👤",
          label: "Edit Profile",
          subtitle: "Name, photo, contact info",
          hasArrow: true,
        },
        {
          id: "verification",
          icon: "✓",
          label: "Verification Status",
          subtitle: "ID verified",
          badge: "Verified",
          badgeColor: "#00C6AE",
        },
        {
          id: "linked",
          icon: "🔗",
          label: "Linked Accounts",
          subtitle: "Bank accounts, cards",
          hasArrow: true,
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          id: "security",
          icon: "🔒",
          label: "Security Settings",
          subtitle: "Password, 2FA, biometrics",
          hasArrow: true,
        },
        {
          id: "sessions",
          icon: "📱",
          label: "Active Sessions",
          subtitle: "2 devices",
          hasArrow: true,
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          id: "notifications",
          icon: "🔔",
          label: "Notifications",
          subtitle: "Push, email, SMS",
          hasArrow: true,
        },
        {
          id: "language",
          icon: "🌍",
          label: "Language & Region",
          subtitle: "English (US), USD",
          hasArrow: true,
        },
        {
          id: "privacy",
          icon: "👁",
          label: "Privacy",
          subtitle: "Who can see your activity",
          hasArrow: true,
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          icon: "❓",
          label: "Help Center",
          subtitle: "FAQs and guides",
          hasArrow: true,
        },
        {
          id: "support",
          icon: "💬",
          label: "Contact Support",
          subtitle: "Get help from our team",
          hasArrow: true,
        },
        {
          id: "about",
          icon: "ℹ️",
          label: "About TandaXn",
          subtitle: "Version 2.5.0",
          hasArrow: true,
        },
      ],
    },
  ])

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSettingPress = (settingId: string) => {
    console.log("Opening setting:", settingId)
  }

  const handleLogout = () => {
    console.log("Log out")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Settings</h1>
        </div>

        {/* Profile Preview */}
        <button
          onClick={() => handleSettingPress("profile")}
          style={{
            width: "100%",
            padding: "16px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              color: "#FFFFFF",
              fontWeight: "700",
            }}
          >
            {user.firstName.charAt(0)}
            {user.lastName.charAt(0)}
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "17px", fontWeight: "600", color: "#FFFFFF" }}>
              {user.firstName} {user.lastName}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{user.email}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
              Member since {user.memberSince}
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Quick Stats */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            display: "flex",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #E5E7EB" }}>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>{quickStats.xnScore}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>XnScore</p>
          </div>
          <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #E5E7EB" }}>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              ${quickStats.totalSaved.toLocaleString()}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Saved</p>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              {quickStats.circlesJoined}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Circles</p>
          </div>
        </div>

        {/* Settings Groups */}
        {settingsGroups.map((group, gIdx) => (
          <div key={group.title} style={{ marginBottom: "16px" }}>
            <p
              style={{
                margin: "0 0 8px 4px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#6B7280",
                textTransform: "uppercase",
              }}
            >
              {group.title}
            </p>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E5E7EB",
                overflow: "hidden",
              }}
            >
              {group.items.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => handleSettingPress(item.id)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    background: "#FFFFFF",
                    border: "none",
                    borderBottom: idx < group.items.length - 1 ? "1px solid #F5F7FA" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "20px", width: "28px", textAlign: "center" }}>{item.icon}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{item.label}</p>
                    <p style={{ margin: "1px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{item.subtitle}</p>
                  </div>
                  {item.badge && (
                    <span
                      style={{
                        padding: "3px 8px",
                        background: `${item.badgeColor}20`,
                        color: item.badgeColor,
                        fontSize: "10px",
                        fontWeight: "600",
                        borderRadius: "4px",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.hasArrow && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#DC2626" }}>Log Out</span>
        </button>
      </div>
    </div>
  )
}
