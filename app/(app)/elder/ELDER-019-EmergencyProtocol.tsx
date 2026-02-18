"use client"

import { useState } from "react"

export default function EmergencyProtocol() {
  const [showInitiateModal, setShowInitiateModal] = useState(false)
  const [emergencyType, setEmergencyType] = useState("")
  const [description, setDescription] = useState("")
  const [targetIds, setTargetIds] = useState("")
  const [selectedPower, setSelectedPower] = useState("")
  const [confirmAction, setConfirmAction] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const activeEmergencies = [
    {
      id: "em1",
      type: "fraud",
      title: "Suspected coordinated fraud - 3 circles",
      reportedBy: "Elder Kofi",
      reportedAt: "2 hours ago",
      severity: "critical",
      assignedElders: ["Elder Amara", "Elder James"],
      status: "investigating",
      affectedMembers: 24,
      affectedAmount: 4800,
    },
  ]

  const emergencyTypes = [
    { id: "fraud", label: "Suspected Fraud", icon: "🚨", color: "#D97706" },
    { id: "abuse", label: "Member Abuse", icon: "⚠️", color: "#D97706" },
    { id: "dispute", label: "Critical Dispute", icon: "⚡", color: "#0A2342" },
    { id: "system", label: "System Issue", icon: "🔧", color: "#6B7280" },
  ]

  const emergencyPowers = [
    {
      id: "freeze_account",
      label: "Freeze Account(s)",
      icon: "🔒",
      description: "Temporarily suspend account access",
      requiresApproval: false,
    },
    {
      id: "suspend_circle",
      label: "Suspend Circle",
      icon: "⏸️",
      description: "Halt all circle activity pending review",
      requiresApproval: false,
    },
    {
      id: "freeze_payouts",
      label: "Freeze Payouts",
      icon: "💸",
      description: "Hold all scheduled payouts",
      requiresApproval: true,
    },
    {
      id: "multi_elder",
      label: "Multi-Elder Assignment",
      icon: "👥",
      description: "Assign 3+ Elders to complex case",
      requiresApproval: false,
    },
  ]

  const handleInitiate = () => {
    if (!emergencyType || description.length < 50) return
    setIsProcessing(true)
    setTimeout(() => {
      console.log("Initiated emergency:", { type: emergencyType, description, targetIds })
      setIsProcessing(false)
      setShowInitiateModal(false)
      setEmergencyType("")
      setDescription("")
      setTargetIds("")
    }, 2000)
  }

  const handleActivatePower = () => {
    if (!selectedPower || !confirmAction) return
    setIsProcessing(true)
    setTimeout(() => {
      console.log("Activated power:", { power: selectedPower, targetIds })
      setIsProcessing(false)
      setSelectedPower("")
      setConfirmAction(false)
    }, 1500)
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
      {/* Header - Navy with Amber accent for urgency */}
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>⚠️ Emergency Protocol</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Critical intervention tools
            </p>
          </div>
        </div>

        {/* Active Count - Amber indicator */}
        {activeEmergencies.length > 0 && (
          <div
            style={{
              background: "rgba(217, 119, 6, 0.3)",
              borderRadius: "12px",
              padding: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#D97706",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: "600" }}>
              {activeEmergencies.length} active emergency protocol(s)
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Initiate Emergency Button - Amber for caution */}
        <button
          onClick={() => setShowInitiateModal(true)}
          style={{
            width: "100%",
            padding: "20px",
            borderRadius: "16px",
            border: "2px dashed #D97706",
            background: "#FEF3C7",
            cursor: "pointer",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "24px" }}>⚠️</span>
          <span style={{ fontSize: "16px", fontWeight: "700", color: "#D97706" }}>Initiate Emergency Protocol</span>
        </button>

        {/* Active Emergencies */}
        {activeEmergencies.length > 0 && (
          <>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
              Active Emergencies
            </h3>

            {activeEmergencies.map((emergency) => (
              <div
                key={emergency.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "20px",
                  marginBottom: "12px",
                  border: "2px solid #FEF3C7",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        background: "#D97706",
                        color: "#FFFFFF",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      {emergency.severity.toUpperCase()}
                    </span>
                    <span
                      style={{
                        background: "#FEF3C7",
                        color: "#D97706",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                      }}
                    >
                      {emergency.type.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{emergency.reportedAt}</span>
                </div>

                <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                  {emergency.title}
                </h4>
                <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>
                  Reported by: {emergency.reportedBy}
                </p>

                {/* Impact Stats */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
                  <div
                    style={{
                      background: "#FEF3C7",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#D97706" }}>
                      {emergency.affectedMembers}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#92400E" }}>Members</p>
                  </div>
                  <div
                    style={{
                      background: "#FEF3C7",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#D97706" }}>
                      ${emergency.affectedAmount.toLocaleString()}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#92400E" }}>At Risk</p>
                  </div>
                </div>

                {/* Assigned Elders */}
                <div style={{ marginBottom: "14px" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                    Assigned Elders
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {emergency.assignedElders.map((elder, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: "#F5F7FA",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#0A2342",
                        }}
                      >
                        👑 {elder}
                      </span>
                    ))}
                    <button
                      style={{
                        background: "#FFFFFF",
                        border: "1px dashed #00C6AE",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#00C6AE",
                        cursor: "pointer",
                      }}
                    >
                      + Add Elder
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div
                  style={{
                    background: "#E8F4F8",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "#0A2342", fontWeight: "500" }}>
                    Status: {emergency.status.charAt(0).toUpperCase() + emergency.status.slice(1)}
                  </span>
                </div>

                {/* View Details */}
                <button
                  onClick={() => console.log("View emergency", emergency)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0A2342",
                    cursor: "pointer",
                    marginTop: "14px",
                  }}
                >
                  View Full Details
                </button>
              </div>
            ))}
          </>
        )}

        {/* Emergency Powers Section */}
        <h3 style={{ margin: "20px 0 12px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
          Emergency Powers
        </h3>

        {emergencyPowers.map((power) => (
          <button
            key={power.id}
            onClick={() => setSelectedPower(power.id === selectedPower ? "" : power.id)}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: selectedPower === power.id ? "2px solid #D97706" : "1px solid #E5E7EB",
              background: selectedPower === power.id ? "#FEF3C7" : "#FFFFFF",
              cursor: "pointer",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: selectedPower === power.id ? "#D97706" : "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              {power.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{power.label}</p>
                {power.requiresApproval && (
                  <span
                    style={{
                      background: "#FEF3C7",
                      color: "#D97706",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600",
                    }}
                  >
                    Requires Approval
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>{power.description}</p>
            </div>
          </button>
        ))}

        {/* Activate Power Section */}
        {selectedPower && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              marginTop: "20px",
              border: "2px solid #D97706",
            }}
          >
            <h4 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
              Activate: {emergencyPowers.find((p) => p.id === selectedPower)?.label}
            </h4>

            {/* Target IDs */}
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A2342",
                marginBottom: "6px",
              }}
            >
              Target IDs <span style={{ fontWeight: "400", color: "#6B7280" }}>(comma separated)</span>
            </label>
            <input
              type="text"
              value={targetIds}
              onChange={(e) => setTargetIds(e.target.value)}
              placeholder="user_123, circle_456"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "14px",
              }}
            />

            {/* Confirmation */}
            <button
              onClick={() => setConfirmAction(!confirmAction)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: confirmAction ? "#FEF3C7" : "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  border: confirmAction ? "none" : "2px solid #E5E7EB",
                  background: confirmAction ? "#D97706" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {confirmAction && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: "13px", color: "#0A2342", textAlign: "left" }}>
                I confirm this is a legitimate emergency requiring immediate action
              </span>
            </button>

            <button
              onClick={handleActivatePower}
              disabled={!confirmAction || !targetIds || isProcessing}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background:
                  confirmAction && targetIds ? "linear-gradient(135deg, #D97706 0%, #B45309 100%)" : "#E5E7EB",
                color: confirmAction && targetIds ? "#FFFFFF" : "#9CA3AF",
                fontSize: "15px",
                fontWeight: "700",
                cursor: confirmAction && targetIds && !isProcessing ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {isProcessing ? (
                <>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#FFFFFF",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Activating...
                </>
              ) : (
                "Activate Emergency Power"
              )}
            </button>
          </div>
        )}

        {/* Post-Crisis Note */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "16px" }}>📋</span>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
            <strong>Note:</strong> All emergency actions require a post-crisis review within 72 hours. Actions are
            logged and auditable.
          </p>
        </div>
      </div>

      {/* Initiate Modal */}
      {showInitiateModal && (
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
              maxHeight: "85vh",
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
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>⚠️ Initiate Emergency</h3>
              <button
                onClick={() => setShowInitiateModal(false)}
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

            {/* Emergency Type */}
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A2342",
                marginBottom: "10px",
              }}
            >
              Emergency Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {emergencyTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setEmergencyType(type.id)}
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    border: emergencyType === type.id ? `2px solid ${type.color}` : "1px solid #E5E7EB",
                    background: emergencyType === type.id ? `${type.color}10` : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>{type.icon}</span>
                  <span style={{ fontSize: "12px", fontWeight: "500", color: "#0A2342" }}>{type.label}</span>
                </button>
              ))}
            </div>

            {/* Description */}
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A2342",
                marginBottom: "6px",
              }}
            >
              Description <span style={{ fontWeight: "400", color: "#6B7280" }}>(min 50 chars)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the emergency situation in detail..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
                minHeight: "100px",
                resize: "none",
                marginBottom: "16px",
              }}
            />
            <p
              style={{
                margin: "-12px 0 16px 0",
                fontSize: "11px",
                color: description.length >= 50 ? "#00897B" : "#6B7280",
              }}
            >
              {description.length}/50 characters
            </p>

            <button
              onClick={handleInitiate}
              disabled={!emergencyType || description.length < 50 || isProcessing}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background:
                  emergencyType && description.length >= 50
                    ? "linear-gradient(135deg, #D97706 0%, #B45309 100%)"
                    : "#E5E7EB",
                color: emergencyType && description.length >= 50 ? "#FFFFFF" : "#9CA3AF",
                fontSize: "16px",
                fontWeight: "700",
                cursor: emergencyType && description.length >= 50 && !isProcessing ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {isProcessing ? (
                <>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#FFFFFF",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Initiating...
                </>
              ) : (
                "Initiate Emergency Protocol"
              )}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
