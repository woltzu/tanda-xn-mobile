"use client"

import { useState } from "react"

export default function VoucherSystemScreen() {
  const [activeTab, setActiveTab] = useState("requests")

  const elderStats = {
    vouchesAvailable: 3,
    maxVouches: 5,
    vouchesUsedThisMonth: 2,
    activeVouches: 8,
    successfulVouches: 47,
    defaultedVouches: 1,
  }

  const activeVouches = [
    {
      id: "v1",
      memberName: "Kofi Mensah",
      memberAvatar: "KM",
      vouchedDate: "Dec 15, 2025",
      boostAmount: 5,
      status: "active",
      expiresIn: "45 days",
    },
    {
      id: "v2",
      memberName: "Fatou Diallo",
      memberAvatar: "FD",
      vouchedDate: "Dec 10, 2025",
      boostAmount: 5,
      status: "active",
      expiresIn: "40 days",
    },
    {
      id: "v3",
      memberName: "Amara Johnson",
      memberAvatar: "AJ",
      vouchedDate: "Nov 28, 2025",
      boostAmount: 5,
      status: "active",
      expiresIn: "28 days",
    },
  ]

  const pendingRequests = [
    {
      id: "r1",
      memberName: "Emmanuel Owusu",
      memberAvatar: "EO",
      xnScore: 52,
      honorScore: 48,
      reason: "First circle, needs trust boost",
      requestedDate: "2 hours ago",
    },
    {
      id: "r2",
      memberName: "Amina Traoré",
      memberAvatar: "AT",
      xnScore: 45,
      honorScore: 42,
      reason: "New member, highly recommended",
      requestedDate: "1 day ago",
    },
  ]

  const getScoreTier = (score: number) => {
    if (score >= 85) return { tier: "Platinum", color: "#00C6AE" }
    if (score >= 70) return { tier: "Gold", color: "#D97706" }
    if (score >= 55) return { tier: "Silver", color: "#6B7280" }
    if (score >= 40) return { tier: "Bronze", color: "#92400E" }
    return { tier: "Provisional", color: "#DC2626" }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 70px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            onClick={() => console.log("Back")}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Vouch for Members</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Help trusted members build credit</p>
          </div>
        </div>

        {/* Vouch Stats */}
        <div
          style={{
            display: "flex",
            gap: "12px",
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "14px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
              {elderStats.vouchesAvailable}
            </p>
            <p style={{ margin: 0, fontSize: "10px", opacity: 0.8 }}>Available</p>
          </div>
          <div
            style={{
              flex: 1,
              padding: "14px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "24px", fontWeight: "700" }}>{elderStats.activeVouches}</p>
            <p style={{ margin: 0, fontSize: "10px", opacity: 0.8 }}>Active</p>
          </div>
          <div
            style={{
              flex: 1,
              padding: "14px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 2px 0", fontSize: "24px", fontWeight: "700" }}>{elderStats.successfulVouches}</p>
            <p style={{ margin: 0, fontSize: "10px", opacity: 0.8 }}>Successful</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-30px", padding: "0 20px" }}>
        {/* Tabs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "16px",
            display: "flex",
            border: "1px solid #E5E7EB",
          }}
        >
          {[
            { id: "requests", label: "Requests", count: pendingRequests.length },
            { id: "active", label: "Active", count: activeVouches.length },
            { id: "history", label: "History", count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "10px",
                background: activeTab === tab.id ? "#0A2342" : "transparent",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: "600",
                color: activeTab === tab.id ? "#FFFFFF" : "#6B7280",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span
                  style={{
                    padding: "2px 6px",
                    background: activeTab === tab.id ? "#00C6AE" : "#E5E7EB",
                    color: activeTab === tab.id ? "#FFFFFF" : "#6B7280",
                    fontSize: "10px",
                    fontWeight: "700",
                    borderRadius: "4px",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pending Requests */}
        {activeTab === "requests" && (
          <div>
            {pendingRequests.length === 0 ? (
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "40px 20px",
                  textAlign: "center",
                  border: "1px solid #E5E7EB",
                }}
              >
                <span style={{ fontSize: "40px" }}>📭</span>
                <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No pending vouch requests</p>
              </div>
            ) : (
              pendingRequests.map((request) => {
                const scoreTier = getScoreTier(request.xnScore)
                return (
                  <div
                    key={request.id}
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "16px",
                      padding: "16px",
                      marginBottom: "12px",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                      <button
                        onClick={() => console.log("View member", request)}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: "#0A2342",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#FFFFFF",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {request.memberAvatar}
                      </button>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                          {request.memberName}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div>
                            <span style={{ fontSize: "11px", color: "#6B7280" }}>XnScore: </span>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: scoreTier.color }}>
                              {request.xnScore}/100
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: "11px", color: "#6B7280" }}>Honor: </span>
                            <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                              {request.honorScore}/100
                            </span>
                          </div>
                        </div>
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: "4px",
                            padding: "2px 6px",
                            background: scoreTier.color + "20",
                            color: scoreTier.color,
                            fontSize: "9px",
                            fontWeight: "700",
                            borderRadius: "4px",
                          }}
                        >
                          {scoreTier.tier}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{request.requestedDate}</span>
                    </div>

                    <div
                      style={{
                        padding: "10px",
                        background: "#F5F7FA",
                        borderRadius: "8px",
                        marginBottom: "14px",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", fontStyle: "italic" }}>
                        "{request.reason}"
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={() => console.log("Deny vouch", request)}
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: "#F5F7FA",
                          borderRadius: "10px",
                          border: "none",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#6B7280",
                          cursor: "pointer",
                        }}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => console.log("Approve vouch", request)}
                        disabled={elderStats.vouchesAvailable === 0}
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: elderStats.vouchesAvailable > 0 ? "#00C6AE" : "#E5E7EB",
                          borderRadius: "10px",
                          border: "none",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: elderStats.vouchesAvailable > 0 ? "#FFFFFF" : "#9CA3AF",
                          cursor: elderStats.vouchesAvailable > 0 ? "pointer" : "not-allowed",
                        }}
                      >
                        Vouch (+5 pts)
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Active Vouches */}
        {activeTab === "active" && (
          <div>
            {activeVouches.map((vouch) => (
              <div
                key={vouch.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "12px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                      }}
                    >
                      {vouch.memberAvatar}
                    </div>
                    <div>
                      <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                        {vouch.memberName}
                      </p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>
                        +{vouch.boostAmount} pts boost • Expires in {vouch.expiresIn}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => console.log("Revoke vouch", vouch)}
                    style={{
                      padding: "6px 12px",
                      background: "#FEE2E2",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#DC2626",
                      cursor: "pointer",
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <span style={{ fontSize: "40px" }}>📊</span>
            <p style={{ margin: "12px 0 4px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              {elderStats.successfulVouches} Successful Vouches
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
              {elderStats.defaultedVouches} vouch{elderStats.defaultedVouches !== 1 ? "es" : ""} resulted in default
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#00897B", fontWeight: "500" }}>
              {Math.round(
                (elderStats.successfulVouches / (elderStats.successfulVouches + elderStats.defaultedVouches)) * 100,
              )}
              % success rate
            </p>
          </div>
        )}

        {/* Warning Note */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#FEF3C7",
            borderRadius: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D97706"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
            <strong>Elder Responsibility:</strong> If a member you vouch for defaults, your Honor Score may be affected.
            Only vouch for members you genuinely trust.
          </p>
        </div>
      </div>
    </div>
  )
}
