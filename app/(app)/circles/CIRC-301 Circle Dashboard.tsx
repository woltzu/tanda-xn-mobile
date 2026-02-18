"use client"

export default function CircleDashboard() {
  const circle = {
    id: "circle_123",
    name: "Family Savings",
    status: "active",
    type: "traditional",
    amount: 200,
    frequency: "monthly",
    size: 6,
    currentCycle: 3,
    totalCycles: 6,
    potAmount: 1200,
    nextPayoutDate: "Jan 15, 2025",
    nextPayoutMember: "Marie C.",
    isAdmin: true,
  }

  const myStatus = {
    hasContributed: true,
    nextContributionDue: "Jan 10, 2025",
    myPayoutPosition: 4,
    totalContributed: 600,
    payoutReceived: false,
  }

  const members = [
    { id: 1, name: "You (Admin)", avatar: "F", status: "contributed", xnScore: 75, payoutPosition: 4 },
    { id: 2, name: "Amara O.", avatar: "A", status: "contributed", xnScore: 78, payoutPosition: 1 },
    { id: 3, name: "Kwame M.", avatar: "K", status: "pending", xnScore: 85, payoutPosition: 2 },
    { id: 4, name: "Marie C.", avatar: "M", status: "contributed", xnScore: 81, payoutPosition: 3 },
    { id: 5, name: "David N.", avatar: "D", status: "contributed", xnScore: 68, payoutPosition: 5 },
    { id: 6, name: "Samuel O.", avatar: "S", status: "late", xnScore: 75, payoutPosition: 6 },
  ]

  const progressPercent = (circle.currentCycle / circle.totalCycles) * 100

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "contributed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Paid" }
      case "pending":
        return { bg: "#FEF3C7", color: "#D97706", label: "Due" }
      case "late":
        return { bg: "#FEE2E2", color: "#DC2626", label: "Late" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header - Navy */}
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
            gap: "12px",
            marginBottom: "20px",
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
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{circle.name}</h1>
              {circle.isAdmin && (
                <span
                  style={{
                    background: "#00C6AE",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: "700",
                  }}
                >
                  ADMIN
                </span>
              )}
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Cycle {circle.currentCycle} of {circle.totalCycles}
            </p>
          </div>
          <button
            onClick={() => console.log("Settings")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", opacity: 0.7 }}>Circle Progress</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>{Math.round(progressPercent)}%</span>
          </div>
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
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>${circle.potAmount.toLocaleString()}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.7 }}>Current pot</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>{circle.nextPayoutMember}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.7 }}>
                Next payout: {circle.nextPayoutDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* My Status Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Your Status</h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <div style={{ flex: 1, padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                ${myStatus.totalContributed}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Contributed</p>
            </div>
            <div style={{ flex: 1, padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                #{myStatus.myPayoutPosition}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Payout position</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: myStatus.hasContributed ? "#F0FDFB" : "#FEF3C7",
                borderRadius: "10px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "700",
                  color: myStatus.hasContributed ? "#00897B" : "#D97706",
                }}
              >
                {myStatus.hasContributed ? "✓ Paid" : "Due"}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>This cycle</p>
            </div>
          </div>

          {!myStatus.hasContributed && (
            <button
              onClick={() => console.log("Contribute")}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Contribute ${circle.amount} Now
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          {[
            { id: "members", icon: "👥", label: "Members", badge: null },
            { id: "contributions", icon: "💵", label: "History", badge: null },
            { id: "payouts", icon: "📤", label: "Payouts", badge: null },
            { id: "chat", icon: "💬", label: "Chat", badge: 3 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => console.log(item.label)}
              style={{
                background: "#FFFFFF",
                borderRadius: "12px",
                padding: "14px 8px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                position: "relative",
              }}
            >
              <span style={{ fontSize: "22px" }}>{item.icon}</span>
              <span style={{ fontSize: "11px", color: "#6B7280", fontWeight: "500" }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "#DC2626",
                    color: "#FFFFFF",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    fontSize: "10px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Members List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Members ({members.length})
            </h3>
            <button
              onClick={() => console.log("View All Members")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              View All
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {members.slice(0, 4).map((member) => {
              const statusStyle = getStatusBadge(member.status)
              return (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: member.name.includes("You") ? "#00C6AE" : "#0A2342",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {member.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                      Payout #{member.payoutPosition}
                    </p>
                  </div>
                  <span
                    style={{
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      fontWeight: "600",
                    }}
                  >
                    {statusStyle.label}
                  </span>
                </div>
              )
            })}
            {members.length > 4 && (
              <button
                onClick={() => console.log("View All Members")}
                style={{
                  padding: "10px",
                  background: "none",
                  border: "none",
                  color: "#6B7280",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                +{members.length - 4} more members
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      {!myStatus.hasContributed && (
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
            onClick={() => console.log("Contribute")}
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
            Contribute ${circle.amount}
          </button>
        </div>
      )}
    </div>
  )
}
