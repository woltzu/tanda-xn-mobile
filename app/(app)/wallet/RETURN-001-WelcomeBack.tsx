"use client"

export default function WelcomeBackScreen() {
  const user = {
    firstName: "Franck",
    lastVisit: "3 days ago",
    avatar: null,
  }

  const summary = {
    newNotifications: 5,
    pendingPayments: 1,
    upcomingPayout: { amount: 1200, daysUntil: 4, circleName: "Family Savings" },
    xnScoreChange: 12,
    currentXnScore: 742,
    totalSaved: 4850,
    activeCircles: 2,
    activeGoals: 3,
  }

  const alerts = [
    { id: "a1", type: "payment_due", message: "Payment due tomorrow", urgency: "high" },
    { id: "a2", type: "payout_coming", message: "Payout in 4 days", urgency: "low" },
  ]

  const getTimeGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  const urgentAlerts = alerts.filter((a) => a.urgency === "high")

  const handleDismiss = () => {
    console.log("Dismissing alert...")
  }

  const handleViewNotifications = () => {
    console.log("View notifications...")
  }

  const handleMakePayment = () => {
    console.log("Make payment...")
  }

  const handleGoToDashboard = () => {
    console.log("Go to dashboard...")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header - Navy with Welcome */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "24px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>{getTimeGreeting()},</p>
            <h1 style={{ margin: "4px 0 0 0", fontSize: "26px", fontWeight: "700" }}>
              Welcome back, {user.firstName}! 👋
            </h1>
          </div>
          <button
            onClick={handleViewNotifications}
            style={{
              position: "relative",
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {summary.newNotifications > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                }}
              >
                {summary.newNotifications}
              </div>
            )}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "13px", opacity: 0.7 }}>Last visit: {user.lastVisit}</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Urgent Alert (if any) */}
        {urgentAlerts.length > 0 && (
          <button
            onClick={handleMakePayment}
            style={{
              width: "100%",
              padding: "16px",
              background: "#FEF3C7",
              borderRadius: "14px",
              border: "1px solid #D97706",
              cursor: "pointer",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#92400E" }}>Action Required</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#B45309" }}>{urgentAlerts[0].message}</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Quick Stats Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Your Progress</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ padding: "14px", background: "#F5F7FA", borderRadius: "12px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280", fontWeight: "500" }}>Total Saved</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "22px", fontWeight: "700", color: "#0A2342" }}>
                ${summary.totalSaved.toLocaleString()}
              </p>
            </div>
            <div style={{ padding: "14px", background: "#F0FDFB", borderRadius: "12px" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280", fontWeight: "500" }}>XnScore</p>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
                  {summary.currentXnScore}
                </p>
                <span
                  style={{
                    padding: "2px 6px",
                    background: summary.xnScoreChange >= 0 ? "#F0FDFB" : "#FEE2E2",
                    color: summary.xnScoreChange >= 0 ? "#00897B" : "#DC2626",
                    fontSize: "10px",
                    fontWeight: "700",
                    borderRadius: "4px",
                  }}
                >
                  {summary.xnScoreChange >= 0 ? "+" : ""}
                  {summary.xnScoreChange}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
            <div style={{ flex: 1, padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                {summary.activeCircles}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Active Circles</p>
            </div>
            <div style={{ flex: 1, padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{summary.activeGoals}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Savings Goals</p>
            </div>
          </div>
        </div>

        {/* Upcoming Payout */}
        {summary.upcomingPayout && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Next Payout</p>
              <span
                style={{
                  padding: "4px 10px",
                  background: "rgba(0,198,174,0.2)",
                  color: "#00C6AE",
                  fontSize: "11px",
                  fontWeight: "600",
                  borderRadius: "6px",
                }}
              >
                In {summary.upcomingPayout.daysUntil} days
              </span>
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: "32px", fontWeight: "700", color: "#00C6AE" }}>
              ${summary.upcomingPayout.amount.toLocaleString()}
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              from {summary.upcomingPayout.circleName}
            </p>
          </div>
        )}

        {/* What's New */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Since You've Been Away
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {summary.newNotifications > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#0A2342" }}>
                  <strong>{summary.newNotifications}</strong> new notifications
                </p>
              </div>
            )}
            {summary.pendingPayments > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  background: "#FEF3C7",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#92400E" }}>
                  <strong>{summary.pendingPayments}</strong> payment{summary.pendingPayments > 1 ? "s" : ""} due soon
                </p>
              </div>
            )}
            {summary.xnScoreChange > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  background: "#F0FDFB",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#065F46" }}>
                  XnScore increased by <strong>+{summary.xnScoreChange}</strong> points
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <button
          onClick={handleGoToDashboard}
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
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
