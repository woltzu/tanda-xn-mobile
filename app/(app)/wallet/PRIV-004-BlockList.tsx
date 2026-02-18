"use client"

import { useState } from "react"

export default function BlockListScreen() {
  const blockedUsers = [
    { id: "u1", name: "John Doe", avatar: "JD", blockedDate: "Dec 20, 2025", reason: "Spam messages" },
    { id: "u2", name: "Unknown User", avatar: "U", blockedDate: "Nov 15, 2025", reason: "Harassment" },
    { id: "u3", name: "Fake Account", avatar: "FA", blockedDate: "Oct 8, 2025", reason: "Suspected fraud" },
  ]

  const [showUnblockConfirm, setShowUnblockConfirm] = useState(null)

  const handleUnblock = (user) => {
    console.log("Unblocking user:", user)
    setShowUnblockConfirm(null)
  }

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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Blocked Users</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{blockedUsers.length} blocked</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* What Blocking Does */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            🚫 <strong>Blocked users can't:</strong> Message you, invite you to circles, see your profile, or find you
            in search. They won't know they're blocked.
          </p>
        </div>

        {/* Block List */}
        {blockedUsers.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "60px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <span style={{ fontSize: "48px" }}>✨</span>
            <p style={{ margin: "16px 0 4px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              No blocked users
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>You haven't blocked anyone yet</p>
          </div>
        ) : (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            {blockedUsers.map((user, idx) => (
              <div
                key={user.id}
                style={{
                  padding: "16px",
                  borderBottom: idx < blockedUsers.length - 1 ? "1px solid #F5F7FA" : "none",
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
                    background: "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  {user.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {user.name}
                  </p>
                  <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#6B7280" }}>Blocked: {user.blockedDate}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Reason: {user.reason}</p>
                </div>
                <button
                  onClick={() => setShowUnblockConfirm(user)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                    cursor: "pointer",
                  }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Block New User Button */}
        <button
          onClick={() => console.log("Block new user")}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "16px",
            borderRadius: "14px",
            border: "2px dashed #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "600",
            color: "#6B7280",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          Block a User
        </button>

        {/* Info Note */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>💡 Tips</h4>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#6B7280", lineHeight: 1.8 }}>
            <li>Block users from their profile or from messages</li>
            <li>You can unblock someone anytime</li>
            <li>If someone is harassing you, consider reporting them too</li>
          </ul>
        </div>
      </div>

      {/* Unblock Confirmation Modal */}
      {showUnblockConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,35,66,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "340px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "24px",
                fontWeight: "600",
                color: "#6B7280",
              }}
            >
              {showUnblockConfirm.avatar}
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Unblock {showUnblockConfirm.name}?
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
              They'll be able to message you and see your profile again. They won't be notified.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowUnblockConfirm(null)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnblock(showUnblockConfirm)}
                style={{
                  flex: 1,
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
                Unblock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
