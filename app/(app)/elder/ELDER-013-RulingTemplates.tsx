"use client"

import { useState } from "react"

export default function RulingTemplatesPrecedentsScreen() {
  const [activeTab, setActiveTab] = useState("templates")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [penaltyType, setPenaltyType] = useState("xnscore")
  const [penaltyAmount, setPenaltyAmount] = useState(25)

  const tabs = [
    { id: "templates", label: "Templates", icon: "📋" },
    { id: "precedents", label: "Precedents", icon: "📚" },
    { id: "calculator", label: "Calculator", icon: "🔢" },
  ]

  const templates = [
    {
      id: "t1",
      title: "Missed Payment - First Offense",
      type: "payment",
      usageCount: 234,
      outcome: "Warning + 7-day grace",
      snippet: "Given this is the first recorded missed payment and member has shown good faith...",
    },
    {
      id: "t2",
      title: "Repeated Late Payments",
      type: "payment",
      usageCount: 156,
      outcome: "Penalty + probation",
      snippet: "Considering the pattern of late payments (3+ instances), a formal penalty is warranted...",
    },
    {
      id: "t3",
      title: "Payout Order Dispute",
      type: "trust",
      usageCount: 89,
      outcome: "Adjustment or status quo",
      snippet: "After reviewing the original circle agreement and contribution records...",
    },
    {
      id: "t4",
      title: "Communication Breakdown",
      type: "communication",
      usageCount: 112,
      outcome: "Mediated resolution",
      snippet: "Both parties are directed to follow the communication guidelines...",
    },
  ]

  const precedents = [
    {
      id: "p1",
      caseNumber: "CASE-2024-089",
      title: "Member ghosted after receiving payout",
      outcome: "Full XnScore penalty, circle compensation",
      elder: "Elder Amara",
      date: "Dec 2024",
      similarity: 78,
    },
    {
      id: "p2",
      caseNumber: "CASE-2024-076",
      title: "Disputed payout timing",
      outcome: "Adjusted schedule, no penalty",
      elder: "Elder Kofi",
      date: "Nov 2024",
      similarity: 65,
    },
    {
      id: "p3",
      caseNumber: "CASE-2024-054",
      title: "Payment delay due to emergency",
      outcome: "Grace period extended, documented",
      elder: "Elder Priya",
      date: "Oct 2024",
      similarity: 52,
    },
  ]

  const penaltyTypes = [
    { id: "xnscore", label: "XnScore Deduction", icon: "📉", max: 100 },
    { id: "financial", label: "Financial Penalty", icon: "💰", max: 500 },
    { id: "suspension", label: "Suspension (days)", icon: "⏸️", max: 90 },
  ]

  const filteredTemplates = templates.filter(
    (t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.type.includes(searchQuery.toLowerCase()),
  )

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Ruling Support</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Templates, precedents & penalty calculator
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search templates or cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 14px 14px 44px",
              borderRadius: "12px",
              border: "none",
              background: "#FFFFFF",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
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
        {/* TEMPLATES TAB */}
        {activeTab === "templates" && (
          <>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>
              Select a template that matches your case type
            </p>

            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                style={{
                  width: "100%",
                  background: selectedTemplate?.id === template.id ? "#F0FDFB" : "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: selectedTemplate?.id === template.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{template.title}</h4>
                  <span
                    style={{
                      background: "#F5F7FA",
                      color: "#6B7280",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      fontWeight: "500",
                    }}
                  >
                    {template.type}
                  </span>
                </div>

                <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#6B7280", fontStyle: "italic" }}>
                  "{template.snippet}"
                </p>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "600" }}>
                    Outcome: {template.outcome}
                  </span>
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>Used {template.usageCount} times</span>
                </div>
              </button>
            ))}

            {selectedTemplate && (
              <button
                onClick={() => console.log("Use template:", selectedTemplate)}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "14px",
                  border: "none",
                  background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  marginTop: "10px",
                }}
              >
                Use This Template
              </button>
            )}
          </>
        )}

        {/* PRECEDENTS TAB */}
        {activeTab === "precedents" && (
          <>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>Similar past cases for reference</p>

            {precedents.map((precedent) => (
              <button
                key={precedent.id}
                onClick={() => console.log("View precedent:", precedent)}
                style={{
                  width: "100%",
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: "1px solid #E5E7EB",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "#6B7280", fontFamily: "monospace" }}>
                    {precedent.caseNumber}
                  </span>
                  <div
                    style={{
                      background: precedent.similarity >= 70 ? "#F0FDFB" : "#F5F7FA",
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: precedent.similarity >= 70 ? "#00897B" : "#6B7280",
                      }}
                    >
                      {precedent.similarity}% match
                    </span>
                  </div>
                </div>

                <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  {precedent.title}
                </h4>

                <div
                  style={{
                    background: "#F5F7FA",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", color: "#0A2342" }}>
                    <strong>Outcome:</strong> {precedent.outcome}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>
                    {precedent.elder} • {precedent.date}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </>
        )}

        {/* CALCULATOR TAB */}
        {activeTab === "calculator" && (
          <>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h4 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                Penalty Calculator
              </h4>

              {/* Penalty Type */}
              <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                Penalty Type
              </p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                {penaltyTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setPenaltyType(type.id)}
                    style={{
                      flex: 1,
                      padding: "12px 8px",
                      borderRadius: "10px",
                      border: penaltyType === type.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: penaltyType === type.id ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>{type.icon}</span>
                    <span style={{ fontSize: "11px", fontWeight: "500", color: "#0A2342" }}>{type.label}</span>
                  </button>
                ))}
              </div>

              {/* Amount Slider */}
              <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                Amount:{" "}
                <span style={{ color: "#00C6AE" }}>
                  {penaltyType === "xnscore"
                    ? `-${penaltyAmount} pts`
                    : penaltyType === "financial"
                      ? `$${penaltyAmount}`
                      : `${penaltyAmount} days`}
                </span>
              </p>

              <input
                type="range"
                min="5"
                max={penaltyTypes.find((t) => t.id === penaltyType)?.max || 100}
                value={penaltyAmount}
                onChange={(e) => setPenaltyAmount(Number.parseInt(e.target.value))}
                style={{
                  width: "100%",
                  height: "8px",
                  borderRadius: "4px",
                  background: "#E5E7EB",
                  outline: "none",
                  WebkitAppearance: "none",
                  marginBottom: "20px",
                }}
              />

              {/* Quick Amounts */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                {[10, 25, 50, 75].map((val) => (
                  <button
                    key={val}
                    onClick={() => setPenaltyAmount(val)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: penaltyAmount === val ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: penaltyAmount === val ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0A2342",
                    }}
                  >
                    {penaltyType === "xnscore" ? `-${val}` : penaltyType === "financial" ? `$${val}` : `${val}d`}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Card */}
            <div
              style={{
                background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                borderRadius: "16px",
                padding: "20px",
                color: "#FFFFFF",
              }}
            >
              <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", opacity: 0.8 }}>
                PENALTY PREVIEW
              </h4>

              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Type</span>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>
                    {penaltyTypes.find((t) => t.id === penaltyType)?.label}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Amount</span>
                  <span style={{ fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                    {penaltyType === "xnscore"
                      ? `-${penaltyAmount} XnScore`
                      : penaltyType === "financial"
                        ? `$${penaltyAmount}`
                        : `${penaltyAmount} day suspension`}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", opacity: 0.7 }}>Severity</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      background: penaltyAmount > 50 ? "#FEE2E2" : penaltyAmount > 25 ? "#FEF3C7" : "#F0FDFB",
                      color: penaltyAmount > 50 ? "#DC2626" : penaltyAmount > 25 ? "#D97706" : "#00897B",
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {penaltyAmount > 50 ? "High" : penaltyAmount > 25 ? "Medium" : "Low"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => console.log("Apply penalty:", { type: penaltyType, amount: penaltyAmount })}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#00C6AE",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Apply to Ruling
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
