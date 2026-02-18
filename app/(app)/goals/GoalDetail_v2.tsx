"use client"

import { useState } from "react"

export default function GoalDetailScreen() {
  const [showAllActivity, setShowAllActivity] = useState(false)

  // Mock data
  const goal = {
    id: "g1",
    name: "First Home in Ghana",
    emoji: "🏠",
    balance: 5000,
    target: 15000,
    interestEarned: 31.42,
    interestRate: 4.0,
    dailyInterest: 0.55,
    startDate: "Oct 15, 2024",
    targetDate: "Dec 2026",
    monthlyContribution: 400,
    autoDeposit: true,
    linkedCircle: "Home Buyers Circle",
  }

  const isInterestUnlocked = false

  const recentActivity = [
    { type: "interest", desc: "Daily interest", amount: 0.55, date: "Today" },
    { type: "deposit", desc: "Circle payout", amount: 2000, date: "Jan 5" },
    { type: "interest", desc: "Daily interest", amount: 0.41, date: "Jan 4" },
    { type: "deposit", desc: "Auto-deposit", amount: 400, date: "Jan 1" },
    { type: "interest", desc: "Monthly interest", amount: 15.2, date: "Dec 31" },
  ]

  const progressPercent = Math.min((goal.balance / goal.target) * 100, 100)
  const totalWithInterest = goal.balance + goal.interestEarned
  const remainingAmount = goal.target - goal.balance
  const monthsRemaining = Math.ceil(remainingAmount / goal.monthlyContribution)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        {/* Top Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
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
            <span style={{ fontSize: "24px" }}>{goal.emoji}</span>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{goal.name}</h1>
          </div>

          <button
            onClick={() => console.log("Edit Goal")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        {/* Balance Display */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>TOTAL VALUE</p>
          <p style={{ margin: 0, fontSize: "42px", fontWeight: "700", letterSpacing: "-1px" }}>
            ${totalWithInterest.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>

          {/* Breakdown */}
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "10px", opacity: 0.6 }}>Saved</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600" }}>
                ${goal.balance.toLocaleString()}
              </p>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "10px", opacity: 0.6 }}>Interest</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                +${goal.interestEarned.toFixed(2)}
              </p>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "10px", opacity: 0.6 }}>Target</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600" }}>
                ${goal.target.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ maxWidth: "280px", margin: "16px auto 0 auto" }}>
            <div
              style={{
                height: "8px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: "#00C6AE",
                  borderRadius: "4px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {progressPercent.toFixed(0)}% complete • ${remainingAmount.toLocaleString()} to go
            </p>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ marginTop: "-40px", padding: "0 16px" }}>
        {/* Interest Card */}
        <div
          style={{
            background: isInterestUnlocked
              ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
              : "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "14px",
            color: "#FFFFFF",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
            }}
          />

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px" }}>{isInterestUnlocked ? "📈" : "🔒"}</span>
                  <p style={{ margin: 0, fontSize: "11px", opacity: 0.9, textTransform: "uppercase" }}>
                    {isInterestUnlocked ? "Interest Earned" : "Interest Accruing"}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>${goal.interestEarned.toFixed(2)}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>
                  +${goal.dailyInterest.toFixed(2)}/day • {goal.interestRate}% APY
                </p>
              </div>

              {isInterestUnlocked ? (
                <button
                  onClick={() => console.log("View Interest Details")}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  Details
                </button>
              ) : (
                <button
                  onClick={() => console.log("Unlock Interest")}
                  style={{
                    padding: "8px 12px",
                    background: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#D97706",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Unlock
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Goal Stats */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "14px",
            marginBottom: "14px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Goal Progress</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { label: "Monthly saving", value: `$${goal.monthlyContribution}`, icon: "📅" },
              { label: "Months to goal", value: `~${monthsRemaining}`, icon: "🎯" },
              { label: "Started", value: goal.startDate, icon: "🚀" },
              { label: "Target date", value: goal.targetDate, icon: "📆" },
            ].map((stat, idx) => (
              <div
                key={idx}
                style={{
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "18px" }}>{stat.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>{stat.label}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Linked Circle */}
        {goal.linkedCircle ? (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "14px",
              marginBottom: "14px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#0A2342",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>🔄</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Linked Circle</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                    {goal.linkedCircle}
                  </p>
                </div>
              </div>
              <span
                style={{
                  background: "#F0FDFB",
                  color: "#059669",
                  fontSize: "10px",
                  fontWeight: "600",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                Payouts → This Goal
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => console.log("Link Circle")}
            style={{
              width: "100%",
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "14px",
              marginBottom: "14px",
              border: "1px dashed #00C6AE",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>🔗</span>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
              Link a Circle to Auto-Fund This Goal
            </span>
          </button>
        )}

        {/* Recent Activity */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "14px",
            marginBottom: "14px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Recent Activity</h3>
            <button
              onClick={() => setShowAllActivity(!showAllActivity)}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {showAllActivity ? "Show Less" : "See All"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(showAllActivity ? recentActivity : recentActivity.slice(0, 4)).map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: item.type === "interest" ? "#F0FDFB" : "#EFF6FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    {item.type === "interest" ? "📈" : "💰"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{item.desc}</p>
                    <p style={{ margin: "1px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{item.date}</p>
                  </div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#059669" }}>
                  +${item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Why Goals Earn Interest */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "16px" }}>💡</span>
          <div>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#065F46" }}>
              Why does this earn interest?
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#047857", lineHeight: 1.5 }}>
              Money in Goals is <strong>at rest</strong>, so it earns {goal.interestRate}% APY. Circle funds{" "}
              <strong>rotate</strong> between members, so they don't earn interest until you move payouts here.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "12px 16px 28px 16px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          gap: "10px",
        }}
      >
        <button
          onClick={() => console.log("Add Money")}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "#00C6AE",
            fontSize: "15px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          Add Money
        </button>
        <button
          onClick={() => console.log("Withdraw")}
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
          Withdraw
        </button>
      </div>
    </div>
  )
}
