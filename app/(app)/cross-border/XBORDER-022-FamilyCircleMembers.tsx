"use client"

export default function FamilyCircleMembersScreen() {
  const circle = {
    name: "Mama & Papa Support",
    members: [
      { id: "m1", name: "You", email: "you@email.com", isAdmin: true, contributed: true, amount: 100 },
      { id: "m2", name: "Marcel Ndong", email: "marcel@email.com", isAdmin: false, contributed: true, amount: 100 },
      { id: "m3", name: "Claire Ndong", email: "claire@email.com", isAdmin: false, contributed: true, amount: 100 },
      { id: "m4", name: "Pierre Ndong", email: "pierre@email.com", isAdmin: false, contributed: false, amount: 0 },
    ],
    inviteCode: "MAMA-2025-XYZ",
  }

  const shareInvite = () => {
    const message = `Join our Family Circle "${circle.name}" on TandaXn to support family together! Use code: ${circle.inviteCode} or click: https://tandaxn.com/join/${circle.inviteCode}`
    if (navigator.share) {
      navigator.share({ title: "Join Family Circle", text: message })
    } else {
      navigator.clipboard?.writeText(message)
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
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <button
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Circle Members</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {circle.name} • {circle.members.length} members
            </p>
          </div>
        </div>

        {/* Invite Banner */}
        <button
          onClick={shareInvite}
          style={{
            width: "100%",
            padding: "14px",
            background: "rgba(0,198,174,0.2)",
            borderRadius: "12px",
            border: "1px solid rgba(0,198,174,0.4)",
            cursor: "pointer",
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
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Invite More Family</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              Share invite link via WhatsApp or SMS
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Members List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {circle.members.map((member, idx) => (
            <div
              key={member.id}
              style={{
                padding: "14px 16px",
                borderBottom: idx < circle.members.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: member.contributed ? "#00C6AE" : "#E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: member.contributed ? "#FFFFFF" : "#6B7280",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                {member.contributed ? "✓" : member.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
                  {member.isAdmin && (
                    <span
                      style={{
                        padding: "2px 6px",
                        background: "#0A2342",
                        color: "#FFFFFF",
                        fontSize: "9px",
                        fontWeight: "600",
                        borderRadius: "4px",
                      }}
                    >
                      ADMIN
                    </span>
                  )}
                </div>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{member.email}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                {member.contributed ? (
                  <span
                    style={{
                      padding: "4px 10px",
                      background: "#F0FDFB",
                      color: "#00897B",
                      fontSize: "12px",
                      fontWeight: "600",
                      borderRadius: "6px",
                    }}
                  >
                    ${member.amount}
                  </span>
                ) : (
                  <button
                    style={{
                      padding: "6px 12px",
                      background: "#FEF3C7",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#D97706",
                      cursor: "pointer",
                    }}
                  >
                    Remind
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite Code */}
        <div
          style={{
            marginTop: "16px",
            background: "#F5F7FA",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Circle Invite Code</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#0A2342",
                fontFamily: "monospace",
                letterSpacing: "2px",
              }}
            >
              {circle.inviteCode}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(circle.inviteCode)}
              style={{
                padding: "6px 12px",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#6B7280",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
          </div>
        </div>

        {/* Tip */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
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
            Members can join by downloading TandaXn and entering your invite code, or by clicking the shared link.
          </p>
        </div>
      </div>

      {/* Add Member Button */}
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
          onClick={shareInvite}
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
          Invite Family Member
        </button>
      </div>
    </div>
  )
}
