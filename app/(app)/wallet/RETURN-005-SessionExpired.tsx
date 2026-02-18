"use client"

import { useState } from "react"

export default function SessionExpiredScreen() {
  const [user] = useState({
    firstName: "Franck",
    email: "f***@gmail.com",
  })
  const [reason] = useState<"inactivity" | "security" | "password_changed" | "other_device">("inactivity")
  const [supportsBiometric] = useState(true)

  const getReasonMessage = () => {
    switch (reason) {
      case "inactivity":
        return {
          icon: "⏰",
          title: "Session Expired",
          message: "For your security, we logged you out after a period of inactivity.",
        }
      case "security":
        return {
          icon: "🔒",
          title: "Security Check",
          message: "We noticed some unusual activity. Please log in again to verify it's you.",
        }
      case "password_changed":
        return {
          icon: "🔑",
          title: "Password Updated",
          message: "Your password was recently changed. Please log in with your new password.",
        }
      case "other_device":
        return {
          icon: "📱",
          title: "Logged In Elsewhere",
          message: "Your account was accessed from another device. Please log in again.",
        }
      default:
        return {
          icon: "👋",
          title: "Welcome Back",
          message: "Please log in to continue where you left off.",
        }
    }
  }

  const reasonData = getReasonMessage()

  const handleReLogin = () => {
    console.log("Re-logging in")
  }

  const handleSwitchAccount = () => {
    console.log("Switching account")
  }

  const handleForgotPassword = () => {
    console.log("Forgot password")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Main Content */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 20px" }}
      >
        {/* Icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "24px",
            background: "rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto",
            fontSize: "40px",
          }}
        >
          {reasonData.icon}
        </div>

        {/* Title */}
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "28px",
            fontWeight: "700",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          {reasonData.title}
        </h1>

        <p
          style={{
            margin: "0 0 32px 0",
            fontSize: "14px",
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
            lineHeight: 1.5,
            maxWidth: "300px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {reasonData.message}
        </p>

        {/* User Account Preview */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: "#FFFFFF",
              fontWeight: "700",
            }}
          >
            {user.firstName.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#FFFFFF" }}>{user.firstName}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{user.email}</p>
          </div>
          <button
            onClick={handleSwitchAccount}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            Switch
          </button>
        </div>

        {/* Login Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Biometric Login */}
          {supportsBiometric && (
            <button
              onClick={handleReLogin}
              style={{
                width: "100%",
                padding: "18px",
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
                gap: "10px",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a4 4 0 0 1 4 4v6" />
                <path d="M8 5a4 4 0 0 1 8 0v6" />
                <path d="M1 12v3a10 10 0 0 0 20 0v-3" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
              Log In with Face ID
            </button>
          )}

          {/* Password Login */}
          <button
            onClick={handleReLogin}
            style={{
              width: "100%",
              padding: "18px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "transparent",
              fontSize: "16px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Log In with Password
          </button>
        </div>

        {/* Forgot Password */}
        <button
          onClick={handleForgotPassword}
          style={{
            marginTop: "20px",
            background: "none",
            border: "none",
            fontSize: "14px",
            color: "#00C6AE",
            fontWeight: "500",
            cursor: "pointer",
            textAlign: "center",
            width: "100%",
          }}
        >
          Forgot password?
        </button>
      </div>

      {/* Security Note */}
      <div style={{ padding: "20px", paddingBottom: "40px" }}>
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
            Your data is protected. We use bank-level encryption.
          </p>
        </div>
      </div>
    </div>
  )
}
