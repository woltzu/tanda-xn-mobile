"use client"

import { useState } from "react"

// Brand Colors
const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  offWhite: "#F5F7FA",
  white: "#FFFFFF",
  gray: "#6B7280",
  lightGray: "#E5E7EB",
}

interface TabBarProps {
  activeTab?: string
  onTabChange?: (tabId: string) => void
}

export default function TabBar({ activeTab = "home", onTabChange }: TabBarProps) {
  const [currentTab, setCurrentTab] = useState(activeTab)

  const tabs = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "circles", icon: "🔄", label: "Circles" },
    { id: "goals", icon: "🎯", label: "Goals" },
    { id: "wallet", icon: "💳", label: "Wallet" },
    { id: "profile", icon: "👤", label: "Me" },
  ]

  const handleTabPress = (tabId: string) => {
    setCurrentTab(tabId)
    if (onTabChange) {
      onTabChange(tabId)
    } else {
      // Default navigation behavior - log for now
      console.log("Navigate to:", tabId)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: COLORS.white,
        padding: "6px 12px 22px 12px",
        borderTop: `1px solid ${COLORS.lightGray}`,
        display: "flex",
        justifyContent: "space-around",
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => handleTabPress(tab.id)}
            style={{
              background: isActive ? "#F0FDFB" : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              padding: "6px 14px",
              borderRadius: "12px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                opacity: isActive ? 1 : 0.5,
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "600",
                color: isActive ? COLORS.teal : "#9CA3AF",
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Export a simpler inline version for screens that need just the JSX
export function TabBarInline({ activeTab = "home" }: { activeTab?: string }) {
  const tabs = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "circles", icon: "🔄", label: "Circles" },
    { id: "goals", icon: "🎯", label: "Goals" },
    { id: "wallet", icon: "💳", label: "Wallet" },
    { id: "profile", icon: "👤", label: "Me" },
  ]

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: COLORS.white,
        padding: "6px 12px 22px 12px",
        borderTop: `1px solid ${COLORS.lightGray}`,
        display: "flex",
        justifyContent: "space-around",
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => console.log("Navigate to:", tab.id)}
            style={{
              background: isActive ? "#F0FDFB" : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              padding: "6px 14px",
              borderRadius: "12px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                opacity: isActive ? 1 : 0.5,
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "600",
                color: isActive ? COLORS.teal : "#9CA3AF",
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
