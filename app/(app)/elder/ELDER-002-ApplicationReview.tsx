"use client"

import { useState } from "react"

export default function ElderApplicationReviewScreen() {
  const [application] = useState({
    id: "EA-2025-001234",
    status: "pending", // "pending", "under_review", "approved", "rejected"
    submittedAt: "Dec 28, 2025",
    reviewStartedAt: null,
    estimatedCompletion: "Jan 5, 2026",
    currentStep: 2, // 1-4
    reviewerNote: null,
  })

  const steps = [
    { id: 1, title: "Application Submitted", description: "Your application is in queue", completed: true },
    {
      id: 2,
      title: "Document Review",
      description: "Reviewing your history and credentials",
      completed: false,
      current: true,
    },
    { id: 3, title: "Community Check", description: "Verifying community standing", completed: false },
    { id: 4, title: "Final Approval", description: "Elder council decision", completed: false },
  ]

  const getStatusBadge = () => {
    switch (application.status) {
      case "pending":
        return { label: "Pending Review", color: "#D97706", bg: "#FEF3C7" }
      case "under_review":
        return { label: "Under Review", color: "#00897B", bg: "#F0FDFB" }
      case "approved":
        return { label: "Approved", color: "#00C6AE", bg: "#F0FDFB" }
      case "rejected":
        return { label: "Not Approved", color: "#DC2626", bg: "#FEE2E2" }
      default:
        return { label: "Unknown", color: "#6B7280", bg: "#F5F7FA" }
    }
  }

  const status = getStatusBadge()

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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Elder Application</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Application #{application.id}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Status Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              background: status.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            {application.status === "approved" ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={status.color} strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : application.status === "rejected" ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={status.color} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={status.color} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>

          <span
            style={{
              display: "inline-block",
              padding: "6px 14px",
              background: status.bg,
              color: status.color,
              fontSize: "13px",
              fontWeight: "600",
              borderRadius: "8px",
              marginBottom: "12px",
            }}
          >
            {status.label}
          </span>

          <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#0A2342" }}>
            Submitted on {application.submittedAt}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
            Estimated completion: {application.estimatedCompletion}
          </p>
        </div>

        {/* Progress Steps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Review Progress
          </h3>

          {steps.map((step, idx) => (
            <div
              key={step.id}
              style={{ display: "flex", gap: "14px", marginBottom: idx < steps.length - 1 ? "16px" : 0 }}
            >
              {/* Step Indicator */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: step.completed ? "#00C6AE" : step.current ? "#0A2342" : "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {step.completed ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: step.current ? "#FFFFFF" : "#9CA3AF",
                      }}
                    >
                      {step.id}
                    </span>
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      width: "2px",
                      height: "40px",
                      background: step.completed ? "#00C6AE" : "#E5E7EB",
                      marginTop: "4px",
                    }}
                  />
                )}
              </div>

              {/* Step Content */}
              <div style={{ flex: 1, paddingTop: "4px" }}>
                <p
                  style={{
                    margin: "0 0 2px 0",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: step.completed || step.current ? "#0A2342" : "#9CA3AF",
                  }}
                >
                  {step.title}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{step.description}</p>
                {step.current && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "6px",
                      padding: "3px 8px",
                      background: "#F0FDFB",
                      color: "#00897B",
                      fontSize: "10px",
                      fontWeight: "600",
                      borderRadius: "4px",
                    }}
                  >
                    IN PROGRESS
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* What to Expect */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            💡 What happens next?
          </h4>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.6 }}>
            Our Elder council reviews each application carefully. You'll receive an email notification when a decision
            is made. Approved applicants will receive onboarding materials within 24 hours.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => console.log("Contact support")}
            style={{
              flex: 1,
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
              border: "none",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Contact Support
          </button>
          <button
            onClick={() => console.log("Withdraw application")}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #DC2626",
              fontSize: "14px",
              fontWeight: "600",
              color: "#DC2626",
              cursor: "pointer",
            }}
          >
            Withdraw Application
          </button>
        </div>
      </div>
    </div>
  )
}
