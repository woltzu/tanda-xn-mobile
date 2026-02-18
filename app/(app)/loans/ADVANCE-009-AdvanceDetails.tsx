"use client"

import { useState } from "react"

export default function AdvanceDetailsScreen() {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  const advance = {
    id: "ADV-2025-0120-001",
    type: "quick",
    typeName: "Quick Advance",
    icon: "⚡",
    status: "active", // active, repaid, defaulted
    advancedAmount: 300,
    fee: 15,
    totalDue: 315,
    rate: 9.5,
    disbursedTo: "TandaXn Wallet",
    disbursedDate: "Jan 20, 2025",
    withholdingDate: "Feb 15, 2025",
    daysRemaining: 25,
    circleName: "Family Circle",
    payoutAmount: 500,
    remainingAfterRepay: 185,
    xnScoreAtApplication: 78,
    timeline: [
      { date: "Jan 20, 2025", event: "Advance approved", status: "completed" },
      { date: "Jan 20, 2025", event: "$300 disbursed to wallet", status: "completed" },
      { date: "Feb 15, 2025", event: "$315 auto-withheld from payout", status: "pending" },
      { date: "Feb 15, 2025", event: "Advance closed", status: "pending" },
    ],
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { label: "Active", bg: "#F0FDFB", color: "#00897B" }
      case "repaid":
        return { label: "Repaid ✓", bg: "#F0FDF4", color: "#166534" }
      case "defaulted":
        return { label: "Missed Withholding", bg: "#FEE2E2", color: "#DC2626" }
      default:
        return { label: status, bg: "#F5F7FA", color: "#6B7280" }
    }
  }

  const statusBadge = getStatusBadge(advance.status)

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
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Advance Details</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>{advance.id}</p>
          </div>
          <span
            style={{
              background: statusBadge.bg,
              color: statusBadge.color,
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            {statusBadge.label}
          </span>
        </div>

        {/* Amount Display */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "13px", opacity: 0.8 }}>Advanced</p>
            <p style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>${advance.advancedAmount}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "13px", opacity: 0.8 }}>To Repay</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>${advance.totalDue}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Type Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
              }}
            >
              {advance.icon}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>{advance.typeName}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                From {advance.circleName} • Rate: {advance.rate}%
              </p>
            </div>
          </div>
        </div>

        {/* Details Grid */}
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
            Advance Information
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance amount</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>${advance.advancedAmount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance fee ({advance.rate}%)</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>${advance.fee}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total to repay</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>${advance.totalDue}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Disbursed to</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{advance.disbursedTo}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Disbursed on</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{advance.disbursedDate}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>XnScore at application</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                {advance.xnScoreAtApplication}
              </span>
            </div>
          </div>
        </div>

        {/* Withholding Info */}
        {advance.status === "active" && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                Auto-Withholding in {advance.daysRemaining} days
              </p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Withholding date</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>{advance.withholdingDate}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>From payout</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>${advance.payoutAmount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Withheld</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>-${advance.totalDue}</span>
              </div>
              <div style={{ height: "1px", background: "rgba(255,255,255,0.2)", marginBottom: "8px" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>You'll receive</span>
                <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                  ${advance.remainingAfterRepay}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Timeline</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {advance.timeline.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: item.status === "completed" ? "#00C6AE" : "#E5E7EB",
                      border: item.status === "pending" ? "2px solid #00C6AE" : "none",
                    }}
                  />
                  {idx < advance.timeline.length - 1 && (
                    <div
                      style={{
                        width: "2px",
                        height: "36px",
                        background: item.status === "completed" ? "#00C6AE" : "#E5E7EB",
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: "16px" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{item.event}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{item.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {advance.status === "active" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => console.log("Early repay")}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#00C6AE",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Repay Early — Save on Fees
              </button>
              <button
                onClick={() => console.log("Hardship request")}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                Request Hardship Assistance
              </button>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={() => console.log("View agreement")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "500",
              color: "#0A2342",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              View Agreement
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button
            onClick={() => console.log("Contact support")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "500",
              color: "#0A2342",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Contact Support
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
