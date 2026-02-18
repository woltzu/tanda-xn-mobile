"use client"

import { useState } from "react"

export default function SendingPowerDashboardScreen() {
  const [user] = useState({
    name: "Franck",
    currentTier: "verified", // starter, verified, trusted, premium
    monthlyLimit: 2000,
    monthlyUsed: 450,
    totalSent: 12500,
    memberSince: "Oct 2025",
  })

  const [tiers] = useState([
    {
      id: "starter",
      name: "Starter",
      badge: "🌱",
      color: "#9CA3AF",
      limit: 500,
      requirements: ["Email verified", "Phone verified"],
      unlocked: true,
    },
    {
      id: "verified",
      name: "Verified",
      badge: "✅",
      color: "#00C6AE",
      limit: 2000,
      requirements: ["Government ID", "Selfie verification"],
      unlocked: true,
    },
    {
      id: "trusted",
      name: "Trusted",
      badge: "⭐",
      color: "#F59E0B",
      limit: 10000,
      requirements: ["Proof of address", "Source of funds"],
      unlocked: false,
    },
    {
      id: "premium",
      name: "Premium",
      badge: "💎",
      color: "#8B5CF6",
      limit: 50000,
      requirements: ["Enhanced verification", "Account review"],
      unlocked: false,
    },
  ])

  const [corridorLimits] = useState([
    { country: "India", flag: "🇮🇳", dailyLimit: 1000, used: 0 },
    { country: "Nigeria", flag: "🇳🇬", dailyLimit: 500, used: 200 },
    { country: "Philippines", flag: "🇵🇭", dailyLimit: 1000, used: 0 },
  ])

  const currentTierData = tiers.find((t) => t.id === user.currentTier)
  const nextTierData = tiers.find((t) => !t.unlocked)
  const usedPercentage = (user.monthlyUsed / user.monthlyLimit) * 100
  const remainingLimit = user.monthlyLimit - user.monthlyUsed

  const handleBack = () => console.log("Navigate back")
  const handleUnlockMore = () => console.log("Navigate to unlock next level")
  const handleViewCorridorLimits = () => console.log("View all corridor limits")
  const handleViewHistory = () => console.log("View sending history")

  if (!currentTierData) return null

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header - Navy with Power Theme */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 100px 20px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Your Sending Power</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Unlock higher limits by leveling up</p>
          </div>
        </div>

        {/* Current Tier Badge */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${currentTierData.color}40, ${currentTierData.color}20)`,
              border: `3px solid ${currentTierData.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontSize: "40px",
            }}
          >
            {currentTierData.badge}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "700" }}>{currentTierData.name} Sender</h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>${user.monthlyLimit.toLocaleString()}/month limit</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Monthly Usage Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>This Month's Usage</h3>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>Resets in 12 days</span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: "12px",
              background: "#F5F7FA",
              borderRadius: "6px",
              overflow: "hidden",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: `${Math.min(usedPercentage, 100)}%`,
                height: "100%",
                background: usedPercentage > 80 ? "#F59E0B" : "#00C6AE",
                borderRadius: "6px",
                transition: "width 0.5s ease",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
                ${remainingLimit.toLocaleString()}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>remaining this month</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>
                ${user.monthlyUsed.toLocaleString()} used
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                of ${user.monthlyLimit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Unlock More Power CTA */}
        {nextTierData && (
          <button
            onClick={handleUnlockMore}
            style={{
              width: "100%",
              padding: "20px",
              background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
              borderRadius: "16px",
              border: "none",
              cursor: "pointer",
              marginBottom: "16px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  background: `linear-gradient(135deg, ${nextTierData.color}40, ${nextTierData.color}20)`,
                  border: `2px solid ${nextTierData.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                {nextTierData.badge}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#FFFFFF" }}>
                  Unlock {nextTierData.name} Level
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                  Send up to ${nextTierData.limit.toLocaleString()}/month
                </p>
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  background: nextTierData.color,
                  borderRadius: "20px",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                UNLOCK →
              </div>
            </div>
          </button>
        )}

        {/* Tier Progress */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Your Journey</h3>

          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
            {/* Progress Line */}
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "40px",
                right: "40px",
                height: "3px",
                background: "#E5E7EB",
                zIndex: 0,
              }}
            >
              <div
                style={{
                  width: `${(tiers.findIndex((t) => t.id === user.currentTier) / (tiers.length - 1)) * 100}%`,
                  height: "100%",
                  background: "#00C6AE",
                }}
              />
            </div>

            {tiers.map((tier) => (
              <div key={tier.id} style={{ textAlign: "center", zIndex: 1 }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: tier.unlocked ? tier.color : "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 8px auto",
                    fontSize: "18px",
                    opacity: tier.unlocked ? 1 : 0.5,
                  }}
                >
                  {tier.badge}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "10px",
                    fontWeight: "600",
                    color: tier.unlocked ? "#0A2342" : "#9CA3AF",
                  }}
                >
                  {tier.name}
                </p>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "9px",
                    color: "#6B7280",
                  }}
                >
                  ${tier.limit.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Corridor Limits Preview */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Country Limits</h3>
            <button
              onClick={handleViewCorridorLimits}
              style={{
                padding: "4px 10px",
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              View All →
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {corridorLimits.slice(0, 3).map((corridor) => (
              <div
                key={corridor.country}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "24px" }}>{corridor.flag}</span>
                <p style={{ margin: "6px 0 2px 0", fontSize: "11px", color: "#6B7280" }}>
                  ${corridor.dailyLimit - corridor.used} left
                </p>
                <div
                  style={{
                    height: "4px",
                    background: "#E5E7EB",
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(corridor.used / corridor.dailyLimit) * 100}%`,
                      height: "100%",
                      background: "#00C6AE",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
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
              fontSize: "24px",
            }}
          >
            🌍
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              ${user.totalSent.toLocaleString()}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>
              Total sent since {user.memberSince}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      {nextTierData && (
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
            onClick={handleUnlockMore}
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
            <span style={{ fontSize: "18px" }}>{nextTierData.badge}</span>
            Unlock ${nextTierData.limit.toLocaleString()}/month Limit
          </button>
        </div>
      )}
    </div>
  )
}
