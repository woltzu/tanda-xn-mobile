"use client"

import { useState } from "react"

export default function SplitAllocationScreen() {
  const payout = {
    amount: 1224,
    circleName: "Family Savings Circle",
  }

  const destinations = [
    { id: "wallet", name: "Keep in Wallet", icon: "💵", type: "wallet", tier: null },
    { id: "goal1", name: "Emergency Fund", icon: "🛡️", type: "goal", tier: "emergency" },
    { id: "goal2", name: "House Down Payment", icon: "🏠", type: "goal", tier: "locked" },
    { id: "goal3", name: "Vacation Fund", icon: "✈️", type: "goal", tier: "flexible" },
  ]

  // Initialize with wallet getting 100%
  const [allocations, setAllocations] = useState({
    wallet: 100,
    goal1: 0,
    goal2: 0,
    goal3: 0,
  })

  const [activeDestinations, setActiveDestinations] = useState(["wallet"])

  const getTierBadge = (tier: string | null) => {
    switch (tier) {
      case "flexible":
        return { label: "Flexible", color: "#00C6AE", bg: "#F0FDFB" }
      case "emergency":
        return { label: "Emergency", color: "#D97706", bg: "#FEF3C7" }
      case "locked":
        return { label: "Locked", color: "#0A2342", bg: "#F5F7FA" }
      default:
        return null
    }
  }

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0)
  const isValid = totalAllocated === 100

  const handleSliderChange = (id: string, newValue: number) => {
    const otherActiveIds = activeDestinations.filter((d) => d !== id)
    const otherTotal = otherActiveIds.reduce(
      (sum, otherId) => sum + allocations[otherId as keyof typeof allocations],
      0,
    )

    // Ensure we don't exceed 100%
    const maxAllowed = 100 - otherTotal
    const clampedValue = Math.min(Math.max(0, newValue), maxAllowed)

    setAllocations((prev) => ({
      ...prev,
      [id]: clampedValue,
    }))
  }

  const toggleDestination = (id: string) => {
    if (activeDestinations.includes(id)) {
      // Remove destination
      if (activeDestinations.length > 1) {
        setActiveDestinations((prev) => prev.filter((d) => d !== id))
        // Redistribute allocation to wallet
        setAllocations((prev) => ({
          ...prev,
          [id]: 0,
          wallet: prev.wallet + prev[id as keyof typeof prev],
        }))
      }
    } else {
      // Add destination with 0%
      setActiveDestinations((prev) => [...prev, id])
    }
  }

  const getAmount = (percentage: number) => ((payout.amount * percentage) / 100).toFixed(2)

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleConfirm = () => {
    const result = activeDestinations
      .filter((id) => allocations[id as keyof typeof allocations] > 0)
      .map((id) => ({
        ...destinations.find((d) => d.id === id),
        percentage: allocations[id as keyof typeof allocations],
        amount: Number.parseFloat(getAmount(allocations[id as keyof typeof allocations])),
      }))
    console.log("Confirm allocation:", result)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Split Your Payout</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Drag sliders to allocate</p>
          </div>
        </div>

        {/* Total Display */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Total to Allocate</p>
          <p style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "#00C6AE" }}>
            ${payout.amount.toLocaleString()}
          </p>
          <div
            style={{
              marginTop: "12px",
              height: "8px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${totalAllocated}%`,
                height: "100%",
                background: totalAllocated === 100 ? "#00C6AE" : "#D97706",
                borderRadius: "4px",
                transition: "width 0.2s",
              }}
            />
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
            {totalAllocated}% allocated {totalAllocated !== 100 && `(${100 - totalAllocated}% remaining)`}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Allocation Sliders */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Allocations</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {destinations.map((dest) => {
              const isActive = activeDestinations.includes(dest.id)
              const tierBadge = dest.tier ? getTierBadge(dest.tier) : null
              const percentage = allocations[dest.id as keyof typeof allocations] || 0
              const amount = getAmount(percentage)

              return (
                <div
                  key={dest.id}
                  style={{
                    padding: "14px",
                    background: isActive ? "#F5F7FA" : "#FAFAFA",
                    borderRadius: "12px",
                    opacity: isActive ? 1 : 0.6,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: isActive ? "12px" : 0 }}
                  >
                    <button
                      onClick={() => toggleDestination(dest.id)}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        border: isActive ? "none" : "2px solid #D1D5DB",
                        background: isActive ? "#00C6AE" : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <span style={{ fontSize: "22px" }}>{dest.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{dest.name}</span>
                        {tierBadge && (
                          <span
                            style={{
                              background: tierBadge.bg,
                              color: tierBadge.color,
                              padding: "2px 5px",
                              borderRadius: "4px",
                              fontSize: "9px",
                              fontWeight: "600",
                            }}
                          >
                            {tierBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "16px",
                          fontWeight: "700",
                          color: isActive && percentage > 0 ? "#00C6AE" : "#9CA3AF",
                        }}
                      >
                        {percentage}%
                      </p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>${amount}</p>
                    </div>
                  </div>

                  {isActive && (
                    <div style={{ paddingLeft: "36px" }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={percentage}
                        onChange={(e) => handleSliderChange(dest.id, Number.parseInt(e.target.value))}
                        style={{
                          width: "100%",
                          height: "8px",
                          borderRadius: "4px",
                          appearance: "none",
                          background: `linear-gradient(to right, #00C6AE 0%, #00C6AE ${percentage}%, #E5E7EB ${percentage}%, #E5E7EB 100%)`,
                          cursor: "pointer",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>0%</span>
                        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>100%</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Presets */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Quick Presets</h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setActiveDestinations(["wallet"])
                setAllocations({ wallet: 100, goal1: 0, goal2: 0, goal3: 0 })
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              100% Wallet
            </button>
            <button
              onClick={() => {
                setActiveDestinations(["wallet", "goal1"])
                setAllocations({ wallet: 50, goal1: 50, goal2: 0, goal3: 0 })
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              50/50 Split
            </button>
            <button
              onClick={() => {
                setActiveDestinations(["goal1", "goal2", "goal3"])
                setAllocations({ wallet: 0, goal1: 34, goal2: 33, goal3: 33 })
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              All to Goals
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Summary & Button */}
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
        {/* Summary */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {activeDestinations
            .filter((id) => allocations[id as keyof typeof allocations] > 0)
            .map((id) => {
              const dest = destinations.find((d) => d.id === id)
              return (
                <span
                  key={id}
                  style={{
                    background: "#F0FDFB",
                    color: "#00897B",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  {dest?.icon} {allocations[id as keyof typeof allocations]}% → {dest?.name}
                </span>
              )
            })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!isValid}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isValid ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: isValid ? "#FFFFFF" : "#9CA3AF",
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          {isValid ? "Confirm Allocation" : `Allocate ${100 - totalAllocated}% More`}
        </button>
      </div>
    </div>
  )
}
