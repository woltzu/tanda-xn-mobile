"use client"

import { useState } from "react"

export default function AccountRecoveryScreen() {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const recoveryMethods = [
    {
      id: "phone",
      label: "Phone Number",
      icon: String.fromCodePoint(0x1f4f1),
      description: "Receive a code via SMS",
      available: true,
      masked: "+1 (***) ***-4589",
    },
    {
      id: "email",
      label: "Email Address",
      icon: String.fromCodePoint(0x1f4e7),
      description: "Receive a code via email",
      available: true,
      masked: "f***@gmail.com",
    },
    {
      id: "backup",
      label: "Backup Code",
      icon: String.fromCodePoint(0x1f511),
      description: "Use your saved backup code",
      available: true,
      masked: undefined,
    },
  ]

  const handleBack = () => {
    console.log("Going back")
  }

  const handleSelectMethod = (method: typeof recoveryMethods[0]) => {
    console.log("Selected method:", method)
  }

  const handleContactSupport = () => {
    console.log("Contacting support")
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Account Recovery</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Let's get you back in</p>
          </div>
        </div>

        {/* Lock Icon */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Recovery Methods */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Verify Your Identity
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>
            Choose how you'd like to receive your verification code
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recoveryMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => {
                  setSelectedMethod(method.id)
                  handleSelectMethod(method)
                }}
                disabled={!method.available}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "14px",
                  border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: method.available ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  opacity: method.available ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  {method.icon}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{method.label}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    {method.masked || method.description}
                  </p>
                </div>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: selectedMethod === method.id ? "none" : "2px solid #D1D5DB",
                    background: selectedMethod === method.id ? "#00C6AE" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedMethod === method.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Need More Help */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Need More Help?
          </h3>
          <button
            onClick={handleContactSupport}
            style={{
              width: "100%",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Contact Support</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Our team is here to help 24/7</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Security Note */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
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
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            We'll never ask for your password. All recovery codes expire in 10 minutes for your security.
          </p>
        </div>
      </div>

      {/* Continue Button */}
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
          onClick={() => {
            const method = recoveryMethods.find((m) => m.id === selectedMethod)
            if (method) handleSelectMethod(method)
          }}
          disabled={!selectedMethod}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: selectedMethod ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: selectedMethod ? "#FFFFFF" : "#9CA3AF",
            cursor: selectedMethod ? "pointer" : "not-allowed",
          }}
        >
          Send Verification Code
        </button>
      </div>
    </div>
  )
}
