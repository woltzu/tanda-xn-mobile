"use client"

import { useState } from "react"

export default function ReferralDashboardScreen() {
  const [activeTab, setActiveTab] = useState("overview")

  const user = {
    referralCode: "FRANCK2024",
    tier: "silver",
    totalReferrals: 7,
    activeReferrals: 5,
    pendingRewards: 35,
    lifetimeRewards: 140,
    thisMonthReferrals: 2,
    thisMonthEarnings: 50,
  }

  const referralTiers = [
    { id: "bronze", name: "Bronze", minReferrals: 0, reward: 15, perks: ["$15 per referral"] },
    {
      id: "silver",
      name: "Silver",
      minReferrals: 5,
      reward: 25,
      perks: ["$25 per referral", "+$10 bonus at 10 referrals"],
    },
    {
      id: "gold",
      name: "Gold",
      minReferrals: 15,
      reward: 35,
      perks: ["$35 per referral", "Priority support", "Early feature access"],
    },
    {
      id: "platinum",
      name: "Platinum",
      minReferrals: 30,
      reward: 50,
      perks: ["$50 per referral", "VIP support", "Revenue share option"],
    },
  ]

  const monthlyStats = [
    { month: "Jul", referrals: 1, earnings: 15 },
    { month: "Aug", referrals: 0, earnings: 0 },
    { month: "Sep", referrals: 2, earnings: 50 },
    { month: "Oct", referrals: 1, earnings: 25 },
    { month: "Nov", referrals: 1, earnings: 25 },
    { month: "Dec", referrals: 2, earnings: 50 },
  ]

  const currentTier = referralTiers.find((t) => t.id === user.tier)
  const nextTier = referralTiers.find((t) => t.minReferrals > user.totalReferrals)
  const referralsToNext = nextTier ? nextTier.minReferrals - user.totalReferrals : 0

  const maxEarnings = Math.max(...monthlyStats.map((s) => s.earnings))

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleInvite = () => {
    console.log("Invite clicked")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Referral Program</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Earn rewards for every friend who joins
            </p>
          </div>
        </div>

        {/* Earnings Summary */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Lifetime Earnings</p>
            <p style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "#00C6AE" }}>${user.lifetimeRewards}</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Pending</p>
            <p style={{ margin: 0, fontSize: "32px", fontWeight: "700" }}>${user.pendingRewards}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Tabs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "16px",
            display: "flex",
            gap: "4px",
            border: "1px solid #E5E7EB",
          }}
        >
          {[
            { id: "overview", label: "Overview" },
            { id: "tiers", label: "Tiers" },
            { id: "stats", label: "Stats" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === tab.id ? "#0A2342" : "transparent",
                color: activeTab === tab.id ? "#FFFFFF" : "#6B7280",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Current Tier */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "14px",
                    background: user.tier === "gold" || user.tier === "platinum" ? "#0A2342" : "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                  }}
                >
                  {user.tier === "bronze" && "🥉"}
                  {user.tier === "silver" && "🥈"}
                  {user.tier === "gold" && "🥇"}
                  {user.tier === "platinum" && "💎"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Current Tier</p>
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                    {currentTier?.name} Referrer
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
                    ${currentTier?.reward}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>per referral</p>
                </div>
              </div>

              {/* Progress to Next Tier */}
              {nextTier && (
                <div
                  style={{
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>Progress to {nextTier.name}</span>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                      {user.totalReferrals}/{nextTier.minReferrals}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      background: "#E5E7EB",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(user.totalReferrals / nextTier.minReferrals) * 100}%`,
                        height: "100%",
                        background: "#00C6AE",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                    {referralsToNext} more referrals to unlock ${nextTier.reward}/referral
                  </p>
                </div>
              )}
            </div>

            {/* Your Code */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Your Referral Code</p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "10px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#0A2342",
                      letterSpacing: "2px",
                    }}
                  >
                    {user.referralCode}
                  </p>
                </div>
                <button
                  onClick={handleInvite}
                  style={{
                    background: "#00C6AE",
                    border: "none",
                    borderRadius: "12px",
                    padding: "14px 20px",
                    cursor: "pointer",
                    color: "#FFFFFF",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Share
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Total Referrals</p>
                <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#0A2342" }}>
                  {user.totalReferrals}
                </p>
              </div>
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Active This Month</p>
                <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
                  {user.thisMonthReferrals}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Tiers Tab */}
        {activeTab === "tiers" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Referral Tiers
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {referralTiers.map((tier) => {
                const isCurrentTier = tier.id === user.tier
                const isUnlocked = user.totalReferrals >= tier.minReferrals

                return (
                  <div
                    key={tier.id}
                    style={{
                      padding: "16px",
                      background: isCurrentTier ? "#F0FDFB" : "#F5F7FA",
                      borderRadius: "12px",
                      border: isCurrentTier ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      opacity: isUnlocked ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                      <span style={{ fontSize: "24px" }}>
                        {tier.id === "bronze" && "🥉"}
                        {tier.id === "silver" && "🥈"}
                        {tier.id === "gold" && "🥇"}
                        {tier.id === "platinum" && "💎"}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{tier.name}</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                          {tier.minReferrals}+ referrals
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                          ${tier.reward}
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>per referral</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {tier.perks.map((perk, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: isCurrentTier ? "#00C6AE" : "#E5E7EB",
                            color: isCurrentTier ? "#FFFFFF" : "#6B7280",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "10px",
                            fontWeight: "500",
                          }}
                        >
                          {perk}
                        </span>
                      ))}
                    </div>
                    {isCurrentTier && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px",
                          background: "#00C6AE",
                          borderRadius: "6px",
                          textAlign: "center",
                        }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#FFFFFF" }}>✓ Current Tier</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Monthly Earnings
            </h3>

            {/* Chart */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                height: "120px",
                marginBottom: "8px",
              }}
            >
              {monthlyStats.map((stat, idx) => (
                <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {stat.earnings > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#0A2342", marginBottom: "4px" }}>
                      ${stat.earnings}
                    </span>
                  )}
                  <div
                    style={{
                      width: "100%",
                      height: stat.earnings > 0 ? `${(stat.earnings / maxEarnings) * 100}px` : "4px",
                      background: stat.earnings > 0 ? "#00C6AE" : "#E5E7EB",
                      borderRadius: "4px 4px 0 0",
                      minHeight: "4px",
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {monthlyStats.map((stat, idx) => (
                <div key={idx} style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{stat.month}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "#F5F7FA",
                borderRadius: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "14px", color: "#6B7280" }}>Total (6 months)</span>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                ${monthlyStats.reduce((sum, s) => sum + s.earnings, 0)}
              </span>
            </div>
          </div>
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
        }}
      >
        <button
          onClick={handleInvite}
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Invite Friends & Earn ${currentTier?.reward}
        </button>
      </div>
    </div>
  )
}
