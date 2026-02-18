"use client"

import { useState } from "react"

export default function CaseAssignmentQueue() {
  const [isAvailable, setIsAvailable] = useState(true)
  const [filterType, setFilterType] = useState("all")
  const [showOnlyMatching, setShowOnlyMatching] = useState(false)
  const [selectedCase, setSelectedCase] = useState<any>(null)

  const elderSpecializations = ["financial", "trust"]
  const currentLoad = 2
  const maxLoad = 5

  const cases = [
    {
      id: "case-001",
      type: "payment",
      severity: "medium",
      title: "Missed bi-weekly contribution",
      circleName: "Lagos Traders",
      partiesInvolved: 2,
      openedDays: 3,
      estimatedTime: "2h",
      reward: { honorScore: 25, fee: 5 },
      matchesSpecialization: false,
    },
    {
      id: "case-002",
      type: "trust",
      severity: "high",
      title: "Suspected payout manipulation",
      circleName: "Business Owners Fund",
      partiesInvolved: 4,
      openedDays: 1,
      estimatedTime: "4h",
      reward: { honorScore: 50, fee: 15 },
      matchesSpecialization: true,
    },
    {
      id: "case-003",
      type: "communication",
      severity: "low",
      title: "Member ghosting group chat",
      circleName: "Tech Savers",
      partiesInvolved: 2,
      openedDays: 5,
      estimatedTime: "1h",
      reward: { honorScore: 15, fee: 3 },
      matchesSpecialization: false,
    },
    {
      id: "case-004",
      type: "financial",
      severity: "high",
      title: "Dispute over payout order",
      circleName: "Diaspora Fund",
      partiesInvolved: 6,
      openedDays: 2,
      estimatedTime: "3h",
      reward: { honorScore: 40, fee: 10 },
      matchesSpecialization: true,
    },
  ]

  const caseTypes = [
    { id: "all", label: "All", icon: "📋" },
    { id: "payment", label: "Payment", icon: "💸" },
    { id: "trust", label: "Trust", icon: "🤝" },
    { id: "financial", label: "Financial", icon: "💰" },
    { id: "communication", label: "Communication", icon: "💬" },
  ]

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "high":
        return { bg: "#FEE2E2", color: "#DC2626", label: "High" }
      case "medium":
        return { bg: "#FEF3C7", color: "#D97706", label: "Medium" }
      case "low":
        return { bg: "#F0FDFB", color: "#00897B", label: "Low" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: severity }
    }
  }

  const filteredCases = cases.filter(
    (c) => (filterType === "all" || c.type === filterType) && (!showOnlyMatching || c.matchesSpecialization),
  )

  const handleToggleAvailability = () => {
    setIsAvailable(!isAvailable)
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Case Queue</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              {filteredCases.length} cases awaiting Elder review
            </p>
          </div>
        </div>

        {/* Availability Toggle + Load */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleToggleAvailability}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: isAvailable ? "rgba(0,198,174,0.2)" : "rgba(255,255,255,0.1)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: isAvailable ? "#00C6AE" : "#6B7280",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
              {isAvailable ? "Available" : "Unavailable"}
            </span>
          </button>

          <div
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.1)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "14px", color: "#FFFFFF" }}>
              Load:{" "}
              <strong>
                {currentLoad}/{maxLoad}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          {caseTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id)}
              style={{
                padding: "8px 14px",
                borderRadius: "20px",
                border: "none",
                background: filterType === type.id ? "#0A2342" : "#FFFFFF",
                color: filterType === type.id ? "#FFFFFF" : "#0A2342",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </button>
          ))}
        </div>

        {/* Show Matching Toggle */}
        <button
          onClick={() => setShowOnlyMatching(!showOnlyMatching)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: showOnlyMatching ? "#F0FDFB" : "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>🎯</span>
            <span style={{ fontSize: "14px", color: "#0A2342" }}>Show only my specializations</span>
          </div>
          <div
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              background: showOnlyMatching ? "#00C6AE" : "#E5E7EB",
              padding: "2px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#FFFFFF",
                transform: showOnlyMatching ? "translateX(20px)" : "translateX(0)",
                transition: "transform 0.2s ease",
              }}
            />
          </div>
        </button>

        {/* Case List */}
        {filteredCases.map((caseItem) => {
          const severityStyle = getSeverityStyle(caseItem.severity)
          return (
            <div
              key={caseItem.id}
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                marginBottom: "12px",
                border: caseItem.matchesSpecialization ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                overflow: "hidden",
              }}
            >
              {/* Case Header */}
              <div style={{ padding: "16px", paddingBottom: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: severityStyle.bg,
                        color: severityStyle.color,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                      }}
                    >
                      {severityStyle.label}
                    </span>
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
                      {caseItem.type}
                    </span>
                    {caseItem.matchesSpecialization && (
                      <span
                        style={{
                          background: "#F0FDFB",
                          color: "#00897B",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontWeight: "600",
                        }}
                      >
                        🎯 Match
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>{caseItem.openedDays}d ago</span>
                </div>

                <h4 style={{ margin: "0 0 6px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  {caseItem.title}
                </h4>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                  {caseItem.circleName} • {caseItem.partiesInvolved} parties
                </p>
              </div>

              {/* Case Footer */}
              <div
                style={{
                  padding: "12px 16px",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>~{caseItem.estimatedTime}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "600" }}>
                      +{caseItem.reward.honorScore} HS
                    </span>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>• ${caseItem.reward.fee}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCase(caseItem)}
                  disabled={currentLoad >= maxLoad}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: currentLoad >= maxLoad ? "#E5E7EB" : "#00C6AE",
                    color: currentLoad >= maxLoad ? "#9CA3AF" : "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: currentLoad >= maxLoad ? "not-allowed" : "pointer",
                  }}
                >
                  Take Case
                </button>
              </div>
            </div>
          )
        })}

        {filteredCases.length === 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "40px" }}>📭</span>
            <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No cases match your filters</p>
          </div>
        )}
      </div>

      {/* Case Accept Modal */}
      {selectedCase && (
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
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>Accept Case?</h3>
              <button
                onClick={() => setSelectedCase(null)}
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
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                {selectedCase.title}
              </h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>{selectedCase.circleName}</p>
              <div style={{ display: "flex", gap: "16px" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>⏱️ ~{selectedCase.estimatedTime}</span>
                <span style={{ fontSize: "13px", color: "#00C6AE", fontWeight: "600" }}>
                  +{selectedCase.reward.honorScore} HS
                </span>
              </div>
            </div>

            <div
              style={{
                background: "#FEF3C7",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <span style={{ fontSize: "13px", color: "#92400E" }}>You'll have 7 days to resolve this case</span>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setSelectedCase(null)}
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
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log("Accept case:", selectedCase)
                  setSelectedCase(null)
                }}
                style={{
                  flex: 2,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Accept Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
