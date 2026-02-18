"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ArrowLeft, Smartphone, RefreshCw, CheckCircle } from "lucide-react"

export default function OTPScreen() {
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""])
  const [resendTimer, setResendTimer] = useState(45)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const phoneNumber = "+1 (555) 123-4567"

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otpCode]
    newOtp[index] = value
    setOtpCode(newOtp)
    setError("")

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Check if complete
    if (newOtp.every((digit) => digit)) {
      setIsComplete(true)
    } else {
      setIsComplete(false)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").slice(0, 6)
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otpCode]
      pastedData.split("").forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit
      })
      setOtpCode(newOtp)
      if (pastedData.length === 6) {
        setIsComplete(true)
      }
    }
  }

  const handleVerify = () => {
    const code = otpCode.join("")
    setIsVerifying(true)
    setTimeout(() => {
      setIsVerifying(false)
      if (code === "123456") {
        console.log("Verified successfully")
        // TODO: Navigate to next screen
      } else {
        setError("Invalid code. Please try again.")
        setOtpCode(["", "", "", "", "", ""])
        setIsComplete(false)
        inputRefs.current[0]?.focus()
      }
    }, 1500)
  }

  const handleResend = () => {
    if (resendTimer === 0) {
      setResendTimer(45)
      setOtpCode(["", "", "", "", "", ""])
      setError("")
      setIsComplete(false)
      console.log("Resend code")
      inputRefs.current[0]?.focus()
    }
  }

  const handleBack = () => {
    console.log("Back clicked")
    // TODO: Navigate back to previous screen
  }

  return (
    <div
      style={{
        background: "#F5F7FA",
        minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* COLORFUL HEADER SECTION */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #1A3A5A 100%)",
          padding: "20px 20px 60px 20px",
          borderRadius: "0 0 30px 30px",
          position: "relative",
        }}
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "24px",
            padding: "10px 14px",
            borderRadius: "10px",
          }}
        >
          <ArrowLeft size={18} color="#FFFFFF" />
          <span style={{ color: "#FFFFFF", fontSize: "14px" }}>Back</span>
        </button>

        {/* Animated Phone Icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 10px 30px rgba(0, 198, 174, 0.3)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          <Smartphone size={36} color="#FFFFFF" />
        </div>

        <h1
          style={{
            color: "#FFFFFF",
            fontSize: "24px",
            fontWeight: "700",
            margin: "0 0 8px 0",
            textAlign: "center",
          }}
        >
          Verify Your Phone
        </h1>

        <p
          style={{
            color: "rgba(255,255,255,0.8)",
            margin: 0,
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          We sent a 6-digit code to
        </p>
        <p
          style={{
            color: "#00C6AE",
            margin: "4px 0 0 0",
            fontSize: "16px",
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          {phoneNumber}
        </p>
      </div>

      {/* Main Content */}
      <div style={{ padding: "30px 20px" }}>
        {/* OTP Input Boxes */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          {otpCode.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={idx === 0 ? handlePaste : undefined}
              style={{
                width: "50px",
                height: "60px",
                textAlign: "center",
                fontSize: "26px",
                fontWeight: "700",
                borderRadius: "12px",
                border: error ? "2px solid #FF4444" : digit ? "2px solid #00C6AE" : "2px solid #E0E0E0",
                background: digit ? "#F0FDFB" : "#FFFFFF",
                color: "#0A2342",
                outline: "none",
                transition: "all 0.2s ease",
                boxShadow: digit ? "0 4px 12px rgba(0, 198, 174, 0.15)" : "none",
              }}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "#DC2626",
                fontSize: "14px",
                margin: 0,
                fontWeight: "500",
              }}
            >
              {error}
            </p>
          </div>
        )}

        {/* Success Indicator */}
        {isComplete && !error && !isVerifying && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <CheckCircle size={18} color="#00C6AE" />
            <span style={{ color: "#00C6AE", fontWeight: "600", fontSize: "14px" }}>
              Code complete! Tap verify to continue.
            </span>
          </div>
        )}

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={!isComplete || isVerifying}
          style={{
            width: "100%",
            background: isComplete && !isVerifying ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E0E0E0",
            color: isComplete && !isVerifying ? "#FFFFFF" : "#999",
            border: "none",
            borderRadius: "14px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: isComplete && !isVerifying ? "pointer" : "not-allowed",
            marginBottom: "24px",
            boxShadow: isComplete ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
            transition: "all 0.3s ease",
          }}
        >
          {isVerifying ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <RefreshCw size={18} className="spin" />
              Verifying...
            </span>
          ) : (
            "Verify Code"
          )}
        </button>

        {/* Resend Section */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "20px",
            textAlign: "center",
            border: "1px solid #E0E0E0",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              color: "#666",
              margin: "0 0 8px 0",
            }}
          >
            Didn't receive the code?
          </p>

          <button
            onClick={handleResend}
            disabled={resendTimer > 0}
            style={{
              background: resendTimer === 0 ? "#00C6AE" : "transparent",
              color: resendTimer === 0 ? "#FFFFFF" : "#999",
              border: resendTimer === 0 ? "none" : "1px solid #E0E0E0",
              borderRadius: "10px",
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: resendTimer === 0 ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              margin: "0 auto",
            }}
          >
            <RefreshCw size={16} />
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
          </button>
        </div>

        {/* Help Link */}
        <p
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "13px",
            color: "#666",
          }}
        >
          Having trouble? <span style={{ color: "#00C6AE", cursor: "pointer", fontWeight: "600" }}>Get Help</span>
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
