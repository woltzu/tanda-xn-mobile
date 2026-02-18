"use client"

import { useState } from "react"

export default function AutoAllocationSettingsScreen() {
  const currentSettings = {
    enabled: false,
    allocations: [],
  }

  const savingsGoals = [
    { id: "wallet", name: "Keep in Wallet", icon: "💵", type: "wallet", tier: null },
    {
      id: "goal1",
      name: "Emergency Fund",
      icon: "🛡️",
      type: "goal",
      tier: "emergency",
      current: 1500,
      target: 3000,
    },
    {
      id: "goal2",
      name: "House Down Payment",
      icon: "🏠",
      type: "goal",
      tier: "locked",
      current: 4200,
      target: 20000,
    },
    {
      id: "goal3",
      name: "Vacation Fund",
      icon: "✈️",
      type: "goal",
      tier: "flexible",
      current: 300,
      target: 2000,
    },
  ]

  const [enabled, setEnabled] = useState(currentSettings.enabled)
  const [allocations, setAllocations] = useState<Array<{ id: string; percentage: number }>>(
    currentSettings.allocations.length > 0 ? currentSettings.allocations : [{ id: "wallet", percentage: 100 }],
  )

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

  const totalAllocated = allocations.reduce((sum, a) => sum + a.percentage, 0)
  const isValid = totalAllocated === 100

  const updateAllocation = (id: string, percentage: number) => {
    setAllocations((prev) => {
      const existing = prev.find((a) => a.id === id)
      if (existing) {
        return prev.map((a) => (a.id === id ? { ...a, percentage } : a))
      } else {
        return [...prev, { id, percentage }]
      }
    })
  }

  const removeAllocation = (id: string) => {
    if (allocations.length > 1) {
      const removed = allocations.find((a) => a.id === id)
      setAllocations((prev) => prev.filter((a) => a.id !== id))
      // Add percentage back to first remaining allocation
      if (removed) {
        setAllocations((prev) => {
          const first = prev[0]
          return prev.map((a, i) => (i === 0 ? { ...a, percentage: a.percentage + removed.percentage } : a))
        })
      }
    }
  }

  const addDestination = (id: string) => {
    if (!allocations.find((a) => a.id === id)) {
      setAllocations((prev) => [...prev, { id, percentage: 0 }])
    }
  }

  const availableToAdd = savingsGoals.filter((g) => !allocations.find((a) => a.id === g.id))

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSave = () => {
    console.log("Save settings:", { enabled, allocations: enabled ? allocations : [] })
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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Auto-Allocation</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Set it once, save every time</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Enable Toggle */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: enabled ? "#F0FDFB" : "#F5F7FA",
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
                  stroke={enabled ? "#00C6AE" : "#6B7280"}
                  strokeWidth="2"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  Auto-Allocate Payouts
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Skip destination choice on each payout
                </p>
              </div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              style={{
                width: "52px",
                height: "32px",
                borderRadius: "16px",
                border: "none",
                background: enabled ? "#00C6AE" : "#E5E7EB",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  position: "absolute",
                  top: "3px",
                  left: enabled ? "23px" : "3px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>
        </div>

        {enabled && (
          <>
            {/* Allocation Summary */}
            <div
              style={{
                background: totalAllocated === 100 ? "#F0FDFB" : "#FEF3C7",
                borderRadius: "12px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={totalAllocated === 100 ? "#00897B" : "#D97706"}
                strokeWidth="2"
              >
                {totalAllocated === 100 ? (
                  <>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </>
                )}
              </svg>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "500",
                  color: totalAllocated === 100 ? "#065F46" : "#92400E",
                }}
              >
                {totalAllocated === 100
                  ? "100% allocated - You're all set!"
                  : `${totalAllocated}% allocated - ${100 - totalAllocated}% unassigned`}
              </p>
            </div>

            {/* Current Allocations */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                When I receive a payout, send:
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {allocations.map((alloc) => {
                  const dest = savingsGoals.find((g) => g.id === alloc.id)
                  if (!dest) return null
                  const tierBadge = dest.tier ? getTierBadge(dest.tier) : null

                  return (
                    <div
                      key={alloc.id}
                      style={{
                        padding: "14px",
                        background: "#F5F7FA",
                        borderRadius: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "24px" }}>{dest.icon}</span>
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
                        {allocations.length > 1 && (
                          <button
                            onClick={() => removeAllocation(alloc.id)}
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#FEE2E2",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#DC2626"
                              strokeWidth="2"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Percentage Slider */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={alloc.percentage}
                          onChange={(e) => updateAllocation(alloc.id, Number.parseInt(e.target.value))}
                          style={{
                            flex: 1,
                            height: "8px",
                            borderRadius: "4px",
                            appearance: "none",
                            background: `linear-gradient(to right, #00C6AE 0%, #00C6AE ${alloc.percentage}%, #E5E7EB ${alloc.percentage}%, #E5E7EB 100%)`,
                            cursor: "pointer",
                          }}
                        />
                        <div
                          style={{
                            width: "60px",
                            padding: "8px",
                            background: "#FFFFFF",
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            textAlign: "center",
                          }}
                        >
                          <span style={{ fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                            {alloc.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add Destination */}
              {availableToAdd.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Add another destination:</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {availableToAdd.map((dest) => (
                      <button
                        key={dest.id}
                        onClick={() => addDestination(dest.id)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px dashed #00C6AE",
                          background: "#F0FDFB",
                          fontSize: "12px",
                          fontWeight: "500",
                          color: "#00897B",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>{dest.icon}</span>
                        <span>{dest.name}</span>
                        <span style={{ color: "#00C6AE" }}>+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Example */}
            <div
              style={{
                background: "#0A2342",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                Example: If you receive $1,000
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {allocations
                  .filter((a) => a.percentage > 0)
                  .map((alloc) => {
                    const dest = savingsGoals.find((g) => g.id === alloc.id)
                    const amount = ((1000 * alloc.percentage) / 100).toFixed(0)
                    return (
                      <div key={alloc.id} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                          {dest?.icon} {dest?.name}
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>${amount}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </>
        )}

        {/* Info when disabled */}
        {!enabled && (
          <div
            style={{
              background: "#F5F7FA",
              borderRadius: "14px",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#E5E7EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "28px",
              }}
            >
              🎯
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              You'll choose each time
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}>
              When you receive a payout, you'll be asked where you want it to go. Enable auto-allocation to skip this
              step.
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
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
          onClick={handleSave}
          disabled={enabled && !isValid}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: !enabled || isValid ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: !enabled || isValid ? "#FFFFFF" : "#9CA3AF",
            cursor: !enabled || isValid ? "pointer" : "not-allowed",
          }}
        >
          Save Settings
        </button>
      </div>
    </div>
  )
}
