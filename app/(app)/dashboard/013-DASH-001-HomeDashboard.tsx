"use client"

import { useState } from "react"
import {
  Bell,
  Settings,
  TrendingUp,
  DollarSign,
  Plus,
  Search,
  ChevronRight,
  Home,
  Users,
  Target,
  User,
  Send,
  PiggyBank,
  Clock,
  Calendar,
} from "lucide-react"

export default function HomeDashboard() {
  const [activeTab, setActiveTab] = useState("home")

  // Sample user data
  const userData = {
    name: "Marcus Johnson",
    xnScore: 75,
    totalSavings: 4250,
    nextPayout: 1500,
    nextPayoutDate: "Jan 15",
    nextPayoutCircle: "Family Circle",
    daysUntilPayout: 18,
    unreadNotifications: 3,
  }

  // Sample circles data
  const circles = [
    {
      id: 1,
      name: "Family Circle",
      members: 8,
      contribution: 200,
      frequency: "month",
      currentCycle: 3,
      progress: 38,
      nextDue: "Jan 5",
      status: "active",
    },
    {
      id: 2,
      name: "Coworkers Savings",
      members: 6,
      contribution: 100,
      frequency: "biweekly",
      currentCycle: 5,
      progress: 83,
      nextDue: "Dec 30",
      status: "active",
    },
  ]

  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "circles", icon: Users, label: "Circles" },
    { id: "goals", icon: Target, label: "Goals" },
    { id: "profile", icon: User, label: "Profile" },
  ]

  const quickActions = [
    { id: "create", icon: Plus, label: "Create Circle", color: "#00C6AE" },
    { id: "join", icon: Search, label: "Join Circle", color: "#3B82F6" },
    { id: "goal", icon: PiggyBank, label: "Add to Goal", color: "#8B5CF6" },
    { id: "send", icon: Send, label: "Send Money", color: "#F59E0B" },
  ]

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10B981"
    if (score >= 60) return "#00C6AE"
    if (score >= 40) return "#F59E0B"
    return "#EF4444"
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        paddingBottom: "90px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #1A3A5A 100%)",
          padding: "20px 20px 50px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", opacity: 0.8 }}>Welcome back,</p>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>{userData.name.split(" ")[0]}</h1>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => console.log("Notifications")}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <Bell size={20} color="#FFFFFF" />
              {userData.unreadNotifications > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    minWidth: "18px",
                    height: "18px",
                    borderRadius: "9px",
                    background: "#EF4444",
                    color: "#FFFFFF",
                    fontSize: "10px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  {userData.unreadNotifications}
                </span>
              )}
            </button>
            <button
              onClick={() => console.log("Settings")}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Settings size={20} color="#FFFFFF" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.12)",
              borderRadius: "16px",
              padding: "16px",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: "13px", opacity: 0.9 }}>XnScore</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>{userData.xnScore}</h2>
              <TrendingUp size={18} color={getScoreColor(userData.xnScore)} />
            </div>
            <div
              style={{
                marginTop: "8px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "4px",
                height: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${userData.xnScore}%`,
                  height: "100%",
                  background: getScoreColor(userData.xnScore),
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.12)",
              borderRadius: "16px",
              padding: "16px",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: "13px", opacity: 0.9 }}>Total Savings</p>
            <h2 style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>
              ${userData.totalSavings.toLocaleString()}
            </h2>
            <p style={{ margin: "8px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Across all goals & circles</p>
          </div>
        </div>
      </div>

      {/* Next Payout Card */}
      <div
        style={{
          margin: "-30px 20px 20px 20px",
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Calendar size={18} color="#00C6AE" />
            </div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Next Payout</h3>
          </div>
          <span
            style={{
              background: "#DCFCE7",
              color: "#15803D",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            {userData.daysUntilPayout} days
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#666" }}>From {userData.nextPayoutCircle}</p>
            <h2 style={{ margin: 0, fontSize: "40px", fontWeight: "700", color: "#00C6AE" }}>
              ${userData.nextPayout.toLocaleString()}
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#999" }}>Expected {userData.nextPayoutDate}</p>
          </div>
          <div
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #F0FDFB, #CCFBF1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <DollarSign size={36} color="#00C6AE" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>Quick Actions</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
          }}
        >
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={() => console.log(action.label)}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E0E0E0",
                  borderRadius: "14px",
                  padding: "16px 8px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "12px",
                    background: `${action.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} color={action.color} />
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#0A2342", textAlign: "center" }}>
                  {action.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* My Circles */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>My Circles</h3>
          <span style={{ fontSize: "14px", color: "#666" }}>{circles.length} active</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {circles.map((circle) => (
            <button
              key={circle.id}
              onClick={() => console.log("Circle details", circle)}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E0E0E0",
                borderRadius: "16px",
                padding: "16px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                    {circle.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                    {circle.members} members • ${circle.contribution}/{circle.frequency}
                  </p>
                </div>
                <ChevronRight size={20} color="#999" />
              </div>

              <div
                style={{
                  background: "#F5F7FA",
                  borderRadius: "8px",
                  height: "8px",
                  overflow: "hidden",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    width: `${circle.progress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #00C6AE, #00A896)",
                    borderRadius: "8px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={12} color="#666" />
                  <span style={{ fontSize: "12px", color: "#666" }}>Next due: {circle.nextDue}</span>
                </div>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>
                  Cycle {circle.currentCycle}/{circle.members}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          borderTop: "1px solid #E0E0E0",
          display: "flex",
          justifyContent: "space-around",
          padding: "12px 0 28px 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                console.log("Navigate to", item.id)
              }}
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                padding: "4px 20px",
                position: "relative",
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    width: "24px",
                    height: "3px",
                    background: "#00C6AE",
                    borderRadius: "2px",
                  }}
                />
              )}
              <Icon size={24} color={isActive ? "#00C6AE" : "#999"} strokeWidth={isActive ? 2.5 : 2} />
              <span
                style={{
                  fontSize: "11px",
                  color: isActive ? "#00C6AE" : "#999",
                  fontWeight: isActive ? "600" : "400",
                }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
