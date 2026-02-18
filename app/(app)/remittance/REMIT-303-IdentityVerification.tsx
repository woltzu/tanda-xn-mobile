"use client"

import { useState } from "react"

export default function IdentityVerificationScreen() {
  const supportedIdTypes = [
    { id: "passport", name: "Passport", icon: "🛂", description: "Any valid passport" },
    { id: "drivers_license", name: "Driver's License", icon: "🪪", description: "US driver's license" },
    { id: "national_id", name: "National ID", icon: "🆔", description: "Government-issued ID" },
  ]

  const [step, setStep] = useState("select") // select, front, back, selfie, review
  const [selectedIdType, setSelectedIdType] = useState<string | null>(null)
  const [frontImage, setFrontImage] = useState<string | null>(null)
  const [backImage, setBackImage] = useState<string | null>(null)
  const [selfieImage, setSelfieImage] = useState<string | null>(null)

  const needsBackImage = selectedIdType !== "passport"

  const handleIdTypeSelect = (idType: string) => {
    setSelectedIdType(idType)
    setStep("front")
  }

  const simulateCapture = (type: "front" | "back" | "selfie") => {
    // In real app, this opens camera
    if (type === "front") {
      setFrontImage("captured")
      setStep(needsBackImage ? "back" : "selfie")
    } else if (type === "back") {
      setBackImage("captured")
      setStep("selfie")
    } else if (type === "selfie") {
      setSelfieImage("captured")
      setStep("review")
    }
  }

  const handleBack = () => console.log("Navigate back")
  const handleSubmit = () => console.log("Submit verification")

  const getStepLabels = () => {
    if (needsBackImage) {
      return ["ID Type", "Front", "Back", "Selfie", "Review"]
    }
    return ["ID Type", "ID", "Selfie", "Review"]
  }

  const getStepValues = () => {
    if (needsBackImage) {
      return ["select", "front", "back", "selfie", "review"]
    }
    return ["select", "front", "selfie", "review"]
  }

  const stepLabels = getStepLabels()
  const stepValues = getStepValues()
  const currentStepIndex = stepValues.indexOf(step)

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Verify Your Identity</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Step 1 of 3 • Takes ~2 minutes</p>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🪪
          </div>
        </div>

        {/* Progress Steps */}
        <div style={{ display: "flex", gap: "8px" }}>
          {stepLabels.map((label, idx) => {
            const isComplete = idx < currentStepIndex
            const isCurrent = idx === currentStepIndex

            return (
              <div key={label} style={{ flex: 1 }}>
                <div
                  style={{
                    height: "4px",
                    borderRadius: "2px",
                    background: isComplete ? "#00C6AE" : isCurrent ? "rgba(0,198,174,0.5)" : "rgba(255,255,255,0.2)",
                  }}
                />
                <p
                  style={{
                    margin: "6px 0 0 0",
                    fontSize: "9px",
                    textAlign: "center",
                    opacity: isCurrent ? 1 : 0.6,
                  }}
                >
                  {label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Step: Select ID Type */}
        {step === "select" && (
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
              <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Select ID Type
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {supportedIdTypes.map((idType) => (
                  <button
                    key={idType.id}
                    onClick={() => handleIdTypeSelect(idType.id)}
                    style={{
                      padding: "16px",
                      background: "#F5F7FA",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: "32px" }}>{idType.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{idType.name}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{idType.description}</p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "14px",
                padding: "14px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                📸 Tips for best results
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  "Use original documents (no copies)",
                  "Make sure all text is readable",
                  "Good lighting, no glare",
                  "Document should fill the frame",
                ].map((tip, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00C6AE" }} />
                    <span style={{ fontSize: "12px", color: "#065F46" }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step: Capture Front */}
        {step === "front" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "1.6",
                background: "#0A2342",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Camera Frame */}
              <div
                style={{
                  width: "85%",
                  height: "75%",
                  border: "3px dashed rgba(0,198,174,0.6)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ textAlign: "center", color: "#FFFFFF" }}>
                  <span style={{ fontSize: "48px" }}>🪪</span>
                  <p style={{ margin: "12px 0 0 0", fontSize: "14px", opacity: 0.8 }}>Position front of ID here</p>
                </div>
              </div>

              {/* Corner guides */}
              {[
                { top: "10px", left: "10px" },
                { top: "10px", right: "10px" },
                { bottom: "10px", left: "10px" },
                { bottom: "10px", right: "10px" },
              ].map((pos, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    ...pos,
                    width: "30px",
                    height: "30px",
                    borderColor: "#00C6AE",
                    borderStyle: "solid",
                    borderWidth:
                      pos.top && pos.left
                        ? "3px 0 0 3px"
                        : pos.top && pos.right
                          ? "3px 3px 0 0"
                          : pos.bottom && pos.left
                            ? "0 0 3px 3px"
                            : "0 3px 3px 0",
                    borderRadius:
                      pos.top && pos.left
                        ? "8px 0 0 0"
                        : pos.top && pos.right
                          ? "0 8px 0 0"
                          : pos.bottom && pos.left
                            ? "0 0 0 8px"
                            : "0 0 8px 0",
                  }}
                />
              ))}
            </div>

            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Front of {supportedIdTypes.find((t) => t.id === selectedIdType)?.name}
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#6B7280" }}>
              Position your ID within the frame and take a clear photo
            </p>

            <button
              onClick={() => simulateCapture("front")}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take Photo
            </button>
          </div>
        )}

        {/* Step: Capture Back */}
        {step === "back" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "1.6",
                background: "#0A2342",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "85%",
                  height: "75%",
                  border: "3px dashed rgba(0,198,174,0.6)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ textAlign: "center", color: "#FFFFFF" }}>
                  <span style={{ fontSize: "48px" }}>🔄</span>
                  <p style={{ margin: "12px 0 0 0", fontSize: "14px", opacity: 0.8 }}>Position back of ID here</p>
                </div>
              </div>
            </div>

            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Back of {supportedIdTypes.find((t) => t.id === selectedIdType)?.name}
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#6B7280" }}>
              Flip your ID and capture the back side
            </p>

            <button
              onClick={() => simulateCapture("back")}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take Photo
            </button>
          </div>
        )}

        {/* Step: Selfie */}
        {step === "selfie" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background: "#0A2342",
                margin: "0 auto 20px auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "170px",
                  height: "170px",
                  borderRadius: "50%",
                  border: "3px dashed rgba(0,198,174,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "64px" }}>😊</span>
              </div>

              {/* Animated ring */}
              <div
                style={{
                  position: "absolute",
                  inset: "0",
                  borderRadius: "50%",
                  border: "3px solid #00C6AE",
                  opacity: 0.3,
                }}
              />
            </div>

            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Take a Selfie
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#6B7280" }}>
              Position your face in the circle. Look straight at the camera.
            </p>

            <div
              style={{
                background: "#FEF3C7",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "18px" }}>💡</span>
              <span style={{ fontSize: "12px", color: "#92400E" }}>
                Make sure your face is well-lit and matches your ID photo
              </span>
            </div>

            <button
              onClick={() => simulateCapture("selfie")}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take Selfie
            </button>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <>
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>All photos captured!</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>Review your images below</p>
              </div>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Your Documents
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div
                  style={{
                    aspectRatio: "1.4",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #00C6AE",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: "32px" }}>🪪</span>
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p
                    style={{
                      position: "absolute",
                      bottom: "6px",
                      left: 0,
                      right: 0,
                      margin: 0,
                      fontSize: "10px",
                      textAlign: "center",
                      color: "#6B7280",
                    }}
                  >
                    Front
                  </p>
                </div>

                {needsBackImage && (
                  <div
                    style={{
                      aspectRatio: "1.4",
                      background: "#F5F7FA",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid #00C6AE",
                      position: "relative",
                    }}
                  >
                    <span style={{ fontSize: "32px" }}>🔄</span>
                    <div
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: "#00C6AE",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p
                      style={{
                        position: "absolute",
                        bottom: "6px",
                        left: 0,
                        right: 0,
                        margin: 0,
                        fontSize: "10px",
                        textAlign: "center",
                        color: "#6B7280",
                      }}
                    >
                      Back
                    </p>
                  </div>
                )}

                <div
                  style={{
                    aspectRatio: "1.4",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #00C6AE",
                    position: "relative",
                    gridColumn: needsBackImage ? "auto" : "span 2",
                  }}
                >
                  <span style={{ fontSize: "32px" }}>😊</span>
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p
                    style={{
                      position: "absolute",
                      bottom: "6px",
                      left: 0,
                      right: 0,
                      margin: 0,
                      fontSize: "10px",
                      textAlign: "center",
                      color: "#6B7280",
                    }}
                  >
                    Selfie
                  </p>
                </div>
              </div>

              <button
                style={{
                  width: "100%",
                  marginTop: "14px",
                  padding: "10px",
                  background: "none",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
                onClick={() => setStep("select")}
              >
                Retake Photos
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bottom CTA */}
      {step === "review" && (
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
            onClick={handleSubmit}
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
            Submit for Verification
          </button>
          <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "#9CA3AF", textAlign: "center" }}>
            Usually verified within minutes
          </p>
        </div>
      )}
    </div>
  )
}
