"use client"

import { useState } from "react"

export default function DeleteAccountScreen() {
  const [confirmText, setConfirmText] = useState("")
  const [reason, setReason] = useState("")
  const [isAccountDeleted, setIsAccountDeleted] = useState(false)

  const reasons = [
    "I don't use the app anymore",
    "I found a better alternative",
    "Privacy concerns",
    "Too many fees",
    "Other",
  ]

  const canDelete = confirmText.toLowerCase() === "delete" && reason

  const handleBack = () => {
    console.log("Navigating back...")
  }

  const handleCancel = () => {
    console.log("Cancelled account deletion")
  }

  const handleConfirmDelete = () => {
    console.log("Account deletion confirmed with reason:", reason)
    setIsAccountDeleted(true)
  }

  const handleClose = () => {
    console.log("Closing app...")
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
      {isAccountDeleted ? (
        <div
          style={{
            minHeight: "100vh",
            background: "#F5F7FA",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "32px",
            }}
          >
            <span style={{ fontSize: "52px" }}>👋</span>
          </div>

          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "24px",
              fontWeight: "700",
              color: "#0A2342",
            }}
          >
            Goodbye
          </h2>
          <p
            style={{
              margin: "0 0 24px 0",
              fontSize: "15px",
              color: "#6B7280",
              maxWidth: "300px",
              lineHeight: 1.6,
            }}
          >
            Your account has been deleted. We're sorry to see you go.
          </p>

          <p
            style={{
              margin: "0 0 32px 0",
              fontSize: "13px",
              color: "#9CA3AF",
              maxWidth: "280px",
            }}
          >
            If you change your mind, you're always welcome to create a new account.
          </p>

          <button
            onClick={handleClose}
            style={{
              padding: "14px 32px",
              borderRadius: "12px",
              border: "none",
              background: "#0A2342",
              fontSize: "15px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Close App
          </button>
        </div>
      ) : (
        <>
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
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Delete Account</h1>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "20px" }}>
            {/* Warning */}
            <div
              style={{
                background: "#FEE2E2",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <span style={{ fontSize: "24px" }}>{"⚠️"}</span>
                <div>
                  <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#DC2626" }}>
                    This action cannot be undone
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#B91C1C", lineHeight: 1.7 }}>
                    <li>All your data will be permanently deleted</li>
                    <li>{"You'll lose access to your savings circles"}</li>
                    <li>Your XnScore history will be erased</li>
                    <li>Any pending payouts will be forfeited</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Why are you leaving?
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {reasons.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      border: reason === r ? "2px solid #0A2342" : "1px solid #E5E7EB",
                      background: reason === r ? "#F5F7FA" : "#FFFFFF",
                      fontSize: "13px",
                      color: "#0A2342",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirmation */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#0A2342",
                  marginBottom: "8px",
                }}
              >
                Type "DELETE" to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "14px",
                  color: "#0A2342",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "#FFFFFF",
              padding: "16px 20px 32px 20px",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              gap: "12px",
            }}
          >
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "16px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={!canDelete}
              style={{
                flex: 1,
                padding: "16px",
                borderRadius: "14px",
                border: "none",
                background: canDelete ? "#DC2626" : "#E5E7EB",
                fontSize: "16px",
                fontWeight: "600",
                color: canDelete ? "#FFFFFF" : "#9CA3AF",
                cursor: canDelete ? "pointer" : "not-allowed",
              }}
            >
              Delete Account
            </button>
          </div>
        </>
      )}
    </div>
  )
}
