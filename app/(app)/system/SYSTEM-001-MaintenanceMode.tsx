"use client"

import { useState, useEffect } from "react"

export default function MaintenanceModeScreen() {
  const [estimatedReturn] = useState("2:00 PM EST")
  const [countdown, setCountdown] = useState({ hours: 1, minutes: 30, seconds: 0 })
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 }
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 }
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 }
        }
        return prev
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    console.log("Checking again...")
    setTimeout(() => {
      setIsRefreshing(false)
      // In production, this would check if maintenance is over
      window.location.reload()
    }, 1500)
  }

  const handleNotifyMe = () => {
    console.log("Will notify when back online")
  }

  const padZero = (num: number) => num.toString().padStart(2, "0")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0A2342 0%, #143654 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
        color: "#FFFFFF",
      }}
    >
      {/* Logo */}
      <div
        style={{
          marginBottom: "32px",
          opacity: 0.9,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#00C6AE" strokeWidth="2" />
          <path d="M12 6v6l4 2" stroke="#00C6AE" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {/* Illustration */}
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
          position: "relative",
        }}
      >
        <span style={{ fontSize: "52px" }}>{String.fromCodePoint(0x1f527)}</span>
        {/* Animated pulse */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: "50%",
            border: "2px solid rgba(0,198,174,0.3)",
            animation: "pulse 2s infinite",
          }}
        />
      </div>

      {/* Content */}
      <h2 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700" }}>Under Maintenance</h2>
      <p style={{ margin: "0 0 24px 0", fontSize: "15px", opacity: 0.8, maxWidth: "300px", lineHeight: 1.6 }}>
        We're making TandaXn even better. We'll be back shortly.
      </p>

      {/* Countdown Timer */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {[
          { value: countdown.hours, label: "Hours" },
          { value: countdown.minutes, label: "Minutes" },
          { value: countdown.seconds, label: "Seconds" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "16px 20px",
              minWidth: "70px",
            }}
          >
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
              {padZero(item.value)}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "10px", opacity: 0.7, textTransform: "uppercase" }}>
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Expected Return Card */}
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: "12px",
          padding: "14px 24px",
          marginBottom: "32px",
        }}
      >
        <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Expected return</p>
        <p style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>{estimatedReturn}</p>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "300px" }}>
        {/* Notify Me Button */}
        <button
          onClick={handleNotifyMe}
          style={{
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Notify Me When Back
        </button>

        {/* Check Again Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.3)",
            background: "transparent",
            fontSize: "15px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: isRefreshing ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            opacity: isRefreshing ? 0.7 : 1,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              animation: isRefreshing ? "spin 1s linear infinite" : "none",
            }}
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {isRefreshing ? "Checking..." : "Check Again"}
        </button>
      </div>

      {/* What We're Working On */}
      <div
        style={{
          marginTop: "40px",
          padding: "16px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "12px",
          maxWidth: "300px",
          width: "100%",
        }}
      >
        <p style={{ margin: "0 0 12px 0", fontSize: "12px", opacity: 0.7 }}>What we're improving:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {["Faster transactions", "Enhanced security", "Bug fixes"].map((item, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: "13px", opacity: 0.8 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Support Link */}
      <p style={{ marginTop: "32px", fontSize: "12px", opacity: 0.6 }}>
        Questions?{" "}
        <button
          onClick={() => console.log("Contact support")}
          style={{
            background: "none",
            border: "none",
            color: "#00C6AE",
            fontSize: "12px",
            fontWeight: "500",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Contact Support
        </button>
      </p>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
