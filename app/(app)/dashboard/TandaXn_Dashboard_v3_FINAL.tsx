"use client"

import { useState } from "react"

export default function TandaXnDashboard() {
  const [activeTab, setActiveTab] = useState("home")

  // Mock data
  const user = {
    firstName: "Fatou",
    lastName: "Diallo",
    avatar: null,
    tier: 2,
    isInterestUnlocked: false,
    xnScore: 78,
    memberSince: "Oct 2024",
  }

  const wallet = {
    totalBalance: 847.5,
    currency: "USD",
  }

  const circles = {
    activeCount: 2,
    totalContributed: 3200,
    nextPayment: {
      amount: 200,
      dueDate: "Jan 15",
      circleName: "Family Savings",
      daysUntil: 5,
    },
    upcomingPayout: {
      amount: 2000,
      date: "Feb 1",
      circleName: "Home Buyers",
      daysUntil: 22,
    },
    list: [
      {
        id: "c1",
        name: "Family Savings Circle",
        emoji: "👨‍👩‍👧‍👦",
        members: 10,
        contribution: 200,
        frequency: "Monthly",
        myPosition: 7,
        currentPosition: 3,
        totalPool: 2000,
        progress: 30,
      },
      {
        id: "c2",
        name: "Home Buyers Circle",
        emoji: "🏠",
        members: 8,
        contribution: 500,
        frequency: "Monthly",
        myPosition: 2,
        currentPosition: 1,
        totalPool: 4000,
        progress: 12.5,
      },
    ],
  }

  const goals = {
    totalSaved: 7500,
    totalInterest: 47.83,
    monthlyInterest: 12.45,
    interestRate: 4.0,
    list: [
      {
        id: "g1",
        name: "First Home in Ghana",
        emoji: "🏠",
        balance: 5000,
        target: 15000,
        interest: 31.42,
        progress: 33,
        monthlyContribution: 400,
      },
      {
        id: "g2",
        name: "Emergency Fund",
        emoji: "🛡️",
        balance: 2500,
        target: 5000,
        interest: 16.41,
        progress: 50,
        monthlyContribution: 200,
      },
    ],
  }

  const notifications = {
    count: 3,
    hasUrgent: true,
  }

  const totalWealth = wallet.totalBalance + goals.totalSaved + (user.isInterestUnlocked ? goals.totalInterest : 0)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "90px",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 90px 20px",
          color: "#FFFFFF",
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          {/* Greeting */}
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "14px", opacity: 0.8 }}>Welcome back,</p>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>{user.firstName} 👋</h1>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            {/* XnScore Badge */}
            <button
              onClick={() => console.log("View XnScore")}
              style={{
                height: "44px",
                padding: "0 14px",
                borderRadius: "12px",
                background: "rgba(0,198,174,0.2)",
                border: "1px solid rgba(0,198,174,0.4)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "14px" }}>⭐</span>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>{user.xnScore}</span>
            </button>

            {/* Notifications */}
            <button
              onClick={() => console.log("Notifications")}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifications.count > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "9px",
                    background: notifications.hasUrgent ? "#EF4444" : "#F59E0B",
                    color: "#FFFFFF",
                    fontSize: "10px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  {notifications.count}
                </span>
              )}
            </button>

            {/* Profile */}
            <button
              onClick={() => console.log("Profile")}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {user.avatar ? (
                <img
                  src={user.avatar || "/placeholder.svg"}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: "700",
                    color: "#FFFFFF",
                  }}
                >
                  {user.firstName.charAt(0)}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Total Balance */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7, letterSpacing: "0.5px" }}>TOTAL BALANCE</p>
          <p
            style={{
              margin: 0,
              fontSize: "40px",
              fontWeight: "700",
              letterSpacing: "-1px",
              lineHeight: 1.1,
            }}
          >
            ${totalWealth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>

          {/* Balance Breakdown */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "20px",
              marginTop: "14px",
            }}
          >
            {[
              { label: "Circles", value: circles.totalContributed, icon: "🔄" },
              { label: "Goals", value: goals.totalSaved, icon: "🎯" },
              { label: "Cash", value: wallet.totalBalance, icon: "💵" },
            ].map((item, idx) => (
              <div key={idx} style={{ textAlign: "center" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "10px",
                    opacity: 0.6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "3px",
                  }}
                >
                  <span>{item.icon}</span> {item.label}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600" }}>
                  ${item.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ marginTop: "-50px", padding: "0 16px" }}>
        {/* Interest Card */}
        {goals.totalSaved > 0 && (
          <div
            style={{
              background: user.isInterestUnlocked
                ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                : "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "12px",
              color: "#FFFFFF",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative circle */}
            <div
              style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
              }}
            />

            <div
              style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px" }}>{user.isInterestUnlocked ? "📈" : "🔒"}</span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      opacity: 0.9,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {user.isInterestUnlocked ? "Interest Earned" : "Interest Accruing"}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>${goals.totalInterest.toFixed(2)}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>
                  +${goals.monthlyInterest.toFixed(2)} this month • {goals.interestRate}% APY on Goals
                </p>
              </div>

              {user.isInterestUnlocked ? (
                <button
                  style={{
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  Details →
                </button>
              ) : (
                <button
                  onClick={() => console.log("Unlock Interest")}
                  style={{
                    padding: "10px 14px",
                    background: "#FFFFFF",
                    border: "none",
                    borderRadius: "10px",
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Unlock
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginBottom: "14px",
          }}
        >
          {[
            { icon: "💳", label: "Pay", action: () => console.log("Pay"), bg: "#F59E0B" },
            { icon: "➕", label: "Add", action: () => console.log("Add"), bg: "#F59E0B" },
            { icon: "📤", label: "Send", action: () => console.log("Send"), bg: "#F59E0B" },
            { icon: "🎯", label: "Goal", action: () => console.log("Goal"), bg: "#F59E0B" },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              style={{
                padding: "12px 6px",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "14px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: `${item.bg}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                {item.icon}
              </div>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#0A2342" }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Upcoming Events */}
        {(circles.nextPayment || circles.upcomingPayout) && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "14px",
              marginBottom: "14px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0",
                fontSize: "13px",
                fontWeight: "600",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Coming Up
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              {/* Next Payment */}
              {circles.nextPayment && (
                <button
                  onClick={() => console.log("Make Payment")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: circles.nextPayment.daysUntil <= 3 ? "#FEF2F2" : "#FEF3C7",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px" }}>{circles.nextPayment.daysUntil <= 3 ? "⚠️" : "📅"}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "600",
                        color: circles.nextPayment.daysUntil <= 3 ? "#DC2626" : "#92400E",
                      }}
                    >
                      {circles.nextPayment.daysUntil <= 3 ? "DUE SOON" : "PAYMENT DUE"}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "20px",
                      fontWeight: "700",
                      color: circles.nextPayment.daysUntil <= 3 ? "#DC2626" : "#92400E",
                    }}
                  >
                    ${circles.nextPayment.amount}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: "11px",
                      color: circles.nextPayment.daysUntil <= 3 ? "#EF4444" : "#B45309",
                    }}
                  >
                    {circles.nextPayment.circleName} • {circles.nextPayment.dueDate}
                  </p>
                </button>
              )}

              {/* Upcoming Payout */}
              {circles.upcomingPayout && (
                <div
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#F0FDFB",
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px" }}>🎉</span>
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#065F46" }}>YOUR PAYOUT</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#059669" }}>
                    ${circles.upcomingPayout.amount.toLocaleString()}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#047857" }}>
                    {circles.upcomingPayout.circleName} • {circles.upcomingPayout.date}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Circles */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>My Circles</h3>
              <span
                style={{
                  background: "#0A2342",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: "600",
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                {circles.activeCount}
              </span>
            </div>
            <button
              onClick={() => console.log("View All Circles")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              See All
            </button>
          </div>

          {/* Circle List - Limited to 3 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {circles.list.slice(0, 3).map((circle) => (
              <button
                key={circle.id}
                onClick={() => console.log("View Circle", circle.id)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#F5F7FA",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Circle Icon */}
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "12px",
                      background: "#0A2342",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                    }}
                  >
                    {circle.emoji}
                  </div>

                  {/* Circle Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#0A2342",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {circle.name}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                      {circle.members} members • ${circle.contribution}/{circle.frequency.toLowerCase().slice(0, 2)}
                    </p>

                    {/* Progress */}
                    <div
                      style={{
                        height: "3px",
                        background: "#E5E7EB",
                        borderRadius: "2px",
                        marginTop: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${circle.progress}%`,
                          height: "100%",
                          background: "#00C6AE",
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                  </div>

                  {/* Position */}
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0A2342" }}>
                      #{circle.myPosition}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Your turn</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Info Note */}
          <div
            style={{
              marginTop: "10px",
              padding: "8px 10px",
              background: "#F5F7FA",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "11px" }}>💡</span>
            <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>
              Circle funds rotate between members. Move payouts to <strong>Goals</strong> to earn interest.
            </p>
          </div>
        </div>

        {/* My Goals */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>My Goals</h3>
              <span
                style={{
                  background: "#059669",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: "600",
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                {goals.interestRate}% APY
              </span>
            </div>
            <button
              onClick={() => console.log("View All Goals")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              See All
            </button>
          </div>

          {/* Goal List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {goals.list.map((goal) => (
              <button
                key={goal.id}
                onClick={() => console.log("View Goal", goal.id)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#F5F7FA",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Goal Icon */}
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "12px",
                      background: "#F0FDFB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                    }}
                  >
                    {goal.emoji}
                  </div>

                  {/* Goal Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#0A2342",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {goal.name}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                      ${goal.balance.toLocaleString()} of ${goal.target.toLocaleString()}
                    </p>

                    {/* Progress */}
                    <div
                      style={{
                        height: "3px",
                        background: "#E5E7EB",
                        borderRadius: "2px",
                        marginTop: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(goal.progress, 100)}%`,
                          height: "100%",
                          background: "#00C6AE",
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                  </div>

                  {/* Interest Earned */}
                  <div style={{ textAlign: "right" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        fontWeight: "600",
                        color: user.isInterestUnlocked ? "#059669" : "#D97706",
                      }}
                    >
                      +${goal.interest.toFixed(2)}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#9CA3AF" }}>
                      {user.isInterestUnlocked ? "earned" : "🔒 locked"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Add Goal Button */}
          <button
            onClick={() => console.log("Create Goal")}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "12px",
              background: "#F0FDFB",
              border: "1px dashed #00C6AE",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#00C6AE",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>➕</span> Add New Goal
          </button>
        </div>

        {/* Wallet Preview */}
        <button
          onClick={() => console.log("View Wallet")}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "14px",
            marginBottom: "14px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #0A2342 0%, #1a3a5c 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Wallet</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Available • {wallet.currency}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${wallet.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      {/* BOTTOM NAVIGATION */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "6px 12px 22px 12px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          justifyContent: "space-around",
        }}
      >
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "circles", icon: "🔄", label: "Circles" },
          { id: "goals", icon: "🎯", label: "Goals" },
          { id: "wallet", icon: "💳", label: "Wallet" },
          { id: "profile", icon: "👤", label: "Me" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? "#F0FDFB" : "transparent",
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
                opacity: activeTab === tab.id ? 1 : 0.5,
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "600",
                color: activeTab === tab.id ? "#00C6AE" : "#9CA3AF",
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
