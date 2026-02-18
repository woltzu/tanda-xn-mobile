"use client"

import { useState, useEffect } from "react"

export default function SplashScreen() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  const handleGetStarted = () => {
    console.log("Get Started clicked")
    // TODO: Navigate to Welcome screen
  }

  const handleLogin = () => {
    console.log("Login clicked")
    // TODO: Navigate to Login screen
  }

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0A2342 0%, #132D4E 100%)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background Glow Effect */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(0,198,174,0.15) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {/* Logo Container */}
      <div style={{ marginBottom: "40px", textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            width: "120px",
            height: "120px",
            background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            borderRadius: "30px",
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 60px rgba(0, 198, 174, 0.4)",
            animation: "float 3s ease-in-out infinite",
          }}
        >
          <span
            style={{
              color: "#0A2342",
              fontSize: "48px",
              fontWeight: "800",
            }}
          >
            Xn
          </span>
        </div>

        <h1
          style={{
            color: "#FFFFFF",
            fontSize: "36px",
            fontWeight: "700",
            margin: "0 0 12px 0",
          }}
        >
          TandaXn
        </h1>

        <p
          style={{
            color: "#00C6AE",
            fontSize: "18px",
            fontWeight: "600",
            margin: 0,
            letterSpacing: "0.5px",
          }}
        >
          Save Together. Grow Together.
        </p>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "40px",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#00C6AE",
                opacity: 0.8,
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Buttons - Show after loading */}
      {!isLoading && (
        <div style={{ width: "100%", maxWidth: "300px", zIndex: 1 }}>
          <button
            onClick={handleGetStarted}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
              color: "#0A2342",
              border: "none",
              borderRadius: "14px",
              padding: "18px",
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
              marginBottom: "14px",
              boxShadow: "0 8px 24px rgba(0, 198, 174, 0.3)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)"
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)"
            }}
          >
            Get Started
          </button>

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.1)",
              color: "#FFFFFF",
              border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: "14px",
              padding: "16px",
              fontSize: "18px",
              fontWeight: "600",
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)"
            }}
          >
            I Have an Account
          </button>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(0.7); opacity: 0.4; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
