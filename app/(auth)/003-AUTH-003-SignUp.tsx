"use client"

import type React from "react"

import { useState } from "react"
import { ArrowLeft, User, Mail, Phone, Lock, Eye, EyeOff, Check, X } from "lucide-react"

export default function SignUpScreen() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreedToTerms: false,
  })
  const [errors, setErrors] = useState({})

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(formData.password)
  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword
  const passwordsDontMatch = formData.confirmPassword && formData.password !== formData.confirmPassword

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.fullName.trim()) newErrors.fullName = "Name is required"
    if (!formData.email.trim()) newErrors.email = "Email is required"
    if (!formData.phone.trim()) newErrors.phone = "Phone is required"
    if (formData.password.length < 8) newErrors.password = "Min 8 characters"
    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm password"
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match"
    }
    if (!formData.agreedToTerms) newErrors.terms = "You must agree to terms"

    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      console.log("Form submitted:", formData)
      // TODO: Navigate to next screen
    }
  }

  const handleBack = () => {
    console.log("Back clicked")
    // TODO: Navigate back to welcome screen
  }

  const handleLogin = () => {
    console.log("Login clicked")
    // TODO: Navigate to login screen
  }

  const handleTerms = () => {
    console.log("Terms clicked")
    // TODO: Show terms of service
  }

  const handlePrivacy = () => {
    console.log("Privacy clicked")
    // TODO: Show privacy policy
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 14px 14px 44px",
    borderRadius: "10px",
    border: "1px solid #E0E0E0",
    fontSize: "16px",
    boxSizing: "border-box",
    background: "#FFFFFF",
  }

  return (
    <div
      style={{
        background: "#F5F7FA",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Back Button */}
      <button
        onClick={handleBack}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "24px",
          padding: 0,
        }}
      >
        <ArrowLeft size={20} color="#0A2342" />
        <span style={{ color: "#0A2342", fontSize: "14px" }}>Back</span>
      </button>

      {/* Header */}
      <h1
        style={{
          color: "#0A2342",
          fontSize: "28px",
          fontWeight: "700",
          margin: "0 0 8px 0",
        }}
      >
        Create Account
      </h1>
      <p
        style={{
          color: "#666",
          margin: "0 0 24px 0",
          fontSize: "14px",
        }}
      >
        Join thousands building their financial future
      </p>

      {/* Full Name Field */}
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
          Full Name
        </label>
        <div style={{ position: "relative" }}>
          <User
            size={18}
            color="#666"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="text"
            placeholder="Marcus Johnson"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            style={{
              ...inputStyle,
              borderColor: errors.fullName ? "#FF4444" : "#E0E0E0",
            }}
          />
        </div>
      </div>

      {/* Email Field */}
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
          Email Address
        </label>
        <div style={{ position: "relative" }}>
          <Mail
            size={18}
            color="#666"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="email"
            placeholder="marcus@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            style={{
              ...inputStyle,
              borderColor: errors.email ? "#FF4444" : "#E0E0E0",
            }}
          />
        </div>
      </div>

      {/* Phone Field */}
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
          Phone Number
        </label>
        <div style={{ position: "relative" }}>
          <Phone
            size={18}
            color="#666"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            style={{
              ...inputStyle,
              borderColor: errors.phone ? "#FF4444" : "#E0E0E0",
            }}
          />
        </div>
      </div>

      {/* Password Field */}
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
            size={18}
            color="#666"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Min. 8 characters"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            style={{
              ...inputStyle,
              paddingRight: "44px",
              borderColor: errors.password ? "#FF4444" : "#E0E0E0",
            }}
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            type="button"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showPassword ? <EyeOff size={18} color="#666" /> : <Eye size={18} color="#666" />}
          </button>
        </div>

        {/* Password Strength Indicator */}
        <div style={{ marginTop: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: "#666" }}>Password strength:</span>
            <span style={{ fontSize: "11px", color: passwordStrength >= 3 ? "#00C6AE" : "#666" }}>
              {passwordStrength === 0
                ? "Weak"
                : passwordStrength <= 2
                  ? "Fair"
                  : passwordStrength === 3
                    ? "Good"
                    : "Strong"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                style={{
                  flex: 1,
                  height: "4px",
                  background: level <= passwordStrength ? "#00C6AE" : "#E0E0E0",
                  borderRadius: "2px",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Confirm Password Field */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "600",
            color: "#0A2342",
            marginBottom: "8px",
          }}
        >
          Confirm Password
        </label>
        <div style={{ position: "relative" }}>
          <Lock
            size={18}
            color="#666"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Repeat your password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            style={{
              ...inputStyle,
              paddingRight: "80px",
              borderColor: passwordsDontMatch ? "#FF4444" : passwordsMatch ? "#00C6AE" : "#E0E0E0",
            }}
          />

          {/* Match Indicator */}
          {formData.confirmPassword && (
            <div
              style={{
                position: "absolute",
                right: "44px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              {passwordsMatch ? <Check size={18} color="#00C6AE" /> : <X size={18} color="#FF4444" />}
            </div>
          )}

          <button
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            type="button"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showConfirmPassword ? <EyeOff size={18} color="#666" /> : <Eye size={18} color="#666" />}
          </button>
        </div>

        {/* Match Message */}
        {formData.confirmPassword && (
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: passwordsMatch ? "#00C6AE" : "#FF4444",
            }}
          >
            {passwordsMatch ? "✓ Passwords match" : "✗ Passwords don't match"}
          </p>
        )}
      </div>

      {/* Terms Checkbox */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "flex",
            alignItems: "start",
            gap: "10px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={formData.agreedToTerms}
            onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
            style={{ marginTop: "4px" }}
          />
          <span style={{ fontSize: "13px", color: "#666", lineHeight: "1.5" }}>
            I agree to the{" "}
            <span
              style={{ color: "#00C6AE", textDecoration: "underline", cursor: "pointer" }}
              onClick={(e) => {
                e.preventDefault()
                handleTerms()
              }}
            >
              Terms of Service
            </span>{" "}
            and{" "}
            <span
              style={{ color: "#00C6AE", textDecoration: "underline", cursor: "pointer" }}
              onClick={(e) => {
                e.preventDefault()
                handlePrivacy()
              }}
            >
              Privacy Policy
            </span>
          </span>
        </label>
        {errors.terms && <p style={{ color: "#FF4444", fontSize: "12px", margin: "4px 0 0 0" }}>{errors.terms}</p>}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        style={{
          width: "100%",
          background: "#00C6AE",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "12px",
          padding: "16px",
          fontSize: "16px",
          fontWeight: "600",
          cursor: "pointer",
          marginBottom: "16px",
        }}
      >
        Create Account
      </button>

      {/* Login Link */}
      <p style={{ textAlign: "center", fontSize: "14px", color: "#666" }}>
        Already have an account?{" "}
        <span style={{ color: "#00C6AE", fontWeight: "600", cursor: "pointer" }} onClick={handleLogin}>
          Log In
        </span>
      </p>
    </div>
  )
}
