"use client"

import { TabBarInline } from "../../../components/TabBar"

export default function QuickActionsScreen() {
  const user = { firstName: "Franck" }

  const contextualActions = [
    {
      id: "pay",
      icon: String.fromCodePoint(0x1f4b3),
      title: "Make Payment",
      subtitle: "Due tomorrow for Family Savings",
      priority: "high",
      action: "payment",
    },
    {
      id: "send",
      icon: String.fromCodePoint(0x1f30d),
      title: "Send Money Home",
      subtitle: "To Mama Francoise",
      priority: "medium",
      action: "cross-border",
    },
    {
      id: "circle",
      icon: String.fromCodePoint(0x1f465),
      title: "Join New Circle",
      subtitle: "3 circles matching your interests",
      priority: "low",
      action: "browse",
    },
  ]

  const frequentActions = [
    { id: "f1", icon: String.fromCodePoint(0x1f4b0), label: "Add to Savings", action: "deposit" },
    { id: "f2", icon: String.fromCodePoint(0x1f440), label: "View Activity", action: "activity" },
    { id: "f3", icon: String.fromCodePoint(0x1f4ca), label: "Check XnScore", action: "xnscore" },
    { id: "f4", icon: String.fromCodePoint(0x1f3af), label: "Goals Progress", action: "goals" },
  ]

  const recentCircles = [
    { id: "c1", name: "Family Savings", nextPayment: "Tomorrow", amount: 200, color: "#00C6AE" },
    { id: "c2", name: "Home Fund", nextPayment: "Jan 15", amount: 500, color: "#0A2342" },
  ]

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "high":
        return { bg: "#FEF3C7", border: "#D97706", text: "#92400E" }
      case "medium":
        return { bg: "#F0FDFB", border: "#00C6AE", text: "#065F46" }
      default:
        return { bg: "#F5F7FA", border: "#E5E7EB", text: "#6B7280" }
    }
  }

  const handleBack = () => {
    console.log("Going back...")
  }

  const handleAction = (action: string) => {
    console.log("Action:", action)
  }

  const handleCirclePress = (circle: typeof recentCircles[0]) => {
    console.log("Circle pressed:", circle)
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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Quick Actions</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>What would you like to do?</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Suggested Actions */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Suggested for You
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {contextualActions.map((action) => {
              const style = getPriorityStyle(action.priority)
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.action)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: style.bg,
                    borderRadius: "14px",
                    border: `1px solid ${style.border}`,
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
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    {action.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{action.title}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: style.text }}>{action.subtitle}</p>
                  </div>
                  {action.priority === "high" && (
                    <span
                      style={{
                        padding: "4px 8px",
                        background: "#D97706",
                        color: "#FFFFFF",
                        fontSize: "10px",
                        fontWeight: "700",
                        borderRadius: "4px",
                      }}
                    >
                      URGENT
                    </span>
                  )}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )
            })}
          </div>
        </div>

        {/* Frequent Actions Grid */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Frequent Actions
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
            {frequentActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.action)}
                style={{
                  padding: "16px 8px",
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  border: "1px solid #E5E7EB",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>{action.icon}</span>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: "500", color: "#0A2342", lineHeight: 1.3 }}>
                  {action.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Your Circles Quick Access */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Your Circles</h3>
            <button
              onClick={() => handleAction("circles")}
              style={{
                background: "none",
                border: "none",
                fontSize: "12px",
                color: "#00C6AE",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              View All
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentCircles.map((circle) => (
              <button
                key={circle.id}
                onClick={() => handleCirclePress(circle)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
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
                    background: circle.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{circle.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    Next payment: {circle.nextPayment}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>${circle.amount}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
