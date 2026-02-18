"use client"

import { useState, useEffect } from "react"

export default function CreateCircleScheduleScreen() {
  const circleDetails = {
    name: "Family Savings",
    amount: 200,
    frequency: "monthly",
    memberCount: 6,
  }

  const [startDate, setStartDate] = useState("")
  const [rotationMethod, setRotationMethod] = useState("xnscore")
  const [gracePeriodDays, setGracePeriodDays] = useState("2")
  const [contributionDeadlines, setContributionDeadlines] = useState<
    Array<{ cycle: number; date: string; fullDate: Date }>
  >([])

  const rotationMethods = [
    {
      id: "xnscore",
      name: "By XnScore",
      emoji: "⭐",
      description: "Highest XnScore members get earliest payouts. Rewards reliable savers.",
      recommended: true,
    },
    {
      id: "random",
      name: "Random Draw",
      emoji: "🎲",
      description: "Fair random selection at circle start. Everyone has equal chance.",
      recommended: false,
    },
    {
      id: "manual",
      name: "Manual Assignment",
      emoji: "📋",
      description: "You (as admin) assign the order. Good for agreed arrangements.",
      recommended: false,
    },
  ]

  const gracePeriodOptions = [
    { value: "0", label: "No grace period", description: "Payout triggers immediately when all contribute" },
    { value: "1", label: "1 day", description: "Extra day for stragglers" },
    { value: "2", label: "2 days", description: "Recommended buffer time" },
    { value: "3", label: "3 days", description: "More flexibility for members" },
  ]

  // Calculate contribution deadlines based on start date and frequency
  useEffect(() => {
    if (!startDate) {
      setContributionDeadlines([])
      return
    }

    const deadlines = []
    const start = new Date(startDate)

    for (let i = 0; i < Math.min(circleDetails.memberCount, 6); i++) {
      const deadline = new Date(start)

      switch (circleDetails.frequency) {
        case "daily":
          deadline.setDate(deadline.getDate() + i)
          break
        case "weekly":
          deadline.setDate(deadline.getDate() + i * 7)
          break
        case "biweekly":
          deadline.setDate(deadline.getDate() + i * 14)
          break
        case "monthly":
          deadline.setMonth(deadline.getMonth() + i)
          break
        default:
          deadline.setMonth(deadline.getMonth() + i)
      }

      deadlines.push({
        cycle: i + 1,
        date: deadline.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: deadline.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        }),
        fullDate: deadline,
      })
    }

    setContributionDeadlines(deadlines)
  }, [startDate, circleDetails.frequency, circleDetails.memberCount])

  const getFrequencyLabel = () => {
    switch (circleDetails.frequency) {
      case "daily":
        return "day"
      case "weekly":
        return "week"
      case "biweekly":
        return "2 weeks"
      case "monthly":
        return "month"
      default:
        return "cycle"
    }
  }

  const canContinue = startDate && rotationMethod

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
          padding: "20px",
          borderBottom: "1px solid #E5E7EB",
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
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Schedule & Rotation</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Step 2 of 4</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: step <= 2 ? "#00C6AE" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* How Payouts Work - Info Card */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💡</span>
            <div>
              <p style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "600", color: "#065F46" }}>
                How Payouts Work
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#047857", lineHeight: 1.5 }}>
                Payout happens <strong>automatically</strong> as soon as all {circleDetails.memberCount} members
                contribute for that cycle. No waiting for a specific payout day!
              </p>
            </div>
          </div>
        </div>

        {/* Start Date */}
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
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Circle Start Date
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            First contribution deadline for Cycle 1
          </p>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {startDate && (
            <p style={{ margin: "10px 0 0 0", fontSize: "12px", color: "#00897B" }}>
              ✓ Contributions due every {getFrequencyLabel()} starting{" "}
              {new Date(startDate).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </p>
          )}
        </div>

        {/* Grace Period */}
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
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Grace Period for Late Contributions
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Time after deadline before late fees apply
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {gracePeriodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setGracePeriodDays(option.value)}
                style={{
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: gracePeriodDays === option.value ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: gracePeriodDays === option.value ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Missing Contribution Alert Info */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #F59E0B",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <div>
              <p style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
                Missing Contributions
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#A16207", lineHeight: 1.5 }}>
                If not everyone has contributed by the deadline, the system will automatically send a reminder showing
                who hasn't paid yet. After the grace period, late fees apply.
              </p>
            </div>
          </div>
        </div>

        {/* Rotation Method */}
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
            style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Rotation Order Method
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            How do we decide who gets paid first?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {rotationMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setRotationMethod(method.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: rotationMethod === method.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: rotationMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                  cursor: "pointer",
                  textAlign: "left",
                  position: "relative",
                }}
              >
                {method.recommended && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-8px",
                      right: "12px",
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: "700",
                    }}
                  >
                    RECOMMENDED
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>{method.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{method.name}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.4 }}>
                      {method.description}
                    </p>
                  </div>
                  {rotationMethod === method.id && (
                    <div
                      style={{
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
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Preview */}
        {startDate && contributionDeadlines.length > 0 && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
              Contribution Schedule Preview
            </h4>
            <p style={{ margin: "0 0 14px 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
              Payout releases automatically when all {circleDetails.memberCount} members contribute
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {contributionDeadlines.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: idx === 0 ? "#00C6AE" : "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    {item.cycle}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
                      Cycle {item.cycle}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                      Contribute by {item.date}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#00C6AE" }}>
                      ${circleDetails.amount * circleDetails.memberCount}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>pot</p>
                  </div>
                </div>
              ))}
              {circleDetails.memberCount > 6 && (
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.5)",
                    textAlign: "center",
                  }}
                >
                  +{circleDetails.memberCount - 6} more cycles
                </p>
              )}
            </div>

            {/* Automatic Payout Indicator */}
            <div
              style={{
                marginTop: "14px",
                padding: "10px",
                background: "rgba(0,198,174,0.2)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "16px" }}>⚡</span>
              <p style={{ margin: 0, fontSize: "11px", color: "#00C6AE", lineHeight: 1.4 }}>
                <strong>Auto-Payout:</strong> As soon as all members pay, the pot is released to that cycle's recipient
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
          onClick={() =>
            console.log("Continue", {
              startDate,
              rotationMethod,
              gracePeriodDays: Number.parseInt(gracePeriodDays),
              contributionDeadlines,
            })
          }
          disabled={!canContinue}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canContinue ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canContinue ? "#FFFFFF" : "#9CA3AF",
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
