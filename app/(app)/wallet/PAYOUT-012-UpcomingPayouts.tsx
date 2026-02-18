"use client"

export default function UpcomingPayoutsScreen() {
  const upcomingPayouts = [
    {
      id: "c1",
      circleName: "Family Savings Circle",
      emoji: "👨‍👩‍👧‍👦",
      myPosition: 7,
      currentPosition: 3,
      totalMembers: 12,
      nextPayoutDate: "Feb 1, 2025",
      estimatedAmount: 1200,
      daysUntil: 22,
      frequency: "Monthly",
    },
    {
      id: "c2",
      circleName: "Home Buyers Circle",
      emoji: "🏠",
      myPosition: 2,
      currentPosition: 1,
      totalMembers: 8,
      nextPayoutDate: "Jan 15, 2025",
      estimatedAmount: 4000,
      daysUntil: 5,
      frequency: "Monthly",
    },
    {
      id: "c3",
      circleName: "Business Investment",
      emoji: "💼",
      myPosition: 5,
      currentPosition: 4,
      totalMembers: 10,
      nextPayoutDate: "Jan 20, 2025",
      estimatedAmount: 2500,
      daysUntil: 10,
      frequency: "Bi-weekly",
    },
  ]

  const totalUpcoming = 7700

  const getPositionStatus = (myPos: number, currentPos: number) => {
    const remaining = myPos - currentPos
    if (remaining <= 0) return { label: "Already received", color: "#6B7280", bg: "#F5F7FA" }
    if (remaining === 1) return { label: "You're next!", color: "#059669", bg: "#F0FDFB" }
    if (remaining <= 3) return { label: "Coming soon", color: "#D97706", bg: "#FEF3C7" }
    return { label: `${remaining} rounds away`, color: "#0A2342", bg: "#F5F7FA" }
  }

  const sortedPayouts = [...upcomingPayouts].sort((a, b) => a.daysUntil - b.daysUntil)

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
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Upcoming Payouts</h1>
        </div>

        {/* Total Upcoming */}
        <div
          style={{
            background: "rgba(0,198,174,0.15)",
            borderRadius: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Total Expected Payouts</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>
            ${totalUpcoming.toLocaleString()}
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
            From {upcomingPayouts.length} active circles
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Payout Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {sortedPayouts.map((payout) => {
            const status = getPositionStatus(payout.myPosition, payout.currentPosition)
            const isNext = payout.myPosition - payout.currentPosition === 1

            return (
              <div
                key={payout.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  border: isNext ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isNext && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      padding: "4px 12px",
                      fontSize: "10px",
                      fontWeight: "700",
                      borderBottomLeftRadius: "8px",
                    }}
                  >
                    YOU'RE NEXT!
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "14px",
                      background: "#F0FDFB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "28px",
                    }}
                  >
                    {payout.emoji}
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {payout.circleName}
                    </p>

                    {/* Position Progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          background: "#E5E7EB",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(payout.currentPosition / payout.totalMembers) * 100}%`,
                            height: "100%",
                            background: "#00C6AE",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>
                        {payout.currentPosition}/{payout.totalMembers}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: status.bg,
                          color: status.color,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}
                      >
                        Position {payout.myPosition} • {status.label}
                      </span>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>{payout.frequency}</span>
                    </div>
                  </div>
                </div>

                {/* Payout Info */}
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid #F3F4F6",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Expected</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                      ${payout.estimatedAmount.toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Your payout date</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {payout.nextPayoutDate}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button
                    onClick={() => console.log("View circle:", payout.id)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: "#F5F7FA",
                      borderRadius: "10px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#0A2342",
                      cursor: "pointer",
                    }}
                  >
                    View Circle
                  </button>
                  <button
                    onClick={() => console.log("Set reminder:", payout.id)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: "#F0FDFB",
                      borderRadius: "10px",
                      border: "1px solid #00C6AE",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#00C6AE",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    Remind Me
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Timeline Info */}
        <div
          style={{
            marginTop: "16px",
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
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
            <strong>Payout dates are estimates</strong> based on current contribution schedules. Actual dates may vary
            if members pay early or late.
          </p>
        </div>
      </div>
    </div>
  )
}
