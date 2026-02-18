"use client"

export default function ActiveSessionsScreen() {
  const sessions = [
    {
      id: "s1",
      device: "iPhone 14 Pro",
      browser: "TandaXn App",
      location: "Atlanta, GA",
      lastActive: "Now",
      isCurrent: true,
      deviceType: "mobile",
    },
    {
      id: "s2",
      device: "MacBook Pro",
      browser: "Chrome",
      location: "Atlanta, GA",
      lastActive: "2 hours ago",
      isCurrent: false,
      deviceType: "desktop",
    },
    {
      id: "s3",
      device: "iPad Air",
      browser: "TandaXn App",
      location: "New York, NY",
      lastActive: "3 days ago",
      isCurrent: false,
      deviceType: "tablet",
    },
  ]

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "mobile":
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        )
      case "desktop":
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        )
      case "tablet":
        return (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        )
      default:
        return null
    }
  }

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleLogoutSession = (session: any) => {
    console.log("Log out session:", session)
  }

  const handleLogoutAll = () => {
    console.log("Log out all sessions")
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
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={handleBack}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Active Sessions</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {sessions.length} device{sessions.length !== 1 ? "s" : ""} logged in
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Current Session */}
        {sessions
          .filter((s) => s.isCurrent)
          .map((session) => (
            <div
              key={session.id}
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "2px solid #00C6AE",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#00C6AE",
                  }}
                >
                  {getDeviceIcon(session.deviceType)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{session.device}</p>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: "#00C6AE",
                        color: "#FFFFFF",
                        fontSize: "9px",
                        fontWeight: "700",
                        borderRadius: "4px",
                      }}
                    >
                      THIS DEVICE
                    </span>
                  </div>
                  <p style={{ margin: "0 0 2px 0", fontSize: "12px", color: "#6B7280" }}>{session.browser}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>{session.location}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#00C6AE", fontWeight: "600" }}>• Active now</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {/* Other Sessions */}
        {sessions.filter((s) => !s.isCurrent).length > 0 && (
          <>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Other Sessions
            </h3>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E5E7EB",
                overflow: "hidden",
                marginBottom: "16px",
              }}
            >
              {sessions
                .filter((s) => !s.isCurrent)
                .map((session, idx, arr) => (
                  <div
                    key={session.id}
                    style={{
                      padding: "16px",
                      borderBottom: idx < arr.length - 1 ? "1px solid #F5F7FA" : "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "#F5F7FA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0A2342",
                      }}
                    >
                      {getDeviceIcon(session.deviceType)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                        {session.device}
                      </p>
                      <p style={{ margin: "0 0 2px 0", fontSize: "12px", color: "#6B7280" }}>{session.browser}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span style={{ fontSize: "11px", color: "#6B7280" }}>{session.location}</span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#6B7280" }}>• {session.lastActive}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLogoutSession(session)}
                      style={{
                        padding: "8px 12px",
                        background: "#FEE2E2",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#DC2626",
                        cursor: "pointer",
                      }}
                    >
                      Log Out
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}

        {/* Security Note */}
        <div
          style={{
            padding: "14px",
            background: "#FEF3C7",
            borderRadius: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D97706"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
            Don't recognize a session? Log it out immediately and change your password to secure your account.
          </p>
        </div>
      </div>

      {/* Log Out All Button */}
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
          onClick={handleLogoutAll}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #DC2626",
            background: "#FFFFFF",
            fontSize: "16px",
            fontWeight: "600",
            color: "#DC2626",
            cursor: "pointer",
          }}
        >
          Log Out All Other Sessions
        </button>
      </div>
    </div>
  )
}
