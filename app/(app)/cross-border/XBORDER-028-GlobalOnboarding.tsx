"use client"

import { useState } from "react"

export default function GlobalOnboardingScreen() {
  const [step, setStep] = useState(1)

  const steps = [
    { id: 1, title: "Personal Info", icon: "👤" },
    { id: 2, title: "Verify Identity", icon: "🪪" },
    { id: 3, title: "Address", icon: "🏠" },
    { id: 4, title: "Review", icon: "✓" },
  ]

  const handleBack = () => console.log("Back")
  const handleComplete = () => console.log("Complete")

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Verify Your Identity</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              Required for sending money internationally
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div style={{ display: "flex", gap: "4px" }}>
          {steps.map((s) => (
            <div key={s.id} style={{ flex: 1 }}>
              <div
                style={{
                  height: "4px",
                  borderRadius: "2px",
                  background: step >= s.id ? "#00C6AE" : "rgba(255,255,255,0.3)",
                }}
              />
              <p
                style={{
                  margin: "6px 0 0 0",
                  fontSize: "10px",
                  opacity: step >= s.id ? 1 : 0.5,
                  textAlign: "center",
                }}
              >
                {s.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {step === 1 && (
          <>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                Personal Information
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                    }}
                  >
                    Legal First Name
                  </label>
                  <input
                    type="text"
                    placeholder="As shown on your ID"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "15px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                    }}
                  >
                    Legal Last Name
                  </label>
                  <input
                    type="text"
                    placeholder="As shown on your ID"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "15px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                    }}
                  >
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "15px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
                Your information is encrypted and only used to comply with financial regulations. We never sell your
                data.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px auto",
                  fontSize: "36px",
                }}
              >
                🪪
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                Scan Your ID
              </h3>
              <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}>
                Take a photo of your government-issued ID. Make sure all text is visible and not blurry.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "24px" }}>🪪</span>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      Driver&apos;s License
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>US state-issued</p>
                  </div>
                </button>
                <button
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "24px" }}>📘</span>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Passport</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Any country</p>
                  </div>
                </button>
                <button
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "24px" }}>🆔</span>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>State ID Card</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>US state-issued</p>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Your Address
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="123 Main Street"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Apt/Suite (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Apt 4B"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                    }}
                  >
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="City"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "15px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ width: "100px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#6B7280",
                    }}
                  >
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="GA"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "15px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  ZIP Code
                </label>
                <input
                  type="text"
                  placeholder="30060"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "16px",
              border: "2px solid #00C6AE",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>All Set!</h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280", lineHeight: 1.5 }}>
              Your identity has been verified. You can now send money to family abroad with higher limits.
            </p>
            <div
              style={{
                padding: "14px",
                background: "#F0FDFB",
                borderRadius: "10px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#065F46" }}>
                New limits: Up to <strong>$10,000</strong> per transfer
              </p>
            </div>
          </div>
        )}
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
          onClick={() => (step < 4 ? setStep(step + 1) : handleComplete())}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          {step === 4 ? "Start Sending" : "Continue"}
        </button>
      </div>
    </div>
  )
}
