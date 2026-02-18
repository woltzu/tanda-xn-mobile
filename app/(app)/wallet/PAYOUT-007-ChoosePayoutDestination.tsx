"use client"

import { useState } from "react"

export default function ChoosePayoutDestinationScreen() {
  const payout = {
    amount: 1224,
    circleName: "Family Savings Circle",
  }

  const savingsGoals = [
    { id: "goal1", name: "Emergency Fund", tier: "emergency", icon: "🛡️", current: 1500, target: 3000, penalty: "5%" },
    {
      id: "goal2",
      name: "House Down Payment",
      tier: "locked",
      icon: "🏠",
      current: 4200,
      target: 20000,
      penalty: "10%",
    },
    { id: "goal3", name: "Vacation Fund", tier: "flexible", icon: "✈️", current: 300, target: 2000, penalty: "0.5%" },
  ]

  const linkedBank = { name: "Chase Bank", last4: "4532" }
  const hasAutoAllocation = false

  const [selected, setSelected] = useState<string | null>(null)

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case "flexible":
        return { label: "Flexible", color: "#00C6AE", bg: "#F0FDFB", desc: "0.5% early withdrawal" }
      case "emergency":
        return { label: "Emergency", color: "#D97706", bg: "#FEF3C7", desc: "5% early withdrawal" }
      case "locked":
        return { label: "Locked", color: "#0A2342", bg: "#F5F7FA", desc: "10% early withdrawal • Best yield" }
      default:
        return { label: "", color: "#6B7280", bg: "#F5F7FA", desc: "" }
    }
  }

  const getProgress = (current: number, target: number) => Math.min((current / target) * 100, 100)

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSelectDestination = (destination: string | null) => {
    console.log("Selected destination:", destination)
  }

  const handleSplitAllocation = () => {
    console.log("Split allocation")
  }

  const handleSetupAutoAllocation = () => {
    console.log("Setup auto-allocation")
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Where Should It Go?</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{payout.circleName}</p>
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Your Payout</p>
          <p style={{ margin: 0, fontSize: "42px", fontWeight: "700", color: "#00C6AE" }}>
            ${payout.amount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Quick Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* Keep in Wallet */}
          <button
            onClick={() => setSelected("wallet")}
            style={{
              width: "100%",
              padding: "14px",
              background: selected === "wallet" ? "#F0FDFB" : "#F5F7FA",
              borderRadius: "12px",
              border: selected === "wallet" ? "2px solid #00C6AE" : "1px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              💵
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Keep in Wallet</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Available anytime • No restrictions
              </p>
            </div>
            {selected === "wallet" && (
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>

          {/* Withdraw to Bank */}
          <button
            onClick={() => setSelected("bank")}
            style={{
              width: "100%",
              padding: "14px",
              background: selected === "bank" ? "#F0FDFB" : "#F5F7FA",
              borderRadius: "12px",
              border: selected === "bank" ? "2px solid #00C6AE" : "1px solid transparent",
              cursor: "pointer",
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
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              🏦
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Withdraw to Bank</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                {linkedBank.name} •••• {linkedBank.last4}
              </p>
            </div>
            {selected === "bank" && (
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>
        </div>

        {/* Savings Goals */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Add to Savings Goal
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {savingsGoals.map((goal) => {
              const tierInfo = getTierInfo(goal.tier)
              const progress = getProgress(goal.current, goal.target)

              return (
                <button
                  key={goal.id}
                  onClick={() => setSelected(goal.id)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: selected === goal.id ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "12px",
                    border: selected === goal.id ? "2px solid #00C6AE" : "1px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: tierInfo.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                      }}
                    >
                      {goal.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{goal.name}</p>
                        <span
                          style={{
                            background: tierInfo.bg,
                            color: tierInfo.color,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "9px",
                            fontWeight: "600",
                          }}
                        >
                          {tierInfo.label}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "#6B7280" }}>{tierInfo.desc}</p>

                      {/* Progress Bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            flex: 1,
                            height: "6px",
                            background: "#E5E7EB",
                            borderRadius: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${progress}%`,
                              height: "100%",
                              background: "#00C6AE",
                              borderRadius: "3px",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "11px", color: "#6B7280" }}>
                          ${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {selected === goal.id && (
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Split Option */}
        <button
          onClick={handleSplitAllocation}
          style={{
            width: "100%",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "2px dashed #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 0 20" />
              <path d="M12 12L12 2" />
              <path d="M12 12L20 16" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#00C6AE" }}>Split Between Multiple</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Customize how your payout is divided
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Auto-Allocation Hint */}
        {!hasAutoAllocation && (
          <button
            onClick={handleSetupAutoAllocation}
            style={{
              width: "100%",
              padding: "14px",
              background: "#F0FDFB",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: "12px", color: "#065F46", flex: 1, textAlign: "left" }}>
              <strong>Tip:</strong> Set up auto-allocation to skip this step next time
            </p>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
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
          onClick={() => handleSelectDestination(selected)}
          disabled={!selected}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: selected ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: selected ? "#FFFFFF" : "#9CA3AF",
            cursor: selected ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
