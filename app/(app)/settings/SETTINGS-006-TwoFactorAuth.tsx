"use client"

import { useState } from "react"

export default function TwoFactorAuthScreen() {
  const currentStatus = {
    enabled: true,
    method: "authenticator",
    phone: "+1 (***) ***-4567",
    email: "f***@gmail.com",
    backupCodesRemaining: 8,
  }

  const [enabled, setEnabled] = useState(currentStatus.enabled)
  const [selectedMethod, setSelectedMethod] = useState(currentStatus.method)

  const methods = [
    {
      id: "authenticator",
      icon: "🔐",
      title: "Authenticator App",
      description: "Google Authenticator, Authy, etc.",
      recommended: true,
    },
    {
      id: "sms",
      icon: "📱",
      title: "SMS Code",
      description: currentStatus.phone,
      recommended: false,
    },
    {
      id: "email",
      icon: "📧",
      title: "Email Code",
      description: currentStatus.email,
      recommended: false,
    },
  ]

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleToggle2FA = (value: boolean) => {
    console.log("Toggle 2FA:", value)
  }

  const handleChangeMethod = (method: string) => {
    console.log("Change method:", method)
  }

  const handleViewBackupCodes = () => {
    console.log("View backup codes")
  }

  const handleRegenerateBackupCodes = () => {
    console.log("Regenerate backup codes")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Two-Factor Authentication</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Extra security for your account</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Main Toggle */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background: enabled ? "#F0FDFB" : "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={enabled ? "#00C6AE" : "#6B7280"}
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                  Two-Factor Authentication
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  {enabled ? "Your account is protected" : "Add extra security"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setEnabled(!enabled)
                handleToggle2FA(!enabled)
              }}
              style={{
                width: "52px",
                height: "32px",
                borderRadius: "16px",
                border: "none",
                background: enabled ? "#00C6AE" : "#E5E7EB",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  position: "absolute",
                  top: "3px",
                  left: enabled ? "23px" : "3px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>
        </div>

        {enabled && (
          <>
            {/* Method Selection */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Verification Method
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {methods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedMethod(method.id)
                      handleChangeMethod(method.id)
                    }}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                      borderRadius: "12px",
                      border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>{method.icon}</span>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                          {method.title}
                        </p>
                        {method.recommended && (
                          <span
                            style={{
                              padding: "2px 6px",
                              background: "#00C6AE",
                              color: "#FFFFFF",
                              fontSize: "9px",
                              fontWeight: "700",
                              borderRadius: "4px",
                            }}
                          >
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{method.description}</p>
                    </div>
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        border: selectedMethod === method.id ? "none" : "2px solid #D1D5DB",
                        background: selectedMethod === method.id ? "#00C6AE" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedMethod === method.id && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Backup Codes */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Backup Codes</h3>
                <span
                  style={{
                    padding: "4px 10px",
                    background: currentStatus.backupCodesRemaining > 3 ? "#F0FDFB" : "#FEF3C7",
                    color: currentStatus.backupCodesRemaining > 3 ? "#00897B" : "#D97706",
                    fontSize: "11px",
                    fontWeight: "600",
                    borderRadius: "6px",
                  }}
                >
                  {currentStatus.backupCodesRemaining} remaining
                </span>
              </div>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
                Use backup codes to access your account if you lose access to your phone.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={handleViewBackupCodes}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#0A2342",
                    cursor: "pointer",
                  }}
                >
                  View Codes
                </button>
                <button
                  onClick={handleRegenerateBackupCodes}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#F0FDFB",
                    borderRadius: "10px",
                    border: "1px solid #00C6AE",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#00897B",
                    cursor: "pointer",
                  }}
                >
                  Regenerate
                </button>
              </div>
            </div>
          </>
        )}

        {/* Info Note */}
        <div
          style={{
            padding: "14px",
            background: enabled ? "#F0FDFB" : "#FEF3C7",
            borderRadius: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={enabled ? "#00897B" : "#D97706"}
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            {enabled ? (
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </>
            )}
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: enabled ? "#065F46" : "#92400E", lineHeight: 1.5 }}>
            {enabled
              ? "Two-factor authentication adds an extra layer of security. You'll need to enter a code each time you sign in."
              : "Your account is not fully protected. We strongly recommend enabling two-factor authentication."}
          </p>
        </div>
      </div>
    </div>
  )
}
