"use client"

import { useState } from "react"

export default function AddNewRecipientScreen() {
  const [step, setStep] = useState(1)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [relation, setRelation] = useState("")
  const [deliveryMethod, setDeliveryMethod] = useState<string | null>(null)

  const relations = ["Mother", "Father", "Sibling", "Spouse", "Child", "Aunt/Uncle", "Cousin", "Friend", "Other"]

  const communityStats = {
    totalSent: "2.4M",
    avgSavings: 612,
    topDestinations: [
      { name: "Cameroon", percent: 28, flag: "🇨🇲" },
      { name: "Nigeria", percent: 22, flag: "🇳🇬" },
      { name: "Senegal", percent: 18, flag: "🇸🇳" },
      { name: "Kenya", percent: 15, flag: "🇰🇪" },
    ],
  }

  const deliveryMethods = [
    {
      id: "mobile_money",
      name: "Mobile Money",
      description: "MTN, Orange, Wave, M-Pesa",
      icon: "📱",
      speed: "Instant",
      popular: true,
    },
    {
      id: "bank",
      name: "Bank Transfer",
      description: "Direct to bank account",
      icon: "🏦",
      speed: "1-2 days",
      popular: false,
    },
    {
      id: "cash",
      name: "Cash Pickup",
      description: "Collect at agent location",
      icon: "💵",
      speed: "Same day",
      popular: false,
    },
  ]

  const canProceed = () => {
    if (step === 1) return firstName && lastName && phone.length >= 8 && relation
    if (step === 2) return deliveryMethod
    return false
  }

  const handleNext = () => {
    if (step === 1) {
      setStep(2)
    } else {
      console.log("Saving recipient:", { firstName, lastName, phone, relation, deliveryMethod })
    }
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
            onClick={() => (step > 1 ? setStep(1) : console.log("Back"))}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Add Recipient</h1>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "#00C6AE" }} />
          <div
            style={{
              flex: 1,
              height: "4px",
              borderRadius: "2px",
              background: step >= 2 ? "#00C6AE" : "rgba(255,255,255,0.3)",
            }}
          />
        </div>
        <p style={{ margin: "8px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
          Step {step}: {step === 1 ? "Who's receiving?" : "How do they want it?"}
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {step === 1 ? (
          <>
            {/* Recipient Info */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                Recipient's Name
              </label>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                  }}
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                  }}
                />
              </div>

              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+XXX XXX XXX XXXX"
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: "16px",
                }}
              />

              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                Relationship
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {relations.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRelation(r)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: relation === r ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: relation === r ? "#F0FDFB" : "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: relation === r ? "#00897B" : "#6B7280",
                      cursor: "pointer",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Community Stats */}
            <div
              style={{
                background: "#0A2342",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                TandaXn Community Stats
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{
                    padding: "12px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                    ${communityStats.totalSent}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>
                    Sent by community
                  </p>
                </div>
                <div
                  style={{
                    padding: "12px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>
                    ${communityStats.avgSavings}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>
                    Avg yearly savings
                  </p>
                </div>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Top destinations:</p>
              <div style={{ display: "flex", gap: "8px" }}>
                {communityStats.topDestinations.map((dest) => (
                  <div
                    key={dest.name}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "18px" }}>{dest.flag}</span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.8)" }}>
                      {dest.percent}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Delivery Method */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                How should {firstName} receive the money?
              </label>
              <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#6B7280" }}>
                They can change this later from their end
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {deliveryMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setDeliveryMethod(method.id)}
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "14px",
                      border: deliveryMethod === method.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: deliveryMethod === method.id ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      textAlign: "left",
                      position: "relative",
                    }}
                  >
                    {method.popular && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "12px",
                          background: "#00C6AE",
                          color: "#FFFFFF",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontSize: "9px",
                          fontWeight: "700",
                        }}
                      >
                        MOST POPULAR
                      </span>
                    )}
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: deliveryMethod === method.id ? "#00C6AE" : "#F5F7FA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                      }}
                    >
                      {method.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{method.name}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{method.description}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          background: method.speed === "Instant" ? "#F0FDFB" : "#F5F7FA",
                          color: method.speed === "Instant" ? "#00897B" : "#6B7280",
                          fontSize: "10px",
                          fontWeight: "600",
                          borderRadius: "4px",
                        }}
                      >
                        {method.speed}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
                <strong>{firstName}</strong> will receive an SMS with instructions to claim the money. They can also
                create a TandaXn account to manage their preferences.
              </p>
            </div>
          </>
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
          onClick={handleNext}
          disabled={!canProceed()}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canProceed() ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canProceed() ? "#FFFFFF" : "#9CA3AF",
            cursor: canProceed() ? "pointer" : "not-allowed",
          }}
        >
          {step === 1 ? "Continue" : "Save Recipient"}
        </button>
      </div>
    </div>
  )
}
