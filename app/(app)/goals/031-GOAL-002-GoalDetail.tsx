"use client"

import { useState } from "react"
import { TabBarInline } from "../../../components/TabBar"

export default function GoalDetailScreen() {
  const [showMenu, setShowMenu] = useState(false)
  const [showAutoSaveModal, setShowAutoSaveModal] = useState(false)
  const [showAddFundsModal, setShowAddFundsModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState("")

  // Payment methods available
  const paymentMethods = [
    { id: "wallet", name: "TandaXn Wallet", icon: "💳", balance: 847.50, type: "wallet" },
    { id: "debit", name: "Visa •••• 4521", icon: "💳", balance: null, type: "card" },
    { id: "bank", name: "Chase •••• 7890", icon: "🏦", balance: null, type: "bank" },
    { id: "orange", name: "Orange Money", icon: "📱", balance: 125000, currency: "XOF", type: "mobile" },
    { id: "mtn", name: "MTN MoMo", icon: "📱", balance: null, type: "mobile" },
    { id: "apple", name: "Apple Pay", icon: "🍎", balance: null, type: "digital" },
  ]

  // Goal data
  const goal = {
    id: "g1",
    name: "Emergency Fund",
    emoji: "🛡️",
    description: "3 months of expenses for unexpected situations",
    targetAmount: 5000,
    currentAmount: 3200,
    tier: "emergency",
    deadline: "2025-06-30",
    monthlyContribution: 400,
    autoContribute: true,
    createdAt: "2024-09-15",
  }

  const recentActivity = [
    { id: 1, type: "deposit", amount: 400, date: "Dec 15, 2024", source: "Auto-Save" },
    { id: 2, type: "deposit", amount: 400, date: "Nov 15, 2024", source: "Auto-Save" },
    { id: 3, type: "deposit", amount: 200, date: "Nov 1, 2024", source: "Manual" },
    { id: 4, type: "deposit", amount: 400, date: "Oct 15, 2024", source: "Auto-Save" },
  ]

  // Tier system
  const tiers = {
    flexible: {
      name: "Flexible Goal",
      penalty: 0,
      penaltyLabel: "0%",
      icon: "🔓",
      description: "Withdraw anytime, no penalty",
    },
    emergency: {
      name: "Emergency Fund",
      penalty: 2,
      penaltyLabel: "2%",
      icon: "🛡️",
      description: "Small penalty for protection",
    },
    locked: {
      name: "Locked Saving",
      penalty: 7,
      penaltyLabel: "7%",
      icon: "🔒",
      description: "Strong commitment device",
    },
  }

  const tierInfo = tiers[goal.tier as keyof typeof tiers]
  const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100)
  const remaining = goal.targetAmount - goal.currentAmount
  const penaltyAmount = Math.round((goal.currentAmount * tierInfo.penalty) / 100)

  // Calculate days remaining
  const daysRemaining = Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  // Milestones
  const milestones = [
    { percent: 25, reached: progress >= 25 },
    { percent: 50, reached: progress >= 50 },
    { percent: 75, reached: progress >= 75 },
    { percent: 100, reached: progress >= 100 },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
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

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Edit Goal Button */}
            <button
              onClick={() => console.log("Navigate to Edit Goal")}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "10px",
                padding: "8px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>Edit</span>
            </button>

            {/* 3-dot Menu for Auto-Save & Delete */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowMenu(!showMenu)}
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
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>

              {showMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "44px",
                    right: 0,
                    background: "#FFFFFF",
                    borderRadius: "12px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    overflow: "hidden",
                    minWidth: "180px",
                    zIndex: 100,
                  }}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowAutoSaveModal(true)
                    }}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "14px",
                      color: "#0A2342",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Auto-Save Settings
                  </button>
                  <div style={{ height: "1px", background: "#E5E7EB" }} />
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowDeleteModal(true)
                    }}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "14px",
                      color: "#EF4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete Goal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Goal Header */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              margin: "0 auto 12px auto",
            }}
          >
            {goal.emoji}
          </div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>{goal.name}</h1>

          {/* Tier Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: goal.tier === "locked" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
              padding: "6px 12px",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "14px" }}>{tierInfo.icon}</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>
              {tierInfo.name} • {tierInfo.penaltyLabel} penalty
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Progress Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* Progress Ring */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: `conic-gradient(#00C6AE ${progress * 3.6}deg, #E5E7EB 0deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}
              >
                <span style={{ fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>{progress}%</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: "12px" }}>
                <p style={{ margin: "0 0 2px 0", fontSize: "12px", color: "#6B7280" }}>Saved</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
                  ${goal.currentAmount.toLocaleString()}
                </p>
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <div>
                  <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#9CA3AF" }}>Remaining</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    ${remaining.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#9CA3AF" }}>Target</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    ${goal.targetAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <button
            onClick={() => console.log("View Milestones")}
            style={{
              width: "100%",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {milestones.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: m.reached ? "#00C6AE" : "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {m.reached && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>
                {milestones.filter((m) => m.reached).length}/4 milestones
              </span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Tier Card */}
        <button
          onClick={() => console.log("Upgrade Tier")}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: goal.tier === "locked" ? "#0A2342" : "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                {tierInfo.icon}
              </div>
              <div>
                <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  {tierInfo.name}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{tierInfo.description}</p>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {tierInfo.penalty > 0 && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                background: "#FEF3C7",
                borderRadius: "8px",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#92400E" }}>
                Early withdrawal penalty: ${penaltyAmount.toLocaleString()} ({tierInfo.penaltyLabel} of current balance)
              </p>
            </div>
          )}
        </button>

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Days Remaining</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
              {daysRemaining > 0 ? daysRemaining : 0}
            </p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Monthly</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
              ${goal.monthlyContribution}
            </p>
          </div>
        </div>

        {/* View Progress Button */}
        <button
          onClick={() => console.log("View Progress")}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>View Progress & Projections</span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Recent Activity */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Recent Activity
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid #F5F7FA",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "#F0FDFB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                      {activity.source}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>{activity.date}</p>
                  </div>
                </div>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>+${activity.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions - positioned above tab bar */}
      <div
        style={{
          position: "fixed",
          bottom: "80px", // Space for tab bar
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={() => console.log("Withdraw")}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "15px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          Withdraw
        </button>
        <button
          onClick={() => setShowAddFundsModal(true)}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#00C6AE",
            fontSize: "15px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Funds
        </button>
      </div>

      {/* Auto-Save Settings Modal */}
      {showAutoSaveModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 200,
          }}
          onClick={() => setShowAutoSaveModal(false)}
        >
          <div
            style={{
              width: "100%",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 40px 20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div
              style={{
                width: "40px",
                height: "4px",
                background: "#E5E7EB",
                borderRadius: "2px",
                margin: "0 auto 20px auto",
              }}
            />

            <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              Auto-Save Settings
            </h2>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280" }}>
              Configure automatic contributions to this goal
            </p>

            {/* Auto-Contribute Toggle */}
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  Auto-Save Enabled
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                  Automatically contribute ${goal.monthlyContribution}/month
                </p>
              </div>
              <button
                style={{
                  width: "52px",
                  height: "32px",
                  borderRadius: "16px",
                  border: "none",
                  background: goal.autoContribute ? "#00C6AE" : "#E5E7EB",
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    position: "absolute",
                    top: "3px",
                    left: goal.autoContribute ? "23px" : "3px",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            {/* Monthly Amount */}
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                Monthly Amount
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#FFFFFF",
                  borderRadius: "10px",
                  padding: "0 12px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <span style={{ fontSize: "18px", color: "#6B7280" }}>$</span>
                <input
                  type="number"
                  defaultValue={goal.monthlyContribution}
                  style={{
                    flex: 1,
                    padding: "14px 8px",
                    border: "none",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#0A2342",
                    outline: "none",
                    background: "transparent",
                  }}
                />
                <span style={{ fontSize: "14px", color: "#6B7280" }}>/mo</span>
              </div>
            </div>

            {/* Payout Allocation */}
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "24px",
              }}
            >
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                Payout Allocation
              </label>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
                Percentage of circle payouts to auto-deposit to this goal
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {[0, 10, 25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "20px",
                      border: "1px solid #E5E7EB",
                      background: percent === 25 ? "#00C6AE" : "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: percent === 25 ? "#FFFFFF" : "#0A2342",
                      cursor: "pointer",
                    }}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={() => setShowAutoSaveModal(false)}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "none",
                background: "#00C6AE",
                fontSize: "16px",
                fontWeight: "600",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 200,
          }}
          onClick={() => {
            setShowAddFundsModal(false)
            setSelectedPaymentMethod(null)
            setDepositAmount("")
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "90vh",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 40px 20px",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div
              style={{
                width: "40px",
                height: "4px",
                background: "#E5E7EB",
                borderRadius: "2px",
                margin: "0 auto 20px auto",
              }}
            />

            <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              Add Funds to Goal
            </h2>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280" }}>
              Choose how much to deposit and where from
            </p>

            {/* Amount Input */}
            <div
              style={{
                background: "#0A2342",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "20px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                Deposit Amount
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "32px", fontWeight: "700", color: "#FFFFFF" }}>$</span>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0"
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "48px",
                    fontWeight: "700",
                    color: "#FFFFFF",
                    width: "150px",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
              </div>
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                Remaining to goal: ${(goal.targetAmount - goal.currentAmount).toLocaleString()}
              </p>
            </div>

            {/* Quick Amount Buttons */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
              {[50, 100, 200, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setDepositAmount(amount.toString())}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: depositAmount === amount.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: depositAmount === amount.toString() ? "#F0FDFB" : "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0A2342",
                    cursor: "pointer",
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Payment Source Selection */}
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>
              SELECT PAYMENT SOURCE
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {paymentMethods.map((method) => {
                const isSelected = selectedPaymentMethod === method.id
                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: isSelected ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: isSelected ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: "#F5F7FA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                      }}
                    >
                      {method.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                        {method.name}
                      </p>
                      {method.balance !== null && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                          Balance: {method.currency === "XOF" ? `CFA ${method.balance.toLocaleString()}` : `$${method.balance.toFixed(2)}`}
                        </p>
                      )}
                      {method.type === "card" && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Debit Card</p>
                      )}
                      {method.type === "bank" && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Bank Transfer</p>
                      )}
                    </div>
                    {isSelected && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#00C6AE">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    )}
                  </button>
                )
              })}

              {/* Add New Payment Method */}
              <button
                onClick={() => console.log("Add new payment method")}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px dashed #00C6AE",
                  background: "#F0FDFB",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                  Add New Payment Method
                </span>
              </button>
            </div>

            {/* Deposit Button */}
            <button
              onClick={() => {
                console.log("Deposit", depositAmount, "from", selectedPaymentMethod)
                setShowAddFundsModal(false)
                setSelectedPaymentMethod(null)
                setDepositAmount("")
              }}
              disabled={!selectedPaymentMethod || !depositAmount || Number(depositAmount) <= 0}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "none",
                background: selectedPaymentMethod && depositAmount && Number(depositAmount) > 0 ? "#00C6AE" : "#E5E7EB",
                fontSize: "16px",
                fontWeight: "600",
                color: selectedPaymentMethod && depositAmount && Number(depositAmount) > 0 ? "#FFFFFF" : "#9CA3AF",
                cursor: selectedPaymentMethod && depositAmount && Number(depositAmount) > 0 ? "pointer" : "not-allowed",
              }}
            >
              Deposit ${depositAmount || "0"} to Goal
            </button>
          </div>
        </div>
      )}

      {/* Delete Goal Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: "20px",
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "340px",
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "24px",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: goal.currentAmount > 0 ? "#FEF2F2" : "#FEF3C7",
                margin: "0 auto 16px auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {goal.currentAmount > 0 ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              )}
            </div>

            <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              {goal.currentAmount > 0 ? "Delete Goal with Funds?" : "Delete Goal?"}
            </h2>

            {goal.currentAmount > 0 ? (
              <>
                <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.5" }}>
                  This goal has <strong>${goal.currentAmount.toLocaleString()}</strong> saved. Deleting it will return funds to your wallet minus a 2% early withdrawal fee.
                </p>

                {/* Fee Breakdown */}
                <div
                  style={{
                    background: "#F5F7FA",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "20px",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px", color: "#6B7280" }}>Current Balance</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      ${goal.currentAmount.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "14px", color: "#DC2626" }}>Early Withdrawal Fee (2%)</span>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#DC2626" }}>
                      -${(goal.currentAmount * 0.02).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height: "1px", background: "#E5E7EB", margin: "12px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Amount to Wallet</span>
                    <span style={{ fontSize: "15px", fontWeight: "700", color: "#00C6AE" }}>
                      ${(goal.currentAmount * 0.98).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.5" }}>
                This goal has no funds saved yet. You can delete it without any fees.
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                Keep Goal
              </button>
              <button
                onClick={() => {
                  console.log("Delete goal, return", goal.currentAmount > 0 ? goal.currentAmount * 0.98 : 0, "to wallet")
                  setShowDeleteModal(false)
                }}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#DC2626",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                {goal.currentAmount > 0 ? "Delete & Withdraw" : "Delete Goal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <TabBarInline activeTab="goals" />
    </div>
  )
}
