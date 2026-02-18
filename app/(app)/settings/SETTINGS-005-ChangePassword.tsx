"use client"

import { useState } from "react"

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "", color: "#E5E7EB" }
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
    if (/\d/.test(pwd)) score++
    if (/[^a-zA-Z0-9]/.test(pwd)) score++

    if (score <= 2) return { score, label: "Weak", color: "#DC2626" }
    if (score <= 3) return { score, label: "Fair", color: "#D97706" }
    if (score <= 4) return { score, label: "Good", color: "#00C6AE" }
    return { score, label: "Strong", color: "#00897B" }
  }

  const strength = getPasswordStrength(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0
  const isValid = currentPassword.length >= 8 && newPassword.length >= 8 && passwordsMatch && strength.score >= 3

  const requirements = [
    { met: newPassword.length >= 8, text: "At least 8 characters" },
    { met: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword), text: "Upper & lowercase letters" },
    { met: /\d/.test(newPassword), text: "At least one number" },
    { met: /[^a-zA-Z0-9]/.test(newPassword), text: "At least one special character" },
  ]

  const handleBack = () => {
    console.log("Go back")
  }

  const handleSave = () => {
    console.log("Save password", { currentPassword, newPassword })
  }

  const handleForgotPassword = () => {
    console.log("Forgot password")
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Change Password</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Create a strong password</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Current Password */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}
          >
            Current Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              style={{
                width: "100%",
                padding: "14px",
                paddingRight: "50px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                color: "#0A2342",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                {showCurrent ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
          <button
            onClick={handleForgotPassword}
            style={{
              marginTop: "8px",
              background: "none",
              border: "none",
              fontSize: "12px",
              color: "#00C6AE",
              fontWeight: "500",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        {/* New Password */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}
          >
            New Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              style={{
                width: "100%",
                padding: "14px",
                paddingRight: "50px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                color: "#0A2342",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                {showNew ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>

          {/* Strength Indicator */}
          {newPassword && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>Password Strength</span>
                <span style={{ fontSize: "11px", fontWeight: "600", color: strength.color }}>{strength.label}</span>
              </div>
              <div style={{ height: "4px", background: "#E5E7EB", borderRadius: "2px" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(strength.score / 5) * 100}%`,
                    background: strength.color,
                    borderRadius: "2px",
                    transition: "width 0.3s, background 0.3s",
                  }}
                />
              </div>
            </div>
          )}

          {/* Requirements */}
          <div style={{ marginTop: "12px" }}>
            {requirements.map((req, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: req.met ? "#00C6AE" : "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {req.met && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: "12px", color: req.met ? "#065F46" : "#6B7280" }}>{req.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirm Password */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}
          >
            Confirm New Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{
                width: "100%",
                padding: "14px",
                paddingRight: "50px",
                borderRadius: "10px",
                border: confirmPassword
                  ? passwordsMatch
                    ? "2px solid #00C6AE"
                    : "2px solid #DC2626"
                  : "1px solid #E5E7EB",
                fontSize: "15px",
                color: "#0A2342",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                {showConfirm ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
          {confirmPassword && !passwordsMatch && (
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#DC2626" }}>Passwords don&apos;t match</p>
          )}
          {passwordsMatch && (
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#00897B" }}>✓ Passwords match</p>
          )}
        </div>
      </div>

      {/* Save Button */}
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
          onClick={handleSave}
          disabled={!isValid}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isValid ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: isValid ? "#FFFFFF" : "#9CA3AF",
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          Update Password
        </button>
      </div>
    </div>
  )
}
