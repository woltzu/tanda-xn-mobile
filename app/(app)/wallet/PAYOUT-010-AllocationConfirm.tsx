"use client"

import { useState } from "react"

export default function AllocationConfirmScreen() {
  const payout = {
    amount: 1224,
    bonus: 24,
    circleName: "Family Savings Circle",
    cycleNumber: 3,
  }

  const allocations = [
    { id: "goal1", name: "Emergency Fund", icon: "🛡️", tier: "emergency", percentage: 50, amount: 612 },
    { id: "goal2", name: "House Down Payment", icon: "🏠", tier: "locked", percentage: 30, amount: 367.2 },
    { id: "wallet", name: "Keep in Wallet", icon: "💵", tier: null, percentage: 20, amount: 244.8 },
  ]

  const [isProcessing, setIsProcessing] = useState(false)

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

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleEdit = () => {
    console.log("Edit allocation")
  }

  const handleConfirm = () => {
    setIsProcessing(true)
    console.log("Confirm allocation:", allocations)
  }

  const handleSaveAsDefault = () => {
    console.log("Save as default allocation")
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Confirm Allocation</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Review before confirming</p>
          </div>
          <button
            onClick={handleEdit}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
        </div>

        {/* Amount */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Total Payout</p>
          <p style={{ margin: 0, fontSize: "42px", fontWeight: "700", color: "#00C6AE" }}>
            ${payout.amount.toLocaleString()}
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
            {payout.circleName} • Cycle {payout.cycleNumber}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Allocation Breakdown */}
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
            Your payout will be sent to:
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {allocations.map((alloc) => {
              const tierBadge = alloc.tier ? getTierBadge(alloc.tier) : null

              return (
                <div
                  key={alloc.id}
                  style={{
                    padding: "16px",
                    background: "#F5F7FA",
                    borderRadius: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "12px",
                        background: alloc.tier ? "#F0FDFB" : "#0A2342",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "26px",
                      }}
                    >
                      {alloc.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{alloc.name}</p>
                        {tierBadge && (
                          <span
                            style={{
                              background: tierBadge.bg,
                              color: tierBadge.color,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "9px",
                              fontWeight: "600",
                            }}
                          >
                            {tierBadge.label}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{alloc.percentage}% of payout</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                        $
                        {alloc.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total</span>
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              ${payout.amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Visual Breakdown */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Allocation Overview
          </h3>

          {/* Stacked Bar */}
          <div
            style={{ height: "24px", borderRadius: "12px", overflow: "hidden", display: "flex", marginBottom: "12px" }}
          >
            {allocations.map((alloc) => {
              return (
                <div
                  key={alloc.id}
                  style={{
                    width: `${alloc.percentage}%`,
                    height: "100%",
                    background:
                      alloc.tier === "emergency" ? "#D97706" : alloc.tier === "locked" ? "#0A2342" : "#00C6AE",
                  }}
                />
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {allocations.map((alloc) => (
              <div key={alloc.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background:
                      alloc.tier === "emergency" ? "#D97706" : alloc.tier === "locked" ? "#0A2342" : "#00C6AE",
                  }}
                />
                <span style={{ fontSize: "12px", color: "#6B7280" }}>
                  {alloc.icon} {alloc.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Save as Default Option */}
        <button
          onClick={handleSaveAsDefault}
          style={{
            width: "100%",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
            border: "1px solid #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#00897B" }}>
              Save as my default allocation
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Use this for all future payouts</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Confirm Button */}
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
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46" }}>
            Your funds will be transferred instantly after confirmation
          </p>
        </div>
        <button
          onClick={handleConfirm}
          disabled={isProcessing}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isProcessing ? "#9CA3AF" : "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: isProcessing ? "not-allowed" : "pointer",
          }}
        >
          {isProcessing ? "Processing..." : "Confirm & Receive Payout"}
        </button>
      </div>
    </div>
  )
}
