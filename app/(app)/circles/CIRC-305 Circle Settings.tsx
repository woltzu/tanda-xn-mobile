"use client"

import { useState } from "react"

export default function CircleSettings() {
  const circle = {
    id: "circle_123",
    name: "Family Savings",
    description: "Monthly savings with the family",
    amount: 200,
    frequency: "monthly",
    size: 6,
    status: "active",
    inviteCode: "FAMILY2025",
    isAdmin: true,
    createdAt: "Oct 15, 2024",
  }

  const [settings, setSettings] = useState({
    notifications: true,
    reminderDays: 3,
    autoContribute: false,
    allowLatePayments: true,
    gracePeriodDays: 2,
    lateFeePercent: 10,
  })

  const toggleSetting = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
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
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Circle Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Circle Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>CIRCLE INFO</h3>

          <button
            onClick={() => console.log("Edit name")}
            style={{
              width: "100%",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "10px",
              border: "none",
              cursor: circle.isAdmin ? "pointer" : "default",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Name</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {circle.name}
              </p>
            </div>
            {circle.isAdmin && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => console.log("Edit description")}
            style={{
              width: "100%",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "10px",
              border: "none",
              cursor: circle.isAdmin ? "pointer" : "default",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Description</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#0A2342" }}>
                {circle.description || "No description"}
              </p>
            </div>
            {circle.isAdmin && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
          </button>

          <div
            style={{
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Contribution</span>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                ${circle.amount} {circle.frequency}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Circle Size</span>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>{circle.size} members</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Created</span>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>{circle.createdAt}</span>
            </div>
          </div>
        </div>

        {/* Invite Code */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>INVITE CODE</h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342", letterSpacing: "2px" }}>
                {circle.inviteCode}
              </p>
            </div>
            <button
              onClick={() => console.log("Share invite")}
              style={{
                padding: "14px 20px",
                background: "#00C6AE",
                border: "none",
                borderRadius: "10px",
                color: "#FFFFFF",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Share
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>NOTIFICATIONS</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Push Notifications</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Get reminders and updates</p>
              </div>
              <button
                onClick={() => toggleSetting("notifications")}
                style={{
                  width: "50px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: settings.notifications ? "#00C6AE" : "#E5E7EB",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    position: "absolute",
                    top: "2px",
                    left: settings.notifications ? "24px" : "2px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            <div
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Reminder Days</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Days before due date</p>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                {settings.reminderDays} days
              </span>
            </div>
          </div>
        </div>

        {/* Admin Settings */}
        {circle.isAdmin && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>
              ADMIN SETTINGS
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    Allow Late Payments
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    {settings.gracePeriodDays}-day grace period with {settings.lateFeePercent}% fee
                  </p>
                </div>
                <button
                  onClick={() => toggleSetting("allowLatePayments")}
                  style={{
                    width: "50px",
                    height: "28px",
                    borderRadius: "14px",
                    border: "none",
                    background: settings.allowLatePayments ? "#00C6AE" : "#E5E7EB",
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      position: "absolute",
                      top: "2px",
                      left: settings.allowLatePayments ? "24px" : "2px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>
              </div>

              <button
                onClick={() => console.log("Manage members")}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Manage Members</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>ACTIONS</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Edit Circle - Only for Admin/Creator */}
            {circle.isAdmin && (
              <button
                onClick={() => console.log("Edit circle")}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#F0FDFB",
                  borderRadius: "10px",
                  border: "1px solid #00C6AE",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#00897B" }}>Edit Circle Details</span>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}

            {/* Leave Circle */}
            <button
              onClick={() => console.log("Leave circle")}
              style={{
                width: "100%",
                padding: "14px",
                background: "#FEF3C7",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>Leave Circle</span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Delete Circle - Only for Admin/Creator */}
            {circle.isAdmin && (
              <>
                <button
                  onClick={() => console.log("Delete circle")}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#FEE2E2",
                    borderRadius: "10px",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#DC2626" }}>Delete Circle</span>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Delete Warning */}
                <div
                  style={{
                    padding: "12px",
                    background: "#FEF2F2",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#DC2626"
                    strokeWidth="2"
                    style={{ marginTop: "2px", flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <p style={{ margin: 0, fontSize: "11px", color: "#991B1B", lineHeight: 1.4 }}>
                    Deleting a circle is permanent and cannot be undone. All members will be notified and any pending contributions will be refunded.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
