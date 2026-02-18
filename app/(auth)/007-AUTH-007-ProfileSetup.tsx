"use client"

import { useState } from "react"
import { ArrowLeft, User, Lock } from "lucide-react"

// Brand Colors
const colors = {
  primaryNavy: "#0A2342",
  accentTeal: "#00C6AE",
  warningAmber: "#D97706",
  background: "#F5F7FA",
  cards: "#FFFFFF",
  borders: "#E5E7EB",
  textSecondary: "#6B7280",
}

export default function ProfileSetupScreen() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [country, setCountry] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")

  const isValid = firstName.length > 1 && lastName.length > 1

  const handleBack = () => {
    console.log("Back to previous screen")
  }

  const handleSkip = () => {
    console.log("Skip profile setup")
  }

  const handleContinue = () => {
    console.log("Continue with profile:", { firstName, lastName, country, dateOfBirth })
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header - Navy with proper styling */}
      <div
        style={{
          background: colors.primaryNavy,
          padding: "0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Status Bar Spacer */}
        <div style={{ height: "44px", background: colors.primaryNavy }} />

        {/* Navigation Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "10px",
              width: "40px",
              height: "40px",
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </button>

          {/* Step Indicator */}
          <span
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            Step 7 of 8
          </span>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            style={{
              background: "none",
              border: "none",
              fontSize: "13px",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "8px",
            }}
          >
            Skip
          </button>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            padding: "0 20px 16px 20px",
          }}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "4px",
              height: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: colors.accentTeal,
                height: "100%",
                width: "87.5%" /* 7/8 = 87.5% */,
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Title Section */}
        <div
          style={{
            padding: "8px 20px 24px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={20} color="#FFFFFF" />
            </div>
            <h1
              style={{
                color: "#FFFFFF",
                fontSize: "24px",
                fontWeight: "700",
                margin: 0,
                lineHeight: "1.2",
              }}
            >
              Your Profile
            </h1>
          </div>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              margin: 0,
              fontSize: "15px",
              lineHeight: "1.5",
            }}
          >
            Tell us a bit about yourself
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div style={{ padding: "20px" }}>
        <div
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "20px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "600",
              color: colors.primaryNavy,
            }}
          >
            Basic Information
          </h3>

          {/* First Name */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: colors.primaryNavy,
                marginBottom: "8px",
              }}
            >
              First Name <span style={{ color: colors.accentTeal }}>*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: `1px solid ${colors.borders}`,
                fontSize: "16px",
                color: colors.primaryNavy,
                boxSizing: "border-box",
                fontFamily: "inherit",
                background: colors.cards,
              }}
            />
          </div>

          {/* Last Name */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: colors.primaryNavy,
                marginBottom: "8px",
              }}
            >
              Last Name <span style={{ color: colors.accentTeal }}>*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: `1px solid ${colors.borders}`,
                fontSize: "16px",
                color: colors.primaryNavy,
                boxSizing: "border-box",
                fontFamily: "inherit",
                background: colors.cards,
              }}
            />
          </div>

          {/* Country of Origin */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: colors.primaryNavy,
                marginBottom: "8px",
              }}
            >
              Country of Origin
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: `1px solid ${colors.borders}`,
                fontSize: "16px",
                color: country ? colors.primaryNavy : colors.textSecondary,
                background: colors.cards,
                boxSizing: "border-box",
                fontFamily: "inherit",
                cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236B7280' strokeWidth='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                backgroundSize: "20px",
              }}
            >
              <option value="">Select your country</option>
              <option value="CM">🇨🇲 Cameroon</option>
              <option value="NG">🇳🇬 Nigeria</option>
              <option value="KE">🇰🇪 Kenya</option>
              <option value="GH">🇬🇭 Ghana</option>
              <option value="SN">🇸🇳 Senegal</option>
              <option value="CI">🇨🇮 Côte d'Ivoire</option>
              <option value="ET">🇪🇹 Ethiopia</option>
              <option value="TZ">🇹🇿 Tanzania</option>
              <option value="UG">🇺🇬 Uganda</option>
              <option value="ZA">🇿🇦 South Africa</option>
              <option value="OTHER">🌍 Other</option>
            </select>
          </div>

          {/* Date of Birth */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: colors.primaryNavy,
                marginBottom: "8px",
              }}
            >
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: `1px solid ${colors.borders}`,
                fontSize: "16px",
                color: dateOfBirth ? colors.primaryNavy : colors.textSecondary,
                boxSizing: "border-box",
                fontFamily: "inherit",
                background: colors.cards,
              }}
            />
          </div>
        </div>

        {/* Privacy Note */}
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Lock size={14} color={colors.textSecondary} />
          <p
            style={{
              fontSize: "12px",
              color: colors.textSecondary,
              margin: 0,
            }}
          >
            Your information is encrypted and secure
          </p>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: colors.cards,
          padding: "16px 20px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          borderTop: `1px solid ${colors.borders}`,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={handleContinue}
          disabled={!isValid}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isValid ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)` : colors.borders,
            fontSize: "16px",
            fontWeight: "600",
            color: isValid ? "#FFFFFF" : colors.textSecondary,
            cursor: isValid ? "pointer" : "not-allowed",
            boxShadow: isValid ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
            fontFamily: "inherit",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
