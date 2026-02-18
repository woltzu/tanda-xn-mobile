"use client"

import { useState } from "react"

export default function CreateCircleWithCommunity() {
  const [step, setStep] = useState(1)
  const [selectedCommunity, setSelectedCommunity] = useState<any>(null)
  const [createNewCommunity, setCreateNewCommunity] = useState(false)

  // Circle details
  const [circleName, setCircleName] = useState("")
  const [circleType, setCircleType] = useState("rotating")
  const [contributionAmount, setContributionAmount] = useState("")
  const [frequency, setFrequency] = useState("monthly")
  const [memberCount, setMemberCount] = useState(6)
  const [privacy, setPrivacy] = useState("community")

  // Elder/Organizer settings
  const [elderOption, setElderOption] = useState("self")

  const totalSteps = 4

  const userCommunities = [
    { id: "c1", name: "Ivorian in Atlanta", icon: "🇨🇮", members: 342 },
    { id: "c2", name: "Catholic Community Atlanta", icon: "⛪", members: 1250 },
    { id: "c3", name: "Black Entrepreneurs ATL", icon: "💼", members: 890 },
  ]

  const circleTypes = [
    {
      id: "rotating",
      label: "Rotating Payout",
      icon: "🔄",
      description: "Classic tanda - each member gets the pot once",
      popular: true,
    },
    {
      id: "goal",
      label: "Goal-Based",
      icon: "🎯",
      description: "Everyone saves toward a shared goal",
    },
    {
      id: "emergency",
      label: "Emergency Fund",
      icon: "🛡️",
      description: "Pool for unexpected expenses",
    },
  ]

  const frequencies = [
    { id: "weekly", label: "Weekly", icon: "📅" },
    { id: "biweekly", label: "Bi-weekly", icon: "📆" },
    { id: "monthly", label: "Monthly", icon: "🗓️" },
  ]

  const elderOptions = [
    {
      id: "self",
      label: "I'll be the Elder",
      icon: "👑",
      description: "You manage the circle as Elder",
    },
    {
      id: "elect",
      label: "Let members elect",
      icon: "🗳️",
      description: "Members vote once circle is full",
    },
    {
      id: "nominate",
      label: "Nominate someone",
      icon: "🤝",
      description: "Choose a trusted member as Elder",
    },
  ]

  const privacyOptions = [
    {
      id: "community",
      label: "Community Only",
      icon: "👥",
      description: "Only community members can join",
    },
    {
      id: "invite",
      label: "Invite Only",
      icon: "✉️",
      description: "Must be invited to see and join",
    },
    {
      id: "public",
      label: "Open to All",
      icon: "🌍",
      description: "Anyone on TandaXn can join",
    },
  ]

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedCommunity || createNewCommunity
      case 2:
        return circleName.length >= 3 && circleType
      case 3:
        return contributionAmount && frequency && memberCount >= 3
      case 4:
        return elderOption
      default:
        return false
    }
  }

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    } else {
      console.log("Creating circle:", {
        communityId: selectedCommunity?.id,
        name: circleName,
        type: circleType,
        contributionAmount: Number.parseFloat(contributionAmount),
        frequency,
        memberCount,
        privacy,
        elderOption,
      })
    }
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
            marginBottom: "20px",
          }}
        >
          <button
            onClick={step > 1 ? () => setStep(step - 1) : () => console.log("Back")}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Create Savings Circle</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Step {step} of {totalSteps}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[1, 2, 3, 4].map((s) => (
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
        {/* STEP 1: Select Community */}
        {step === 1 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Which community is this circle for?
            </h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Circles belong to communities. Select where this circle will live.
            </p>

            {/* Existing Communities */}
            {userCommunities.map((community) => (
              <button
                key={community.id}
                onClick={() => {
                  setSelectedCommunity(community)
                  setCreateNewCommunity(false)
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "14px",
                  border: selectedCommunity?.id === community.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: selectedCommunity?.id === community.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "12px",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "26px",
                  }}
                >
                  {community.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{community.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    {community.members.toLocaleString()} members
                  </p>
                </div>
                {selectedCommunity?.id === community.id && (
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
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
                )}
              </button>
            ))}

            {/* Create New Community Option */}
            <button
              onClick={() => {
                setCreateNewCommunity(true)
                setSelectedCommunity(null)
              }}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: createNewCommunity ? "2px solid #00C6AE" : "2px dashed #E5E7EB",
                background: createNewCommunity ? "#F0FDFB" : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                textAlign: "left",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  background: createNewCommunity ? "#00C6AE" : "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={createNewCommunity ? "#FFFFFF" : "#6B7280"}
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  Create new community first
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Start a new community for your circle
                </p>
              </div>
            </button>

            {/* Info Box */}
            <div
              style={{
                marginTop: "20px",
                background: "#F0FDFB",
                borderRadius: "14px",
                padding: "14px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "20px" }}>💡</span>
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Why communities?
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                  Communities help you find trusted members and build accountability. Circle members must belong to the
                  same community.
                </p>
              </div>
            </div>
          </>
        )}

        {/* STEP 2: Circle Details */}
        {step === 2 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Circle Details
            </h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Creating in: <strong>{selectedCommunity?.name || "New Community"}</strong>
            </p>

            {/* Circle Name */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#0A2342", marginBottom: "8px" }}
              >
                Circle Name
              </label>
              <input
                type="text"
                value={circleName}
                onChange={(e) => setCircleName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                placeholder="e.g., Atlanta Monthly Tanda"
              />
            </div>

            {/* Circle Type */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  marginBottom: "12px",
                }}
              >
                Circle Type
              </label>

              {circleTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setCircleType(type.id)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: circleType === type.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: circleType === type.id ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "28px" }}>{type.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{type.label}</p>
                      {type.popular && (
                        <span
                          style={{
                            background: "#00C6AE",
                            color: "#FFFFFF",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "10px",
                            fontWeight: "600",
                          }}
                        >
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{type.description}</p>
                  </div>
                  {circleType === type.id && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 3: Contribution Settings */}
        {step === 3 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Contribution Settings
            </h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              How much and how often will members contribute?
            </p>

            {/* Amount */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#0A2342", marginBottom: "8px" }}
              >
                Contribution Amount
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "18px",
                    color: "#6B7280",
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 16px 14px 36px",
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    fontSize: "24px",
                    fontWeight: "700",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="100"
                />
              </div>

              {/* Quick amounts */}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setContributionAmount(amt.toString())}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: contributionAmount === amt.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: contributionAmount === amt.toString() ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#0A2342",
                    }}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  marginBottom: "12px",
                }}
              >
                Contribution Frequency
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                {frequencies.map((freq) => (
                  <button
                    key={freq.id}
                    onClick={() => setFrequency(freq.id)}
                    style={{
                      flex: 1,
                      padding: "14px 10px",
                      borderRadius: "12px",
                      border: frequency === freq.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: frequency === freq.id ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>{freq.icon}</span>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{freq.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Member Count */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  marginBottom: "12px",
                }}
              >
                Number of Members: <span style={{ color: "#00C6AE" }}>{memberCount}</span>
              </label>

              <input
                type="range"
                min="3"
                max="12"
                value={memberCount}
                onChange={(e) => setMemberCount(Number.parseInt(e.target.value))}
                style={{
                  width: "100%",
                  height: "8px",
                  borderRadius: "4px",
                  background: `linear-gradient(to right, #00C6AE 0%, #00C6AE ${
                    ((memberCount - 3) / 9) * 100
                  }%, #E5E7EB ${((memberCount - 3) / 9) * 100}%, #E5E7EB 100%)`,
                  outline: "none",
                  WebkitAppearance: "none",
                }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>3 min</span>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>12 max</span>
              </div>

              {/* Payout preview */}
              {contributionAmount && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                    Each member receives:{" "}
                    <strong style={{ color: "#00C6AE" }}>
                      ${(Number.parseFloat(contributionAmount) * memberCount).toLocaleString()}
                    </strong>{" "}
                    when it's their turn
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* STEP 4: Elder Selection */}
        {step === 4 && (
          <>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Circle Leadership
            </h2>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Every circle needs an Elder to manage contributions and resolve issues.
            </p>

            {/* Elder Options */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  marginBottom: "12px",
                }}
              >
                Who will be the Elder?
              </label>

              {elderOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setElderOption(opt.id)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: "12px",
                    border: elderOption === opt.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: elderOption === opt.id ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer",
                    marginBottom: "10px",
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
                      borderRadius: "12px",
                      background: elderOption === opt.id ? "#00C6AE" : "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    {opt.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{opt.label}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{opt.description}</p>
                  </div>
                  {elderOption === opt.id && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Privacy */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  marginBottom: "12px",
                }}
              >
                Who can join this circle?
              </label>

              {privacyOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPrivacy(opt.id)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: privacy === opt.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: privacy === opt.id ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer",
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{opt.label}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{opt.description}</p>
                  </div>
                  {privacy === opt.id && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Summary Preview */}
            <div
              style={{
                marginTop: "20px",
                background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                borderRadius: "16px",
                padding: "20px",
                color: "#FFFFFF",
              }}
            >
              <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", opacity: 0.8 }}>
                CIRCLE SUMMARY
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Name</span>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>{circleName || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Community</span>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>{selectedCommunity?.name || "New"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Contribution</span>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>
                    ${contributionAmount}/{frequency}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Payout each</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                    ${(Number.parseFloat(contributionAmount || "0") * memberCount).toLocaleString()}
                  </span>
                </div>
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
        {createNewCommunity && step === 1 ? (
          <button
            onClick={() => console.log("Create community first")}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
              color: "#FFFFFF",
              fontSize: "16px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Create Community First
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: canProceed() ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E5E7EB",
              color: canProceed() ? "#FFFFFF" : "#9CA3AF",
              fontSize: "16px",
              fontWeight: "700",
              cursor: canProceed() ? "pointer" : "not-allowed",
            }}
          >
            {step === 4 ? "Create Circle" : "Continue"}
          </button>
        )}
      </div>
    </div>
  )
}
