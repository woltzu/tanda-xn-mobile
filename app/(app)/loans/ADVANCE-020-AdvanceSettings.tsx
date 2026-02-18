"use client"

import { useState } from "react"

export default function AdvanceSettingsScreen() {
  const user = {
    name: "Franck",
    xnScore: 75,
  }

  const activeAdvance = {
    id: "ADV-2025-0120-001",
    amount: 300,
    totalDue: 315,
    withholdingDate: "Feb 15, 2025",
    daysUntil: 25,
  }

  const [autopayEnabled, setAutopayEnabled] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailReceipts, setEmailReceipts] = useState(true)

  const quickActions = [
    {
      id: "early_repay",
      icon: "💰",
      label: "Pay Off Early",
      sublabel: "Save on fees",
      highlight: true,
    },
    {
      id: "schedule",
      icon: "📅",
      label: "Withholding Schedule",
      sublabel: "View timeline",
    },
    {
      id: "agreement",
      icon: "📄",
      label: "View Agreement",
      sublabel: "Terms & conditions",
    },
    {
      id: "hardship",
      icon: "🤝",
      label: "Request Hardship",
      sublabel: "Get assistance",
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
          padding: "20px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Advance Settings</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Manage your advance</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Active Advance Summary */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Active Advance</h3>
            <span
              style={{
                background: "#F0FDFB",
                color: "#00897B",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
              }}
            >
              On Track ✓
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Amount Due</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
                ${activeAdvance.totalDue}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Auto-Withhold</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                {activeAdvance.withholdingDate}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{activeAdvance.daysUntil} days</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Quick Actions</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => console.log(action.label)}
                style={{
                  padding: "14px",
                  background: action.highlight ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: action.highlight ? "2px solid #00C6AE" : "none",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>{action.icon}</span>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{action.label}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{action.sublabel}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Autopay Settings */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Early Repayment Autopay
          </h3>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                Auto-pay when wallet has funds
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Automatically pay early to save fees
              </p>
            </div>
            <button
              onClick={() => setAutopayEnabled(!autopayEnabled)}
              style={{
                width: "52px",
                height: "28px",
                borderRadius: "14px",
                border: "none",
                background: autopayEnabled ? "#00C6AE" : "#E5E7EB",
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
                  left: autopayEnabled ? "26px" : "2px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "11px",
              color: "#9CA3AF",
              padding: "10px",
              background: "#F5F7FA",
              borderRadius: "8px",
            }}
          >
            Note: Your advance is already auto-withheld from your payout. This setting is for paying early from your
            wallet balance.
          </p>
        </div>

        {/* Notification Settings */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Notifications</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>Push Notifications</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Withholding reminders & updates
                </p>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                style={{
                  width: "52px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: notificationsEnabled ? "#00C6AE" : "#E5E7EB",
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
                    left: notificationsEnabled ? "26px" : "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            <div style={{ height: "1px", background: "#F5F7FA" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>Email Receipts</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Confirmation emails for payments
                </p>
              </div>
              <button
                onClick={() => setEmailReceipts(!emailReceipts)}
                style={{
                  width: "52px",
                  height: "28px",
                  borderRadius: "14px",
                  border: "none",
                  background: emailReceipts ? "#00C6AE" : "#E5E7EB",
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
                    left: emailReceipts ? "26px" : "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* More Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "8px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => console.log("View history")}
            style={{
              width: "100%",
              padding: "14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span style={{ fontSize: "14px", color: "#0A2342" }}>Advance History</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div style={{ height: "1px", background: "#F5F7FA", margin: "0 14px" }} />

          <button
            onClick={() => console.log("Contact support")}
            style={{
              width: "100%",
              padding: "14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ fontSize: "14px", color: "#0A2342" }}>Contact Support</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* XnScore */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #00C6AE",
            }}
          >
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>{user.xnScore}</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>Your XnScore</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
              On-time repayment keeps your score healthy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
