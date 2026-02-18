"use client"

import { useState } from "react"

export default function EditProfileScreen() {
  const [user] = useState({
    firstName: "Franck",
    lastName: "Kengne",
    email: "franck@example.com",
    emailVerified: true,
    phone: "+1 (555) 123-4567",
    phoneVerified: true,
    dateOfBirth: "1985-06-15",
    country: "United States",
    city: "Atlanta, GA",
    avatar: null,
  })

  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [city, setCity] = useState(user.city)

  const hasChanges = firstName !== user.firstName || lastName !== user.lastName || city !== user.city

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSave = () => {
    console.log("Save changes:", { firstName, lastName, city })
  }

  const handleChangeAvatar = () => {
    console.log("Change avatar")
  }

  const handleVerifyEmail = () => {
    console.log("Verify email")
  }

  const handleVerifyPhone = () => {
    console.log("Verify phone")
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
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Edit Profile</h1>
          </div>
        </div>

        {/* Avatar */}
        <div style={{ textAlign: "center" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "36px",
                color: "#FFFFFF",
                fontWeight: "700",
                border: "4px solid rgba(255,255,255,0.3)",
              }}
            >
              {firstName.charAt(0)}
              {lastName.charAt(0)}
            </div>
            <button
              onClick={handleChangeAvatar}
              style={{
                position: "absolute",
                bottom: "0",
                right: "0",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "#FFFFFF",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Personal Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Personal Information
          </h3>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}
            >
              First Name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                color: "#0A2342",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}
            >
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                color: "#0A2342",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}
            >
              Date of Birth
            </label>
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                color: "#6B7280",
                fontSize: "15px",
              }}
            >
              {new Date(user.dateOfBirth).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              <span style={{ float: "right", fontSize: "10px", color: "#9CA3AF" }}>Cannot be changed</span>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Contact Information
          </h3>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}
            >
              Email Address
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
              }}
            >
              <span style={{ flex: 1, fontSize: "15px", color: "#0A2342" }}>{user.email}</span>
              {user.emailVerified ? (
                <span
                  style={{
                    padding: "3px 8px",
                    background: "#F0FDFB",
                    color: "#00897B",
                    fontSize: "10px",
                    fontWeight: "600",
                    borderRadius: "4px",
                  }}
                >
                  ✓ Verified
                </span>
              ) : (
                <button
                  onClick={handleVerifyEmail}
                  style={{
                    padding: "4px 10px",
                    background: "#D97706",
                    color: "#FFFFFF",
                    fontSize: "10px",
                    fontWeight: "600",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Verify
                </button>
              )}
            </div>
          </div>

          <div>
            <label
              style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}
            >
              Phone Number
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
              }}
            >
              <span style={{ flex: 1, fontSize: "15px", color: "#0A2342" }}>{user.phone}</span>
              {user.phoneVerified ? (
                <span
                  style={{
                    padding: "3px 8px",
                    background: "#F0FDFB",
                    color: "#00897B",
                    fontSize: "10px",
                    fontWeight: "600",
                    borderRadius: "4px",
                  }}
                >
                  ✓ Verified
                </span>
              ) : (
                <button
                  onClick={handleVerifyPhone}
                  style={{
                    padding: "4px 10px",
                    background: "#D97706",
                    color: "#FFFFFF",
                    fontSize: "10px",
                    fontWeight: "600",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Verify
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Location</h3>

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}
            >
              Country
            </label>
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                color: "#6B7280",
                fontSize: "15px",
              }}
            >
              🇺🇸 {user.country}
            </div>
          </div>

          <div>
            <label
              style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}
            >
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                color: "#0A2342",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
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
          disabled={!hasChanges}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: hasChanges ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: hasChanges ? "#FFFFFF" : "#9CA3AF",
            cursor: hasChanges ? "pointer" : "not-allowed",
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}
