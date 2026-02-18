"use client"

import { useState } from "react"

export default function ElderCouncilInterfaceScreen() {
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedMatter, setSelectedMatter] = useState<any>(null)
  const [voteChoice, setVoteChoice] = useState<"for" | "against" | null>(null)
  const [voteReason, setVoteReason] = useState("")

  const councilMember = {
    name: "Elder Franck",
    rank: "Grand Elder",
    votingPower: 3,
    councilTenure: "8 months",
  }

  const pendingMatters = [
    {
      id: "m1",
      type: "appeal",
      title: "Appeal: Case #2024-089 ruling disputed",
      submittedBy: "Member David Adebayo",
      originalElder: "Elder Kofi",
      daysOpen: 3,
      votesFor: 4,
      votesAgainst: 2,
      votesNeeded: 7,
      status: "voting",
    },
    {
      id: "m2",
      type: "precedent",
      title: "New precedent: Grace period extension for emergencies",
      submittedBy: "Elder Amara",
      daysOpen: 5,
      votesFor: 6,
      votesAgainst: 1,
      votesNeeded: 7,
      status: "voting",
    },
    {
      id: "m3",
      type: "rule_change",
      title: "Proposal: Increase default penalty from 10% to 15%",
      submittedBy: "Elder Council",
      daysOpen: 7,
      votesFor: 3,
      votesAgainst: 4,
      votesNeeded: 7,
      status: "voting",
    },
  ]

  const recentDecisions = [
    {
      id: "d1",
      title: "Standardized vouching cool-down period",
      outcome: "Approved",
      date: "Dec 28, 2024",
    },
    {
      id: "d2",
      title: "Appeal: Case #2024-072 - Ruling upheld",
      outcome: "Denied",
      date: "Dec 20, 2024",
    },
  ]

  const tabs = [
    { id: "pending", label: "Pending", count: pendingMatters.length },
    { id: "decided", label: "Decided", count: recentDecisions.length },
    { id: "propose", label: "Propose" },
  ]

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "appeal":
        return { bg: "#FEF3C7", color: "#D97706", icon: "⚖️", label: "Appeal" }
      case "precedent":
        return { bg: "#F0FDFB", color: "#00897B", icon: "📚", label: "Precedent" }
      case "rule_change":
        return { bg: "#E8F4F8", color: "#0A2342", icon: "📜", label: "Rule Change" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", icon: "📋", label: type }
    }
  }

  const handleVote = () => {
    if (selectedMatter && voteChoice) {
      console.log("Vote cast:", {
        matterId: selectedMatter.id,
        vote: voteChoice,
        reason: voteReason,
      })
      setSelectedMatter(null)
      setVoteChoice(null)
      setVoteReason("")
    }
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
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
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
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Elder Council</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Grand Elder Governance
            </p>
          </div>
          <div
            style={{
              background: "rgba(0,198,174,0.3)",
              padding: "6px 12px",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "600" }}>🏛️ {councilMember.rank}</span>
          </div>
        </div>

        {/* Council Stats */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
              {councilMember.votingPower}
            </p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Voting Power</p>
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
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{pendingMatters.length}</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Pending Votes</p>
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
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{councilMember.councilTenure}</p>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Tenure</p>
          </div>
        </div>
      </div>

      {/* Tabs - Teal accent */}
      <div
        style={{
          display: "flex",
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          padding: "0 20px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "14px 8px",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #00C6AE" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? "600" : "500",
                color: activeTab === tab.id ? "#0A2342" : "#6B7280",
              }}
            >
              {tab.label}
            </span>
            {tab.count !== undefined && (
              <span
                style={{
                  background: activeTab === tab.id ? "#00C6AE" : "#F5F7FA",
                  color: activeTab === tab.id ? "#FFFFFF" : "#6B7280",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* PENDING TAB */}
        {activeTab === "pending" && (
          <>
            {pendingMatters.map((matter) => {
              const typeStyle = getTypeStyle(matter.type)

              return (
                <div
                  key={matter.id}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    marginBottom: "12px",
                    border: "1px solid #E5E7EB",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "16px" }}>
                    {/* Type Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                      <span
                        style={{
                          background: typeStyle.bg,
                          color: typeStyle.color,
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {typeStyle.icon} {typeStyle.label}
                      </span>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>{matter.daysOpen} days open</span>
                    </div>

                    {/* Title */}
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {matter.title}
                    </h4>
                    <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>
                      Submitted by: {matter.submittedBy}
                    </p>

                    {/* Vote Progress */}
                    <div style={{ marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", color: "#00897B", fontWeight: "600" }}>
                          ✓ For: {matter.votesFor}
                        </span>
                        <span style={{ fontSize: "12px", color: "#6B7280" }}>
                          {matter.votesFor + matter.votesAgainst} / {matter.votesNeeded} votes
                        </span>
                        <span style={{ fontSize: "12px", color: "#D97706", fontWeight: "600" }}>
                          ✗ Against: {matter.votesAgainst}
                        </span>
                      </div>
                      <div
                        style={{
                          height: "8px",
                          background: "#E5E7EB",
                          borderRadius: "4px",
                          overflow: "hidden",
                          display: "flex",
                        }}
                      >
                        <div
                          style={{
                            width: `${(matter.votesFor / matter.votesNeeded) * 100}%`,
                            background: "#00C6AE",
                            transition: "width 0.3s ease",
                          }}
                        />
                        <div
                          style={{
                            width: `${(matter.votesAgainst / matter.votesNeeded) * 100}%`,
                            background: "#D97706",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vote Button - Teal */}
                  <button
                    onClick={() => setSelectedMatter(matter)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      border: "none",
                      borderTop: "1px solid #E5E7EB",
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Cast Your Vote
                  </button>
                </div>
              )
            })}
          </>
        )}

        {/* DECIDED TAB */}
        {activeTab === "decided" && (
          <>
            {recentDecisions.map((decision) => (
              <div
                key={decision.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{decision.title}</h4>
                  <span
                    style={{
                      background: decision.outcome === "Approved" ? "#F0FDFB" : "#FEF3C7",
                      color: decision.outcome === "Approved" ? "#00897B" : "#D97706",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      fontWeight: "600",
                    }}
                  >
                    {decision.outcome}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{decision.date}</p>
              </div>
            ))}
          </>
        )}

        {/* PROPOSE TAB */}
        {activeTab === "propose" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Propose New Matter
            </h3>

            {[
              {
                type: "rule_change",
                title: "Rule Change",
                desc: "Propose changes to TandaXn policies",
                icon: "📜",
              },
              {
                type: "precedent",
                title: "New Precedent",
                desc: "Establish a ruling as precedent",
                icon: "📚",
              },
              {
                type: "emergency",
                title: "Emergency Request",
                desc: "Urgent matter requiring council attention",
                icon: "⚡",
              },
            ].map((item) => (
              <button
                key={item.type}
                onClick={() => console.log("Propose:", item.type)}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "28px" }}>{item.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{item.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voting Modal */}
      {selectedMatter && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "20px",
              width: "100%",
              maxWidth: "400px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>Cast Your Vote</h3>
              <button
                onClick={() => {
                  setSelectedMatter(null)
                  setVoteChoice(null)
                  setVoteReason("")
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {selectedMatter.title}
              </h4>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                Your voting power: {councilMember.votingPower} votes
              </p>
            </div>

            {/* Vote Options */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={() => setVoteChoice("for")}
                style={{
                  flex: 1,
                  padding: "20px",
                  borderRadius: "14px",
                  border: voteChoice === "for" ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: voteChoice === "for" ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>✓</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#00897B" }}>Vote For</span>
              </button>
              <button
                onClick={() => setVoteChoice("against")}
                style={{
                  flex: 1,
                  padding: "20px",
                  borderRadius: "14px",
                  border: voteChoice === "against" ? "2px solid #D97706" : "1px solid #E5E7EB",
                  background: voteChoice === "against" ? "#FEF3C7" : "#FFFFFF",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>✗</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>Vote Against</span>
              </button>
            </div>

            {/* Reason */}
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A2342",
                marginBottom: "8px",
              }}
            >
              Reason (optional)
            </label>
            <textarea
              value={voteReason}
              onChange={(e) => setVoteReason(e.target.value)}
              placeholder="Explain your vote for the record..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
                minHeight: "80px",
                resize: "none",
                marginBottom: "20px",
              }}
            />

            <button
              onClick={handleVote}
              disabled={!voteChoice}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "none",
                background: voteChoice ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E5E7EB",
                color: voteChoice ? "#FFFFFF" : "#9CA3AF",
                fontSize: "16px",
                fontWeight: "700",
                cursor: voteChoice ? "pointer" : "not-allowed",
              }}
            >
              Submit Vote
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
