"use client"

import { useState } from "react"

export default function CreateCircleDetailsScreen() {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [frequency, setFrequency] = useState("monthly")
  const [memberCount, setMemberCount] = useState("")

  const frequencies = [
    { id: "daily", label: "Daily", description: "Every day" },
    { id: "weekly", label: "Weekly", description: "Every 7 days" },
    { id: "biweekly", label: "Bi-weekly", description: "Every 14 days" },
    { id: "monthly", label: "Monthly", description: "Once a month" },
  ]

  const quickAmounts = [50, 100, 200, 500]
  const quickSizes = [5, 6, 8, 10, 12]

  const parsedMemberCount = Number.parseInt(memberCount) || 0
  const totalPot = Number.parseFloat(amount || 0) * parsedMemberCount

  const getCycleDuration = () => {
    if (parsedMemberCount === 0) return "—"
    switch (frequency) {
      case "daily":
        return `${parsedMemberCount} days`
      case "weekly":
        return `${parsedMemberCount} weeks`
      case "biweekly":
        return `${parsedMemberCount * 2} weeks`
      case "monthly":
        return `${parsedMemberCount} months`
      default:
        return `${parsedMemberCount} cycles`
    }
  }

  const isValidMemberCount = parsedMemberCount >= 3 && parsedMemberCount <= 50
  const isValidAmount = Number.parseFloat(amount) >= 10
  const isValidName = name.trim().length >= 3
  const canContinue = isValidName && isValidAmount && isValidMemberCount

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Circle Details</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Step 1 of 4</p>
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
                background: step === 1 ? "#00C6AE" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Circle Name */}
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
            Circle Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Family Savings, Travel Fund"
            maxLength={30}
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
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#9CA3AF", textAlign: "right" }}>
            {name.length}/30
          </p>
        </div>

        {/* Number of Members - Manual Entry */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: memberCount && !isValidMemberCount ? "1px solid #DC2626" : "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Number of Members
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            How many people will be in this circle? (Including yourself)
          </p>

          {/* Manual Input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "10px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "24px" }}>👥</span>
            <input
              type="number"
              value={memberCount}
              onChange={(e) => setMemberCount(e.target.value)}
              placeholder="Enter number"
              min="3"
              max="50"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "24px",
                fontWeight: "700",
                color: "#0A2342",
                outline: "none",
                width: "100%",
              }}
            />
            <span style={{ fontSize: "14px", color: "#6B7280" }}>members</span>
          </div>

          {/* Quick Select Buttons */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {quickSizes.map((size) => (
              <button
                key={size}
                onClick={() => setMemberCount(size.toString())}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: memberCount === size.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: memberCount === size.toString() ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                {size}
              </button>
            ))}
          </div>

          {/* Validation Messages */}
          {memberCount && !isValidMemberCount && (
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#DC2626" }}>
              {parsedMemberCount < 3 ? "Minimum 3 members required" : "Maximum 50 members allowed"}
            </p>
          )}
          {!memberCount && (
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Min: 3 members • Max: 50 members</p>
          )}
        </div>

        {/* Contribution Amount */}
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
            Contribution Amount (per cycle)
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "10px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "20px", fontWeight: "600", color: "#0A2342" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="10"
              max="500"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "28px",
                fontWeight: "700",
                color: "#0A2342",
                outline: "none",
                width: "100%",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: amount === amt.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: amount === amt.toString() ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Min: $10 • Max: $500 per cycle</p>
        </div>

        {/* Frequency */}
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
            Contribution Frequency
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Match your income cycle - daily earners can choose daily contributions
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {frequencies.map((freq) => (
              <button
                key={freq.id}
                onClick={() => setFrequency(freq.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: frequency === freq.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: frequency === freq.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{freq.label}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{freq.description}</p>
                </div>
                {frequency === freq.id && (
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
              </button>
            ))}
          </div>
        </div>

        {/* Summary Card */}
        {amount && Number.parseFloat(amount) > 0 && isValidMemberCount && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
              Circle Summary
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Members</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
                  {parsedMemberCount} people
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Each contribution</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>${amount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Pot each cycle</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                  ${totalPot.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Full cycle duration</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>{getCycleDuration()}</span>
              </div>
            </div>

            {/* Info about payout logic */}
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                background: "rgba(0,198,174,0.2)",
                borderRadius: "8px",
              }}
            >
              <p style={{ margin: 0, fontSize: "11px", color: "#00C6AE", lineHeight: 1.4 }}>
                💡 Payout happens automatically once all {parsedMemberCount} members contribute each cycle
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
              name,
              amount: Number.parseFloat(amount),
              frequency,
              memberCount: parsedMemberCount,
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
