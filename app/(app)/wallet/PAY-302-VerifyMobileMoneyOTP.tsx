"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"

export default function VerifyMobileMoneyOTPScreen() {
  const provider = {
    id: "wave",
    name: "Wave",
    icon: "🌊",
  }
  const phoneNumber = "+221 77 ***-**89"

  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isVerifying, setIsVerifying] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [error, setError] = useState("")
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  // Auto-submit when all digits entered
  useEffect(() => {
    const code = otp.join("")
    if (code.length === 6 && !otp.includes("")) {
      handleVerify(code)
    }
  }, [otp])

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("")
      const newOtp = [...otp]
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit
      })
      setOtp(newOtp)
      const nextIndex = Math.min(index + digits.length, 5)
      inputRefs.current[nextIndex]?.focus()
    } else {
      // Single digit
      const newOtp = [...otp]
      newOtp[index] = value.replace(/\D/g, "")
      setOtp(newOtp)

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    }
    setError("")
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async (code: string) => {
    setIsVerifying(true)
    setError("")

    try {
      console.log("Verifying code:", code)
      // Simulate verification
      await new Promise((resolve) => setTimeout(resolve, 1500))
    } catch (err) {
      setError("Invalid code. Please try again.")
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = () => {
    setCanResend(false)
    setCountdown(60)
    setOtp(["", "", "", "", "", ""])
    setError("")
    inputRefs.current[0]?.focus()
    console.log("Resend OTP")
  }

  const isComplete = otp.every((digit) => digit !== "")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Verify {provider.name}</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Provider Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "24px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              fontSize: "36px",
            }}
          >
            {provider.icon}
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
            Enter Verification Code
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
            We sent a 6-digit code to
            <br />
            <strong style={{ color: "#0A2342" }}>{phoneNumber}</strong>
          </p>
        </div>

        {/* OTP Input */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            border: error ? "2px solid #DC2626" : "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                maxLength={6}
                disabled={isVerifying}
                style={{
                  width: "48px",
                  height: "56px",
                  borderRadius: "12px",
                  border: digit ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: digit ? "#F0FDFB" : "#F5F7FA",
                  fontSize: "24px",
                  fontWeight: "700",
                  textAlign: "center",
                  color: "#0A2342",
                  outline: "none",
                }}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                color: "#DC2626",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}

          {/* Timer */}
          <div style={{ textAlign: "center" }}>
            {countdown > 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                Code expires in{" "}
                <strong style={{ color: "#0A2342" }}>
                  {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, "0")}
                </strong>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "#DC2626" }}>Code expired</p>
            )}
          </div>
        </div>

        {/* Resend Code */}
        <button
          onClick={handleResend}
          disabled={!canResend}
          style={{
            width: "100%",
            padding: "14px",
            background: "none",
            border: "none",
            color: canResend ? "#00C6AE" : "#9CA3AF",
            fontSize: "14px",
            fontWeight: "600",
            cursor: canResend ? "pointer" : "not-allowed",
            marginBottom: "24px",
          }}
        >
          {canResend ? "Resend Code" : `Resend in ${countdown}s`}
        </button>

        {/* Help Section */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Didn't receive the code?
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {["Check your SMS messages", "Make sure the phone number is correct", "Check if your phone has signal"].map(
              (item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                    }}
                  />
                  <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{item}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Verify Button */}
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
          onClick={() => handleVerify(otp.join(""))}
          disabled={!isComplete || isVerifying}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isComplete && !isVerifying ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: isComplete && !isVerifying ? "#FFFFFF" : "#9CA3AF",
            cursor: isComplete && !isVerifying ? "pointer" : "not-allowed",
          }}
        >
          {isVerifying ? "Verifying..." : "Verify Account"}
        </button>
      </div>
    </div>
  )
}
