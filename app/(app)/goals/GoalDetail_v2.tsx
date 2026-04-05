"use client"
import { useSavings } from "@/context/SavingsContext"
import { useGoalParams, navigateToGoalScreen, goBack } from "./useGoalParams"
import { useState, useEffect, useMemo } from "react"

export default function GoalDetailScreen() {
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  const [isDepositing, setIsDepositing] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)

  const { goalId } = useGoalParams()
  const {
    getGoalById,
    getGoalTransactions,
    calculateInterest,
    deposit,
    isLoading,
  } = useSavings()

  const goal = goalId ? getGoalById(goalId) : undefined
  const goalTransactions = goalId ? getGoalTransactions(goalId) : []
  const pendingInterest = goalId ? calculateInterest(goalId) : 0

  // Map transactions to display format
  const recentActivity = useMemo(() => {
    return goalTransactions.map((tx) => {
      let type: "interest" | "deposit" | "withdrawal" = "deposit"
      if (tx.type === "interest_credit") type = "interest"
      else if (tx.type === "withdrawal" || tx.type === "transfer_out") type = "withdrawal"

      const date = new Date(tx.createdAt)
      const today = new Date()
      const isToday = date.toDateString() === today.toDateString()
      const dateStr = isToday
        ? "Today"
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })

      return {
        type,
        desc: tx.description,
        amount: Math.abs(tx.amount),
        date: dateStr,
        isNegative: tx.type === "withdrawal" || tx.type === "transfer_out",
      }
    })
  }, [goalTransactions])

  const isInterestUnlocked = goal ? goal.interestUnlocked > 0 : false

  const handleDeposit = async () => {
    if (!goalId || !depositAmount) return
    const amount = Number.parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) return

    setIsDepositing(true)
    setDepositError(null)
    try {
      await deposit(goalId, amount, "Manual deposit")
      setDepositAmount("")
      setIsDepositModalOpen(false)
    } catch (err: any) {
      setDepositError(err.message || "Deposit failed. Please try again.")
    } finally {
      setIsDepositing(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #E5E7EB",
              borderTopColor: "#00C6AE",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 12px auto",
            }}
          />
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading goal...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  // Error state - goal not found
  if (!goal) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p style={{ fontSize: "48px", marginBottom: "12px" }}>😕</p>
          <p style={{ color: "#0A2342", fontSize: "18px", fontWeight: "600", margin: "0 0 8px 0" }}>
            Goal not found
          </p>
          <p style={{ color: "#6B7280", fontSize: "14px", margin: "0 0 20px 0" }}>
            The savings goal could not be loaded.
          </p>
          <button
            onClick={() => goBack()}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              background: "#00C6AE",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const interestRate = goal.interestRate * 100 // Convert decimal to display percentage
  const dailyInterest = (goal.currentBalance * goal.interestRate) / 365
  const totalWithInterest = goal.currentBalance + goal.interestEarned + pendingInterest
  const progressPercent = goal.targetAmount > 0 ? Math.min((goal.currentBalance / goal.targetAmount) * 100, 100) : 0
  const remainingAmount = Math.max(goal.targetAmount - goal.currentBalance, 0)

  // Estimate months remaining (rough estimate)
  // Look at recent deposits to estimate monthly contribution
  const recentDeposits = goalTransactions.filter(tx => tx.type === "deposit" || tx.type === "auto_deposit")
  const monthlyContribution = recentDeposits.length > 0
    ? recentDeposits.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / Math.max(1, Math.ceil(
        (Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
      ))
    : 0
  const monthsRemaining = monthlyContribution > 0 ? Math.ceil(remainingAmount / monthlyContribution) : null

  const startDate = new Date(goal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  // Auto-save linked circles info
  const linkedCircle = goal.autoSaveEnabled && goal.autoSaveFromCircles.length > 0
    ? `${goal.autoSaveFromCircles.length} circle${goal.autoSaveFromCircles.length > 1 ? "s" : ""} linked`
    : null

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
            onClick={() => goBack()}
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
                ${goal.currentBalance.toLocaleString()}
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
                ${goal.targetAmount.toLocaleString()}
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
                  +${dailyInterest.toFixed(2)}/day • {interestRate}% APY
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
              {
                label: "Monthly saving",
                value: monthlyContribution > 0 ? `$${Math.round(monthlyContribution)}` : "N/A",
                icon: "📅",
              },
              {
                label: "Months to goal",
                value: monthsRemaining !== null ? `~${monthsRemaining}` : "N/A",
                icon: "🎯",
              },
              { label: "Started", value: startDate, icon: "🚀" },
              {
                label: "Goal type",
                value: goal.type.charAt(0).toUpperCase() + goal.type.slice(1),
                icon: goal.type === "locked" ? "🔒" : goal.type === "emergency" ? "🛡️" : "💰",
              },
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
        {linkedCircle ? (
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
                  <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Auto-Save</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                    {linkedCircle}
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
                {goal.autoSavePercent}% of Payouts
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
            {recentActivity.length > 4 && (
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
            )}
          </div>

          {recentActivity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>No activity yet</p>
            </div>
          ) : (
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
                        background: item.type === "interest" ? "#F0FDFB" : item.type === "withdrawal" ? "#FEF2F2" : "#EFF6FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                      }}
                    >
                      {item.type === "interest" ? "📈" : item.type === "withdrawal" ? "📤" : "💰"}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{item.desc}</p>
                      <p style={{ margin: "1px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{item.date}</p>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: item.isNegative ? "#DC2626" : "#059669",
                    }}
                  >
                    {item.isNegative ? "-" : "+"}${item.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
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
              Money in Goals is <strong>at rest</strong>, so it earns {interestRate}% APY. Circle funds{" "}
              <strong>rotate</strong> between members, so they don't earn interest until you move payouts here.
            </p>
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {isDepositModalOpen && (
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
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "24px",
              width: "100%",
              maxWidth: "400px",
            }}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              Add Money to {goal.name}
            </h2>

            {depositError && (
              <div
                style={{
                  background: "#FEF2F2",
                  borderRadius: "8px",
                  padding: "10px",
                  marginBottom: "12px",
                  border: "1px solid #FECACA",
                }}
              >
                <p style={{ margin: 0, fontSize: "12px", color: "#DC2626" }}>{depositError}</p>
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#F5F7FA",
                borderRadius: "12px",
                padding: "4px 16px",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "24px", fontWeight: "300", color: "#6B7280" }}>$</span>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1,
                  padding: "12px 0 12px 8px",
                  border: "none",
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#0A2342",
                  outline: "none",
                  background: "transparent",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setIsDepositModalOpen(false)
                  setDepositAmount("")
                  setDepositError(null)
                }}
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
                onClick={handleDeposit}
                disabled={isDepositing || !depositAmount || Number.parseFloat(depositAmount) <= 0}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: depositAmount && Number.parseFloat(depositAmount) > 0
                    ? "#00C6AE"
                    : "#E5E7EB",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: depositAmount && Number.parseFloat(depositAmount) > 0
                    ? "#FFFFFF"
                    : "#6B7280",
                  cursor: depositAmount && Number.parseFloat(depositAmount) > 0
                    ? "pointer"
                    : "not-allowed",
                }}
              >
                {isDepositing ? "Adding..." : "Add Money"}
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => setIsDepositModalOpen(true)}
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
          onClick={() => navigateToGoalScreen("040-GOAL-T05-WithdrawalAmount", { goalId: goal.id })}
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
