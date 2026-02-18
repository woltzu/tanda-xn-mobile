"use client"

export default function CirclePayoutsScreen() {
  const circle = { name: "Family Savings", amount: 200, size: 6, potAmount: 1200, currentCycle: 3 }
  const payouts = [
    { id: 1, cycle: 1, member: "Amara O.", avatar: "A", amount: 1200, date: "Nov 15, 2024", status: "completed" },
    { id: 2, cycle: 2, member: "Kwame M.", avatar: "K", amount: 1200, date: "Dec 15, 2024", status: "completed" },
    { id: 3, cycle: 3, member: "Marie C.", avatar: "M", amount: 1200, date: "Jan 15, 2025", status: "upcoming" },
    {
      id: 4,
      cycle: 4,
      member: "Franck (You)",
      avatar: "F",
      amount: 1200,
      date: "Feb 15, 2025",
      status: "scheduled",
      isYou: true,
    },
    { id: 5, cycle: 5, member: "David N.", avatar: "D", amount: 1200, date: "Mar 15, 2025", status: "scheduled" },
    { id: 6, cycle: 6, member: "Samuel O.", avatar: "S", amount: 1200, date: "Apr 15, 2025", status: "scheduled" },
  ]

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Paid" }
      case "upcoming":
        return { bg: "#FEF3C7", color: "#D97706", label: "Next" }
      case "scheduled":
        return { bg: "#F5F7FA", color: "#6B7280", label: "Scheduled" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
    }
  }

  const completedPayouts = payouts.filter((p) => p.status === "completed").length
  const yourPayout = payouts.find((p) => p.isYou && p.status !== "completed")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header - Navy gradient */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payout Schedule</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle.name}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>${circle.potAmount.toLocaleString()}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Per Payout</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
              {completedPayouts}/{circle.size}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Completed</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Rotation Schedule Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Rotation Schedule
          </h3>

          {/* Timeline */}
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: "20px",
                top: "20px",
                bottom: "20px",
                width: "2px",
                background: "#E5E7EB",
              }}
            />

            {/* Payout Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {payouts.map((payout) => {
                const statusStyle = getStatusStyle(payout.status)
                const isCompleted = payout.status === "completed"
                const isNext = payout.status === "upcoming"

                return (
                  <button
                    key={payout.id}
                    onClick={() => console.log("Payout details", payout)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      paddingLeft: "52px",
                      background: payout.isYou ? "#F0FDFB" : isNext ? "#FEF3C7" : "#F5F7FA",
                      borderRadius: "12px",
                      border: payout.isYou ? "2px solid #00C6AE" : isNext ? "2px solid #D97706" : "none",
                      cursor: "pointer",
                      textAlign: "left",
                      position: "relative",
                    }}
                  >
                    {/* Timeline dot */}
                    <div
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: isCompleted ? "#00C6AE" : isNext ? "#D97706" : "#E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1,
                      }}
                    >
                      {isCompleted && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>

                    {/* Payout content */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: payout.isYou ? "#00C6AE" : "#0A2342",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "600",
                          fontSize: "16px",
                        }}
                      >
                        {payout.avatar}
                      </div>

                      {/* Member Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{payout.member}</span>
                          {payout.isYou && (
                            <span
                              style={{
                                background: "#00C6AE",
                                color: "#FFFFFF",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "9px",
                                fontWeight: "700",
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                          Cycle {payout.cycle} • {payout.date}
                        </p>
                      </div>

                      {/* Amount & Status */}
                      <div style={{ textAlign: "right" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "16px",
                            fontWeight: "700",
                            color: isCompleted ? "#00C6AE" : "#0A2342",
                          }}
                        >
                          ${payout.amount.toLocaleString()}
                        </p>
                        <span
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "600",
                          }}
                        >
                          {statusStyle.label}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Your Payout Card */}
        {yourPayout && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
              marginTop: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "rgba(0,198,174,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                💰
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                  Your Payout is Coming
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                  Cycle {yourPayout.cycle} • {yourPayout.date}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                  ${circle.potAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>How it works:</strong> Each cycle, all members contribute ${circle.amount}. The full pot of $
            {circle.potAmount.toLocaleString()} goes to one member based on rotation order.
          </p>
        </div>
      </div>
    </div>
  )
}
