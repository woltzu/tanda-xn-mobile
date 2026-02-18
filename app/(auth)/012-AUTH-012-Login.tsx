"use client"

import { useState } from "react"
import { Mail, Phone, Lock, Eye, EyeOff, Fingerprint, ChevronRight, AlertCircle } from "lucide-react"

export default function LoginScreen() {
  const [loginMethod, setLoginMethod] = useState("email")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const biometricEnabled = true

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in all fields")
      return
    }

    setIsLoading(true)
    setError("")

    setTimeout(() => {
      setIsLoading(false)
      console.log("Login successful", { identifier, rememberMe })
    }, 1500)
  }

  const handleBiometric = () => {
    console.log("Biometric login")
  }

  const handleForgotPassword = () => {
    console.log("Navigate to forgot password")
  }

  const handleSignUp = () => {
    console.log("Navigate to sign up")
  }

  const inputStyle = {
    width: "100%",
    padding: "16px 16px 16px 48px",
    borderRadius: "14px",
    border: error ? "1px solid #EF4444" : "1px solid #E0E0E0",
    fontSize: "16px",
    boxSizing: "border-box" as const,
    background: "#FFFFFF",
    outline: "none",
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with Logo */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #1A3A5A 100%)",
          padding: "40px 20px 60px 20px",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: "80px",
            height: "80px",
            background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            borderRadius: "20px",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 40px rgba(0, 198, 174, 0.3)",
          }}
        >
          <span style={{ color: "#0A2342", fontSize: "32px", fontWeight: "800" }}>Xn</span>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700", color: "#FFFFFF" }}>Welcome Back</h1>
        <p style={{ margin: 0, fontSize: "15px", color: "rgba(255,255,255,0.8)" }}>
          Sign in to continue your savings journey
        </p>
      </div>

      {/* Form Card */}
      <div
        style={{
          flex: 1,
          background: "#FFFFFF",
          borderRadius: "24px 24px 0 0",
          marginTop: "-30px",
          padding: "30px 20px",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        {/* Login Method Toggle */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "24px",
            background: "#F5F7FA",
            borderRadius: "12px",
            padding: "4px",
          }}
        >
          <button
            onClick={() => setLoginMethod("email")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: loginMethod === "email" ? "#FFFFFF" : "transparent",
              color: loginMethod === "email" ? "#0A2342" : "#666",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: loginMethod === "email" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Mail size={16} />
            Email
          </button>
          <button
            onClick={() => setLoginMethod("phone")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: loginMethod === "phone" ? "#FFFFFF" : "transparent",
              color: loginMethod === "phone" ? "#0A2342" : "#666",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: loginMethod === "phone" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Phone size={16} />
            Phone
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: "12px",
              padding: "12px 14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <AlertCircle size={18} color="#DC2626" />
            <span style={{ color: "#DC2626", fontSize: "14px" }}>{error}</span>
          </div>
        )}

        {/* Email/Phone Input */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "8px",
            }}
          >
            {loginMethod === "email" ? "Email Address" : "Phone Number"}
          </label>
          <div style={{ position: "relative" }}>
            {loginMethod === "email" ? (
              <Mail
                size={20}
                color="#999"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
            ) : (
              <Phone
                size={20}
                color="#999"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
            )}
            <input
              type={loginMethod === "email" ? "email" : "tel"}
              placeholder={loginMethod === "email" ? "marcus@email.com" : "+1 (555) 123-4567"}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value)
                setError("")
              }}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Password Input */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "8px",
            }}
          >
            Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock
              size={20}
              color="#999"
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError("")
              }}
              style={{
                ...inputStyle,
                paddingRight: "48px",
              }}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              type="button"
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showPassword ? <EyeOff size={20} color="#999" /> : <Eye size={20} color="#999" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                accentColor: "#00C6AE",
              }}
            />
            <span style={{ fontSize: "14px", color: "#666" }}>Remember me</span>
          </label>

          <button
            onClick={handleForgotPassword}
            style={{
              background: "none",
              border: "none",
              color: "#00C6AE",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "16px",
            background: isLoading ? "#E0E0E0" : "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            color: isLoading ? "#999" : "#FFFFFF",
            border: "none",
            borderRadius: "14px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: isLoading ? "not-allowed" : "pointer",
            marginBottom: "16px",
            boxShadow: isLoading ? "none" : "0 8px 24px rgba(0, 198, 174, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isLoading ? (
            <>
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  border: "2px solid #999",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <ChevronRight size={18} />
            </>
          )}
        </button>

        {/* Biometric Login */}
        {biometricEnabled && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "#E0E0E0" }} />
              <span style={{ fontSize: "13px", color: "#999" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "#E0E0E0" }} />
            </div>

            <button
              onClick={handleBiometric}
              style={{
                width: "100%",
                padding: "16px",
                background: "#F5F7FA",
                border: "1px solid #E0E0E0",
                borderRadius: "14px",
                fontSize: "16px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "24px",
              }}
            >
              <Fingerprint size={24} color="#00C6AE" />
              Sign in with Biometrics
            </button>
          </>
        )}

        {/* Sign Up Link */}
        <p
          style={{
            textAlign: "center",
            fontSize: "14px",
            color: "#666",
            margin: 0,
          }}
        >
          Don't have an account?{" "}
          <span
            onClick={handleSignUp}
            style={{
              color: "#00C6AE",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Sign Up
          </span>
        </p>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
