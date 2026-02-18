"use client"

import { useState, useEffect } from "react"

export default function MediationToolkit() {
  const [activeTab, setActiveTab] = useState("overview")
  const [privateNotes, setPrivateNotes] = useState("")
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [recordingConsent, setRecordingConsent] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null)

  const caseData = {
    id: "case-002",
    title: "Suspected payout manipulation",
    circleName: "Business Owners Fund",
    severity: "high",
    openedAt: "Jan 2, 2025",
    parties: [
      { id: "p1", name: "David Adebayo", role: "complainant", avatar: "D" },
      { id: "p2", name: "Sarah Okafor", role: "respondent", avatar: "S" },
    ],
    evidence: [
      { id: "e1", type: "document", title: "Payment records Dec 2024", uploadedBy: "David", date: "Jan 2" },
      { id: "e2", type: "chat", title: "Group chat screenshots", uploadedBy: "David", date: "Jan 2" },
      { id: "e3", type: "document", title: "Circle agreement", uploadedBy: "Sarah", date: "Jan 3" },
      { id: "e4", type: "statement", title: "Written statement", uploadedBy: "Sarah", date: "Jan 3" },
    ],
    timeline: [
      { action: "Case opened", by: "System", date: "Jan 2, 10:30 AM" },
      { action: "Evidence submitted", by: "David", date: "Jan 2, 11:15 AM" },
      { action: "Response submitted", by: "Sarah", date: "Jan 3, 2:00 PM" },
      { action: "Mediation scheduled", by: "Elder Franck", date: "Jan 4, 9:00 AM" },
    ],
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: "📋" },
    { id: "evidence", label: "Evidence", icon: "📎" },
    { id: "notes", label: "Notes", icon: "📝" },
    { id: "timeline", label: "Timeline", icon: "⏱️" },
  ]

  const templatePhrases = [
    "Thank you both for joining this mediation session.",
    "Let's hear from each party, starting with the complainant.",
    "I want to ensure both sides feel heard.",
    "Based on the evidence, my preliminary observation is...",
    "Let's take a 5-minute break to reflect.",
    "Are both parties willing to consider a compromise?",
  ]

  useEffect(() => {
    if (sessionActive) {
      const interval = setInterval(() => {
        setSessionTime((prev) => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [sessionActive])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case "document":
        return "📄"
      case "chat":
        return "💬"
      case "statement":
        return "✍️"
      case "image":
        return "🖼️"
      default:
        return "📎"
    }
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
      {/* Header */}
      <div
        style={{
          background: sessionActive
            ? "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)"
            : "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => console.log("Go back")}
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
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>
              {sessionActive ? "🔴 LIVE MEDIATION" : "Mediation Toolkit"}
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Case #{caseData.id}</p>
          </div>
          {sessionActive && (
            <div
              style={{
                background: "rgba(255,255,255,0.2)",
                padding: "8px 16px",
                borderRadius: "20px",
                fontFamily: "monospace",
                fontSize: "16px",
                fontWeight: "700",
              }}
            >
              {formatTime(sessionTime)}
            </div>
          )}
        </div>

        {/* Case Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600" }}>{caseData.title}</h3>
          <div style={{ display: "flex", gap: "16px" }}>
            <span style={{ fontSize: "13px", opacity: 0.8 }}>{caseData.circleName}</span>
            <span style={{ fontSize: "13px", opacity: 0.8 }}>{caseData.parties.length} parties</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
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
            <span style={{ fontSize: "14px" }}>{tab.icon}</span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? "600" : "500",
                color: activeTab === tab.id ? "#0A2342" : "#6B7280",
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* Parties */}
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
              Parties Involved
            </h3>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              {caseData.parties.map((party) => (
                <div
                  key={party.id}
                  style={{
                    flex: 1,
                    background: "#FFFFFF",
                    borderRadius: "14px",
                    padding: "16px",
                    border: "1px solid #E5E7EB",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background:
                        party.role === "complainant"
                          ? "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)"
                          : "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "#FFFFFF",
                      margin: "0 auto 10px auto",
                    }}
                  >
                    {party.avatar}
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{party.name}</p>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "6px",
                      background: party.role === "complainant" ? "#DBEAFE" : "#FEF3C7",
                      color: party.role === "complainant" ? "#1D4ED8" : "#D97706",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                  >
                    {party.role}
                  </span>
                </div>
              ))}
            </div>

            {/* Session Controls */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
                Session Controls
              </h4>

              {!sessionActive ? (
                <>
                  <button
                    onClick={() => setRecordingConsent(!recordingConsent)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      background: recordingConsent ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        border: recordingConsent ? "none" : "2px solid #E5E7EB",
                        background: recordingConsent ? "#00C6AE" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {recordingConsent && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: "14px", color: "#0A2342", textAlign: "left" }}>
                      All parties consent to session recording
                    </span>
                  </button>

                  <button
                    onClick={() => setSessionActive(true)}
                    disabled={!recordingConsent}
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "none",
                      background: recordingConsent ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E5E7EB",
                      color: recordingConsent ? "#FFFFFF" : "#9CA3AF",
                      fontSize: "15px",
                      fontWeight: "700",
                      cursor: recordingConsent ? "pointer" : "not-allowed",
                    }}
                  >
                    Start Mediation Session
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#6B7280",
                      cursor: "pointer",
                    }}
                  >
                    ⏸️ Pause
                  </button>
                  <button
                    onClick={() => setSessionActive(false)}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: "12px",
                      border: "none",
                      background: "#DC2626",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    End Session
                  </button>
                </div>
              )}
            </div>

            {/* Template Phrases */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
                💬 Neutral Phrases
              </h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>Tap to copy to clipboard</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {templatePhrases.map((phrase, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigator.clipboard?.writeText(phrase)}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      background: "#F5F7FA",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "13px",
                      color: "#0A2342",
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* EVIDENCE TAB */}
        {activeTab === "evidence" && (
          <>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
              Submitted Evidence ({caseData.evidence.length})
            </h3>

            {caseData.evidence.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedEvidence(item)}
                style={{
                  width: "100%",
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: "1px solid #E5E7EB",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  {getEvidenceIcon(item.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{item.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    Uploaded by {item.uploadedBy} • {item.date}
                  </p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
              Private Notes
            </h3>
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>
              Only visible to you. Export for ruling draft.
            </p>

            <textarea
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              placeholder="Document your observations, key points, and preliminary findings..."
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
                minHeight: "200px",
                resize: "none",
                lineHeight: 1.6,
              }}
            />

            <button
              onClick={() => console.log("Save notes:", privateNotes)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "#0A2342",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                marginTop: "12px",
              }}
            >
              Save Notes
            </button>
          </>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
              Case Timeline
            </h3>

            {caseData.timeline.map((event, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "14px",
                  marginBottom: "16px",
                  position: "relative",
                }}
              >
                {/* Timeline line */}
                {idx < caseData.timeline.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "7px",
                      top: "20px",
                      width: "2px",
                      height: "calc(100% + 8px)",
                      background: "#E5E7EB",
                    }}
                  />
                )}

                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: idx === 0 ? "#00C6AE" : "#E5E7EB",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />

                <div
                  style={{
                    flex: 1,
                    background: "#FFFFFF",
                    borderRadius: "12px",
                    padding: "14px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{event.action}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    {event.by} • {event.date}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#6B7280",
              cursor: "pointer",
            }}
          >
            Request More Info
          </button>
          <button
            onClick={() => console.log("Issue ruling")}
            style={{
              flex: 2,
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
              fontSize: "14px",
              fontWeight: "700",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Issue Ruling
          </button>
        </div>
      </div>
    </div>
  )
}
