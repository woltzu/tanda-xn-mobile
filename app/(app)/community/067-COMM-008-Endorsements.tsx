"use client"

import { useState } from "react"

export default function EndorsementsScreen() {
  const [activeTab, setActiveTab] = useState("received")
  const [endorseText, setEndorseText] = useState("")
  const [selectedMember, setSelectedMember] = useState<any>(null)

  const currentUser = {
    endorsementsReceived: 12,
    endorsementsGiven: 8,
    xnScoreBonus: 6,
  }

  const receivedEndorsements = [
    {
      id: 1,
      from: "Kwame M.",
      message: "Always pays on time. Great circle member!",
      date: "Dec 15, 2024",
      avatar: "K",
    },
    { id: 2, from: "Amara O.", message: "Trustworthy and reliable", date: "Dec 10, 2024", avatar: "A" },
    { id: 3, from: "Marie C.", message: "Helped me understand how tandas work", date: "Nov 28, 2024", avatar: "M" },
    { id: 4, from: "Samuel O.", message: "Solid saver, highly recommend", date: "Nov 15, 2024", avatar: "S" },
  ]

  const pendingEndorsements = [
    { id: 1, to: "David N.", circleId: "c1", circleName: "Family Fund", avatar: "D" },
    { id: 2, to: "Fatima H.", circleId: "c2", circleName: "Travel Crew", avatar: "F" },
  ]

  const endorsementTemplates = [
    "Always pays on time 💯",
    "Trustworthy and reliable",
    "Great circle member!",
    "Highly recommend",
    "Excellent saver",
  ]

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleEndorse = (member: any, text: string) => {
    console.log("Endorsing", member, text)
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Endorsements</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Build trust in the community</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.7 }}>Received</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>{currentUser.endorsementsReceived}</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.7 }}>Given</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>{currentUser.endorsementsGiven}</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>XnScore Bonus</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
              +{currentUser.xnScoreBonus}
            </p>
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
            { id: "received", label: "Received" },
            { id: "give", label: "Give Endorsement" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "12px",
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

        {/* Received Tab */}
        {activeTab === "received" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            {receivedEndorsements.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {receivedEndorsements.map((endorsement) => (
                  <div
                    key={endorsement.id}
                    style={{
                      padding: "16px",
                      background: "#F5F7FA",
                      borderRadius: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "#0A2342",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "600",
                          fontSize: "16px",
                          flexShrink: 0,
                        }}
                      >
                        {endorsement.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                            {endorsement.from}
                          </span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </div>
                        <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#0A2342", lineHeight: 1.4 }}>
                          "{endorsement.message}"
                        </p>
                        <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{endorsement.date}</p>
                      </div>
                    </div>
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
                  💝
                </div>
                <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                  No endorsements yet
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Join circles and build your reputation</p>
              </div>
            )}
          </div>
        )}

        {/* Give Endorsement Tab */}
        {activeTab === "give" && (
          <>
            {/* Circle Members to Endorse */}
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
                Circle Members You Can Endorse
              </h3>

              {pendingEndorsements.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {pendingEndorsements.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      style={{
                        width: "100%",
                        padding: "14px",
                        background: selectedMember?.id === member.id ? "#F0FDFB" : "#F5F7FA",
                        borderRadius: "12px",
                        border: selectedMember?.id === member.id ? "2px solid #00C6AE" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "#0A2342",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "600",
                          fontSize: "16px",
                        }}
                      >
                        {member.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{member.to}</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{member.circleName}</p>
                      </div>
                      {selectedMember?.id === member.id && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "20px" }}>
                  No circle members available to endorse
                </p>
              )}
            </div>

            {/* Write Endorsement */}
            {selectedMember && (
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  Endorse {selectedMember.to}
                </h3>

                {/* Quick Templates */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                  {endorsementTemplates.map((template, idx) => (
                    <button
                      key={idx}
                      onClick={() => setEndorseText(template)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "20px",
                        border: endorseText === template ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                        background: endorseText === template ? "#F0FDFB" : "#FFFFFF",
                        fontSize: "12px",
                        color: "#0A2342",
                        cursor: "pointer",
                      }}
                    >
                      {template}
                    </button>
                  ))}
                </div>

                {/* Text Input */}
                <textarea
                  value={endorseText}
                  onChange={(e) => setEndorseText(e.target.value)}
                  placeholder="Write your endorsement..."
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    fontSize: "14px",
                    outline: "none",
                    resize: "none",
                    minHeight: "80px",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />

                {/* Submit Button */}
                <button
                  onClick={() => handleEndorse(selectedMember, endorseText)}
                  disabled={!endorseText.trim()}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "none",
                    background: endorseText.trim() ? "#00C6AE" : "#E5E7EB",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: endorseText.trim() ? "#FFFFFF" : "#9CA3AF",
                    cursor: endorseText.trim() ? "pointer" : "not-allowed",
                    marginTop: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  Send Endorsement
                </button>
              </div>
            )}
          </>
        )}

        {/* Info Note */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
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
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>XnScore boost:</strong> Each endorsement you receive adds +0.5 to your XnScore (max +10). Only
            circle members who've been with you for 30+ days can endorse you.
          </p>
        </div>
      </div>
    </div>
  )
}
