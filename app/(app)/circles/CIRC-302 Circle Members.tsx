"use client"

export default function CircleMembers() {
  const circle = {
    name: "Family Savings",
    size: 6,
    currentCycle: 3,
    isAdmin: true,
  }

  const members = [
    {
      id: 1,
      name: "Franck (You)",
      avatar: "F",
      status: "contributed",
      xnScore: 72,
      payoutPosition: 4,
      totalContributed: 600,
      isAdmin: true,
    },
    {
      id: 2,
      name: "Amara Okafor",
      avatar: "A",
      status: "received",
      xnScore: 78,
      payoutPosition: 1,
      totalContributed: 600,
      payoutReceived: true,
    },
    {
      id: 3,
      name: "Kwame Mensah",
      avatar: "K",
      status: "received",
      xnScore: 85,
      payoutPosition: 2,
      totalContributed: 600,
      payoutReceived: true,
    },
    {
      id: 4,
      name: "Marie Claire",
      avatar: "M",
      status: "contributed",
      xnScore: 81,
      payoutPosition: 3,
      totalContributed: 600,
    },
    {
      id: 5,
      name: "David Nguyen",
      avatar: "D",
      status: "pending",
      xnScore: 68,
      payoutPosition: 5,
      totalContributed: 400,
    },
    { id: 6, name: "Samuel Osei", avatar: "S", status: "late", xnScore: 75, payoutPosition: 6, totalContributed: 400 },
  ]

  const getStatusBadge = (status: string, payoutReceived?: boolean) => {
    if (payoutReceived) return { bg: "#F0FDFB", color: "#00897B", label: "Received Payout" }
    switch (status) {
      case "contributed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Paid" }
      case "pending":
        return { bg: "#FEF3C7", color: "#D97706", label: "Due" }
      case "late":
        return { bg: "#FEE2E2", color: "#DC2626", label: "Late" }
      case "received":
        return { bg: "#F0FDFB", color: "#00897B", label: "Received Payout" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: status }
    }
  }

  const sortedMembers = [...members].sort((a, b) => a.payoutPosition - b.payoutPosition)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: circle.isAdmin ? "100px" : "40px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Members</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              {circle.name} • {members.length} members
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Rotation Order Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46" }}>
            <strong>Rotation order</strong> is based on XnScore. Higher scores get earlier payouts.
          </p>
        </div>

        {/* Members List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          {sortedMembers.map((member, idx) => {
            const statusStyle = getStatusBadge(member.status, member.payoutReceived)
            const isPastPayout = member.payoutPosition < circle.currentCycle
            const isCurrentPayout = member.payoutPosition === circle.currentCycle

            return (
              <button
                key={member.id}
                onClick={() => console.log("Member:", member.name)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: isCurrentPayout ? "#F0FDFB" : idx % 2 === 0 ? "#F5F7FA" : "#FFFFFF",
                  borderRadius: "12px",
                  border: isCurrentPayout ? "2px solid #00C6AE" : "none",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: idx < sortedMembers.length - 1 ? "8px" : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: isPastPayout ? "#00C6AE" : isCurrentPayout ? "#0A2342" : "#E5E7EB",
                      color: isPastPayout || isCurrentPayout ? "#FFFFFF" : "#6B7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "14px",
                    }}
                  >
                    {isPastPayout ? "✓" : member.payoutPosition}
                  </div>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: member.name.includes("You") ? "#00C6AE" : "#0A2342",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "600",
                      fontSize: "16px",
                      position: "relative",
                    }}
                  >
                    {member.avatar}
                    {member.isAdmin && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "-2px",
                          right: "-2px",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#FEF3C7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                        }}
                      >
                        👑
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{member.name}</span>
                      <span
                        style={{
                          background: "#F5F7FA",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: "700",
                          color: member.xnScore >= 80 ? "#00C6AE" : "#6B7280",
                        }}
                      >
                        ⭐ {member.xnScore}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      ${member.totalContributed} contributed
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      {statusStyle.label}
                    </span>
                    {isCurrentPayout && (
                      <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "#00C6AE", fontWeight: "600" }}>
                        Next payout
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Admin Actions */}
      {circle.isAdmin && (
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
            onClick={() => console.log("Invite members")}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Invite Members
          </button>
        </div>
      )}
    </div>
  )
}
