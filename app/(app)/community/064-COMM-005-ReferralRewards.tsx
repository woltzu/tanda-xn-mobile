"use client"

import { useState } from "react"

export default function ReferralRewardsScreen() {
  const [activeTab, setActiveTab] = useState("available")

  const pendingRewards = [
    { id: 1, referralName: "Amara O.", amount: 25, status: "pending", daysLeft: 5, progress: 80 },
    { id: 2, referralName: "David N.", amount: 10, status: "pending", daysLeft: 12, progress: 40 },
  ]
  const availableRewards = [{ id: 3, referralName: "Samuel O.", amount: 25, earnedAt: "Dec 15, 2024" }]
  const claimedRewards = [
    { id: 4, referralName: "Kwame M.", amount: 25, claimedAt: "Nov 20, 2024" },
    { id: 5, referralName: "Marie C.", amount: 25, claimedAt: "Oct 5, 2024" },
  ]
  const totalPending = 35
  const totalAvailable = 25
  const totalClaimed = 140

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleClaimReward = (reward: any) => {
    console.log("Claiming reward:", reward)
  }

  const handleClaimAll = () => {
    console.log("Claiming all rewards")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: totalAvailable > 0 ? "120px" : "40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
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
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>My Rewards</h1>
        </div>

        {/* Summary Stats */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "10px", opacity: 0.7 }}>Pending</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>${totalPending}</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.3)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "10px", opacity: 0.8 }}>Available</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>${totalAvailable}</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "10px", opacity: 0.7 }}>Claimed</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>${totalClaimed}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
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
            { id: "available", label: "Available", count: availableRewards.length },
            { id: "pending", label: "Pending", count: pendingRewards.length },
            { id: "claimed", label: "Claimed", count: claimedRewards.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === tab.id ? "#0A2342" : "transparent",
                color: activeTab === tab.id ? "#FFFFFF" : "#6B7280",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  style={{
                    background: activeTab === tab.id ? "#00C6AE" : "#E5E7EB",
                    color: activeTab === tab.id ? "#FFFFFF" : "#6B7280",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "10px",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Available Rewards */}
        {activeTab === "available" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            {availableRewards.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {availableRewards.map((reward) => (
                  <div
                    key={reward.id}
                    style={{
                      padding: "16px",
                      background: "#F0FDFB",
                      borderRadius: "12px",
                      border: "1px solid #00C6AE",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "#00C6AE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                          <circle cx="12" cy="8" r="7" />
                          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                          {reward.referralName} joined!
                        </p>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                          Earned {reward.earnedAt}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                          +${reward.amount}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleClaimReward(reward)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#00C6AE",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        cursor: "pointer",
                        marginTop: "12px",
                      }}
                    >
                      Claim ${reward.amount}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px auto",
                    fontSize: "28px",
                  }}
                >
                  🎁
                </div>
                <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                  No rewards available yet
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Invite friends to earn rewards</p>
              </div>
            )}
          </div>
        )}

        {/* Pending Rewards */}
        {activeTab === "pending" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
              Rewards unlock when your referral completes their first deposit
            </p>
            {pendingRewards.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pendingRewards.map((reward) => (
                  <div
                    key={reward.id}
                    style={{
                      padding: "14px",
                      background: "#F5F7FA",
                      borderRadius: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: "#E5E7EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                          {reward.referralName}
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                          {reward.daysLeft} days left to complete
                        </p>
                      </div>
                      <span style={{ fontSize: "16px", fontWeight: "600", color: "#9CA3AF" }}>${reward.amount}</span>
                    </div>
                    <div
                      style={{
                        height: "6px",
                        background: "#E5E7EB",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${reward.progress}%`,
                          height: "100%",
                          background: "#00C6AE",
                          borderRadius: "3px",
                        }}
                      />
                    </div>
                    <p style={{ margin: "6px 0 0 0", fontSize: "10px", color: "#9CA3AF", textAlign: "right" }}>
                      {reward.progress}% complete
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>No pending rewards</p>
              </div>
            )}
          </div>
        )}

        {/* Claimed Rewards */}
        {activeTab === "claimed" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            {claimedRewards.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {claimedRewards.map((reward) => (
                  <div
                    key={reward.id}
                    style={{
                      padding: "12px",
                      background: "#F5F7FA",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                        {reward.referralName}
                      </p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>{reward.claimedAt}</p>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#6B7280" }}>+${reward.amount}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>No claimed rewards yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Claim All Button */}
      {totalAvailable > 0 && (
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
            onClick={handleClaimAll}
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
            }}
          >
            Claim All (${totalAvailable})
          </button>
        </div>
      )}
    </div>
  )
}
