"use client"

import { useState } from "react"
import {
  Plus,
  Target,
  Home,
  GraduationCap,
  Car,
  Plane,
  Heart,
  Gift,
  PiggyBank,
  TrendingUp,
  ChevronRight,
  Calendar,
  Award,
  Sparkles,
  Trash2,
  X,
  HelpCircle,
} from "lucide-react"
import { TabBarInline } from "../../../components/TabBar"

export default function GoalsDashboard() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [goalToDelete, setGoalToDelete] = useState<number | null>(null)
  const [showHelpModal, setShowHelpModal] = useState(false)

  const [goals, setGoals] = useState([
    {
      id: 1,
      name: "Home Down Payment",
      icon: "home",
      category: "housing",
      targetAmount: 50000,
      currentAmount: 12500,
      tier: 2,
      tierName: "Committed",
      color: "#3B82F6",
      deadline: "Dec 2026",
      monthlyTarget: 1500,
      lastDeposit: "Dec 26",
      streakDays: 45,
    },
    {
      id: 2,
      name: "Kids Education",
      icon: "education",
      category: "education",
      targetAmount: 25000,
      currentAmount: 8200,
      tier: 1,
      tierName: "Flexible",
      color: "#8B5CF6",
      deadline: "Aug 2028",
      monthlyTarget: 500,
      lastDeposit: "Dec 20",
      streakDays: 30,
    },
    {
      id: 3,
      name: "Family Visit to Kenya",
      icon: "travel",
      category: "travel",
      targetAmount: 5000,
      currentAmount: 3200,
      tier: 3,
      tierName: "Locked",
      color: "#F59E0B",
      deadline: "Jun 2025",
      monthlyTarget: 400,
      lastDeposit: "Dec 28",
      streakDays: 60,
    },
    {
      id: 4,
      name: "Emergency Fund",
      icon: "emergency",
      category: "emergency",
      targetAmount: 10000,
      currentAmount: 4500,
      tier: 1,
      tierName: "Flexible",
      color: "#EF4444",
      deadline: null,
      monthlyTarget: 300,
      lastDeposit: "Dec 15",
      streakDays: 20,
    },
  ])

  const totalSavings = goals.reduce((sum, g) => sum + g.currentAmount, 0)
  const monthlyGrowth = 850

  const handleDeleteGoal = (goalId: number) => {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return

    // If goal has funds, calculate fee
    if (goal.currentAmount > 0) {
      const fee = goal.currentAmount * 0.02
      const returnAmount = goal.currentAmount - fee
      console.log(`Deleting goal ${goalId}, returning $${returnAmount.toFixed(2)} to wallet (fee: $${fee.toFixed(2)})`)
    } else {
      console.log(`Deleting goal ${goalId} with no funds - no fee`)
    }

    setGoals(goals.filter(g => g.id !== goalId))
    setGoalToDelete(null)
  }

  const upcomingMilestones = [
    { goalName: "Family Visit to Kenya", milestone: "75% reached", daysAway: 12 },
    { goalName: "Home Down Payment", milestone: "$15,000", daysAway: 28 },
  ]

  const categories = [
    { id: "all", label: "All Goals", icon: Target },
    { id: "housing", label: "Housing", icon: Home },
    { id: "education", label: "Education", icon: GraduationCap },
    { id: "travel", label: "Travel", icon: Plane },
    { id: "emergency", label: "Emergency", icon: Heart },
  ]

  const getGoalIcon = (iconName: string) => {
    switch (iconName) {
      case "home":
        return Home
      case "education":
        return GraduationCap
      case "car":
        return Car
      case "travel":
        return Plane
      case "emergency":
        return Heart
      case "gift":
        return Gift
      default:
        return PiggyBank
    }
  }

  const getTierBadge = (tier: number) => {
    const styles = {
      1: { bg: "#D1FAE5", color: "#059669" },
      2: { bg: "#DBEAFE", color: "#2563EB" },
      3: { bg: "#FEF3C7", color: "#D97706" },
    }
    return styles[tier as keyof typeof styles] || styles[1]
  }

  const filteredGoals = activeCategory === "all" ? goals : goals.filter((g) => g.category === activeCategory)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
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
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: "700" }}>My Goals</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "10px",
                padding: "10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HelpCircle size={20} color="#FFFFFF" />
            </button>
            <button
              onClick={() => console.log("Add Goal")}
              style={{
                background: "rgba(0, 198, 174, 0.2)",
                border: "1px solid rgba(0, 198, 174, 0.4)",
                borderRadius: "12px",
                padding: "10px 16px",
                color: "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Plus size={18} />
              Add Goal
            </button>
          </div>
        </div>

        {/* Total Savings Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", opacity: 0.8 }}>Total Goal Savings</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "40px", fontWeight: "700" }}>${totalSavings.toLocaleString()}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <TrendingUp size={16} color="#00C6AE" />
              <span style={{ color: "#00C6AE", fontSize: "14px", fontWeight: "600" }}>
                +${monthlyGrowth} this month
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>{goals.length}</p>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>Active Goals</p>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>
                {Math.max(...goals.map((g) => g.streakDays))}
              </p>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>Day Streak</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "0 20px",
          marginTop: "-24px",
          marginBottom: "20px",
          overflowX: "auto",
        }}
      >
        {categories.map((cat) => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.id
          const count = cat.id === "all" ? goals.length : goals.filter((g) => g.category === cat.id).length

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: isActive ? "#FFFFFF" : "rgba(255,255,255,0.9)",
                border: isActive ? "2px solid #00C6AE" : "1px solid #E0E0E0",
                borderRadius: "12px",
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: "600",
                color: isActive ? "#00C6AE" : "#666",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <Icon size={16} />
              {cat.label}
              <span
                style={{
                  background: isActive ? "#00C6AE" : "#E0E0E0",
                  color: isActive ? "#FFFFFF" : "#666",
                  padding: "2px 6px",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <div style={{ padding: "0 20px 20px 20px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #F0FDFB 0%, #CCFBF1 100%)",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #00C6AE30",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Sparkles size={18} color="#00C6AE" />
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Upcoming Milestones</span>
            </div>
            <div style={{ display: "flex", gap: "12px", overflowX: "auto" }}>
              {upcomingMilestones.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "10px",
                    padding: "12px",
                    minWidth: "160px",
                  }}
                >
                  <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#666" }}>{m.goalName}</p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {m.milestone}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#00C6AE", fontWeight: "600" }}>
                    ~{m.daysAway} days away
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Goals List */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredGoals.map((goal) => {
            const Icon = getGoalIcon(goal.icon)
            const progress = (goal.currentAmount / goal.targetAmount) * 100
            const tierStyle = getTierBadge(goal.tier)

            return (
              <button
                key={goal.id}
                onClick={() => console.log("View goal", goal.id)}
                style={{
                  width: "100%",
                  background: "#FFFFFF",
                  border: "1px solid #E0E0E0",
                  borderRadius: "16px",
                  padding: "16px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "start", gap: "12px", marginBottom: "14px" }}>
                  {/* Icon */}
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "14px",
                      background: `${goal.color}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={24} color={goal.color} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>{goal.name}</h3>
                      <span
                        style={{
                          background: tierStyle.bg,
                          color: tierStyle.color,
                          padding: "2px 8px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          fontWeight: "600",
                        }}
                      >
                        {goal.tierName}
                      </span>
                    </div>

                    {goal.deadline && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Calendar size={12} color="#666" />
                        <span style={{ fontSize: "12px", color: "#666" }}>Target: {goal.deadline}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setGoalToDelete(goal.id)
                      }}
                      style={{
                        background: "#FEE2E2",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Trash2 size={16} color="#DC2626" />
                    </button>
                    <ChevronRight size={20} color="#999" />
                  </div>
                </div>

                {/* Progress */}
                <div style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                      ${goal.currentAmount.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "14px", color: "#666" }}>of ${goal.targetAmount.toLocaleString()}</span>
                  </div>
                  <div
                    style={{
                      background: "#F5F7FA",
                      borderRadius: "8px",
                      height: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${goal.color}, ${goal.color}CC)`,
                        borderRadius: "8px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Stats Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "12px",
                    borderTop: "1px solid #F5F7FA",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <TrendingUp size={14} color="#10B981" />
                    <span style={{ fontSize: "12px", color: "#666" }}>${goal.monthlyTarget}/mo target</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Award size={14} color="#F59E0B" />
                    <span style={{ fontSize: "12px", color: "#666" }}>{goal.streakDays} day streak</span>
                  </div>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "700",
                      color: goal.color,
                    }}
                  >
                    {progress.toFixed(0)}%
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {filteredGoals.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E0E0E0",
            }}
          >
            <Target size={48} color="#999" style={{ marginBottom: "12px" }} />
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#0A2342" }}>No goals in this category</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#666" }}>Add a new goal to start saving</p>
            <button
              onClick={() => console.log("Add Goal")}
              style={{
                background: "#00C6AE",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Add Goal
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {goalToDelete !== null && (
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
          onClick={() => setGoalToDelete(null)}
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
            {(() => {
              const goal = goals.find(g => g.id === goalToDelete)
              if (!goal) return null

              const hasFunds = goal.currentAmount > 0
              const fee = hasFunds ? goal.currentAmount * 0.02 : 0
              const returnAmount = hasFunds ? goal.currentAmount - fee : 0

              return (
                <>
                  {/* Icon */}
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: hasFunds ? "#FEF2F2" : "#FEF3C7",
                      margin: "0 auto 16px auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 size={32} color={hasFunds ? "#DC2626" : "#D97706"} />
                  </div>

                  <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                    Delete "{goal.name}"?
                  </h2>

                  {hasFunds ? (
                    <>
                      <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.5" }}>
                        This goal has <strong>${goal.currentAmount.toLocaleString()}</strong> saved.
                        Deleting will return funds minus a 2% early withdrawal fee.
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
                          <span style={{ fontSize: "14px", color: "#DC2626" }}>Fee (2%)</span>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#DC2626" }}>
                            -${fee.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ height: "1px", background: "#E5E7EB", margin: "12px 0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>To Wallet</span>
                          <span style={{ fontSize: "15px", fontWeight: "700", color: "#00C6AE" }}>
                            ${returnAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.5" }}>
                      This goal has no funds saved. You can delete it without any fees.
                    </p>
                  )}

                  {/* Buttons */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => setGoalToDelete(null)}
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
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
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
                      {hasFunds ? "Delete & Withdraw" : "Delete"}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
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
          onClick={() => setShowHelpModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "85vh",
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

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                Goals Help
              </h2>
              <button
                onClick={() => setShowHelpModal(false)}
                style={{
                  background: "#F5F7FA",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} color="#6B7280" />
              </button>
            </div>

            {/* Help Topics */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#F0FDFB", borderRadius: "14px", padding: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  How do I create a goal?
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>
                  Tap the "Add Goal" button to create a new savings goal. Choose a goal type, set your target amount, timeline, and how much of your circle payouts to automatically allocate.
                </p>
              </div>

              <div style={{ background: "#F5F7FA", borderRadius: "14px", padding: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  How do I delete a goal?
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>
                  Tap the red trash icon on any goal card to delete it. Goals with no funds can be deleted for free. Goals with funds will have a 2% early withdrawal fee, and the remaining balance goes to your wallet.
                </p>
              </div>

              <div style={{ background: "#F5F7FA", borderRadius: "14px", padding: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  How do I add funds to a goal?
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>
                  Tap on any goal to view details, then tap "Add Funds". You can fund from your TandaXn wallet, debit card, bank account, or mobile money (Orange Money, MTN MoMo).
                </p>
              </div>

              <div style={{ background: "#F5F7FA", borderRadius: "14px", padding: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  What is auto-funding?
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>
                  You can allocate a percentage (0-100%) of your circle payouts to automatically go to a goal. This helps you save consistently without thinking about it.
                </p>
              </div>

              <div style={{ background: "#FEF3C7", borderRadius: "14px", padding: "16px" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  Early withdrawal fees
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5" }}>
                  If you withdraw or delete a goal before reaching your target, a 2% fee applies. This encourages you to stay committed to your savings goals.
                </p>
              </div>
            </div>

            {/* Contact Support */}
            <button
              onClick={() => console.log("Contact support")}
              style={{
                width: "100%",
                marginTop: "24px",
                padding: "16px",
                borderRadius: "14px",
                border: "none",
                background: "#0A2342",
                fontSize: "15px",
                fontWeight: "600",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Contact Support
            </button>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <TabBarInline activeTab="goals" />
    </div>
  )
}
