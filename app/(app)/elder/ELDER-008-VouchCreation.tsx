"use client"

import { useState } from "react"

export default function VouchCreationScreen() {
  const [step, setStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [selectedCircle, setSelectedCircle] = useState<any>(null)
  const [vouchStrength, setVouchStrength] = useState("medium")
  const [testimonial, setTestimonial] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const recentMembers = [
    { id: "m1", name: "Alex Okonkwo", avatar: "A", xnScore: 685, circlesTogether: 3, lastCircle: "Lagos Traders" },
    { id: "m2", name: "Priya Sharma", avatar: "P", xnScore: 720, circlesTogether: 2, lastCircle: "Tech Savers" },
    { id: "m3", name: "Kofi Mensah", avatar: "K", xnScore: 650, circlesTogether: 5, lastCircle: "Ghana Monthly" },
    { id: "m4", name: "Maria Santos", avatar: "M", xnScore: 695, circlesTogether: 1, lastCircle: "Diaspora Fund" },
  ]

  const elderTier = "Senior"
  const maxPoints = elderTier === "Grand" ? 50 : elderTier === "Senior" ? 25 : 10

  const vouchStrengths = [
    { id: "light", label: "Light", points: 10, icon: "🌱", desc: "Basic endorsement - minimal risk" },
    { id: "medium", label: "Medium", points: 25, icon: "🌿", desc: "Strong confidence - moderate risk" },
    {
      id: "strong",
      label: "Strong",
      points: 50,
      icon: "🌳",
      desc: "Full trust - high risk (Grand only)",
      disabled: elderTier !== "Grand",
    },
  ]

  const circleContexts = [
    { id: "c1", name: "Lagos Traders Monthly", role: "Completed together", date: "Dec 2024" },
    { id: "c2", name: "Tech Savers Circle", role: "Currently active", date: "Ongoing" },
    { id: "c3", name: "General", role: "No specific circle", date: "" },
  ]

  const filteredMembers = recentMembers.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleCreate = () => {
    setIsProcessing(true)
    setTimeout(() => {
      console.log("Vouch created", {
        memberId: selectedMember?.id,
        circleContext: selectedCircle?.id,
        strength: vouchStrength,
        points: vouchStrengths.find((v) => v.id === vouchStrength)?.points,
        testimonial,
      })
      setIsProcessing(false)
    }, 1500)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : console.log("Back"))}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Create Vouch</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Step {step} of 3 • Proactive endorsement
            </p>
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: s <= step ? "#00C6AE" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* STEP 1: Select Member */}
        {step === 1 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Who do you want to vouch for?
            </h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Search members you've been in circles with
            </p>

            {/* Search */}
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6B7280"
                strokeWidth="2"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 14px 14px 44px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Recent Members */}
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>
              RECENT CIRCLE MEMBERS
            </p>

            {filteredMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedMember(member)}
                style={{
                  width: "100%",
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: selectedMember?.id === member.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "700",
                    color: "#FFFFFF",
                  }}
                >
                  {member.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    {member.circlesTogether} circles together • Last: {member.lastCircle}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>{member.xnScore}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>XnScore</p>
                </div>
              </button>
            ))}
          </>
        )}

        {/* STEP 2: Vouch Details */}
        {step === 2 && selectedMember && (
          <>
            {/* Selected Member Header */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "20px",
                border: "1px solid #E5E7EB",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                }}
              >
                {selectedMember.avatar}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                  Vouching for {selectedMember.name}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                  XnScore: {selectedMember.xnScore}
                </p>
              </div>
            </div>

            {/* Circle Context */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
                🎯 Circle Context
              </h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>
                Which circle relationship is this vouch based on?
              </p>

              {circleContexts.map((circle) => (
                <button
                  key={circle.id}
                  onClick={() => setSelectedCircle(circle)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: selectedCircle?.id === circle.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: selectedCircle?.id === circle.id ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer",
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{circle.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      {circle.role} {circle.date && `• ${circle.date}`}
                    </p>
                  </div>
                  {selectedCircle?.id === circle.id && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Vouch Strength */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
                ⚡ Strength of Vouch
              </h4>

              {vouchStrengths.map((strength) => (
                <button
                  key={strength.id}
                  onClick={() => !strength.disabled && setVouchStrength(strength.id)}
                  disabled={strength.disabled}
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: vouchStrength === strength.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: vouchStrength === strength.id ? "#F0FDFB" : "#FFFFFF",
                    cursor: strength.disabled ? "not-allowed" : "pointer",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    textAlign: "left",
                    opacity: strength.disabled ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: "28px" }}>{strength.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                        {strength.label}
                      </p>
                      <span
                        style={{
                          background: "#00C6AE",
                          color: "#FFFFFF",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "600",
                        }}
                      >
                        +{strength.points} pts
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{strength.desc}</p>
                  </div>
                  {vouchStrength === strength.id && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 3: Public Testimonial */}
        {step === 3 && (
          <>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h4 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ✍️ Public Testimonial
              </h4>
              <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#6B7280" }}>
                This will be visible on {selectedMember?.name}'s profile
              </p>

              <div
                style={{
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#0A2342" }}>
                  "I vouch for <strong>{selectedMember?.name}</strong> because..."
                </p>
              </div>

              <textarea
                value={testimonial}
                onChange={(e) => setTestimonial(e.target.value)}
                placeholder="They have consistently demonstrated trustworthiness, always making payments on time and being an active community member..."
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                  minHeight: "120px",
                  resize: "none",
                }}
              />
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                {testimonial.length}/500 characters
              </p>
            </div>

            {/* Summary */}
            <div
              style={{
                background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                color: "#FFFFFF",
              }}
            >
              <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", opacity: 0.8 }}>VOUCH SUMMARY</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Member</span>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>{selectedMember?.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Context</span>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>{selectedCircle?.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Strength</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                    {vouchStrengths.find((v) => v.id === vouchStrength)?.label} (+
                    {vouchStrengths.find((v) => v.id === vouchStrength)?.points} pts)
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Warning */}
            <div
              style={{
                background: "#FEF3C7",
                borderRadius: "14px",
                padding: "14px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "20px" }}>⚠️</span>
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
                  Your reputation is on the line
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#92400E" }}>
                  If {selectedMember?.name} defaults, you'll lose{" "}
                  {Math.round((vouchStrengths.find((v) => v.id === vouchStrength)?.points || 0) * 0.3)} Honor Score
                  points.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={() => {
            if (step < 3) setStep(step + 1)
            else handleCreate()
          }}
          disabled={
            (step === 1 && !selectedMember) ||
            (step === 2 && !selectedCircle) ||
            (step === 3 && testimonial.length < 20) ||
            isProcessing
          }
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background:
              (step === 1 && selectedMember) ||
              (step === 2 && selectedCircle) ||
              (step === 3 && testimonial.length >= 20)
                ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)"
                : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "700",
            color:
              (step === 1 && selectedMember) ||
              (step === 2 && selectedCircle) ||
              (step === 3 && testimonial.length >= 20)
                ? "#FFFFFF"
                : "#9CA3AF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isProcessing ? (
            <>
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Creating Vouch...
            </>
          ) : step === 3 ? (
            `Create Vouch (+${vouchStrengths.find((v) => v.id === vouchStrength)?.points} pts)`
          ) : (
            "Continue"
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
