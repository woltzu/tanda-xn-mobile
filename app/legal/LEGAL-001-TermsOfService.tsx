"use client"

import { useState } from "react"
import { TabBarInline } from "../../components/TabBar"

export default function TermsOfServiceScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const lastUpdated = "January 15, 2026"

  const sections = [
    {
      id: "acceptance",
      title: "1. Acceptance of Terms",
      content:
        "By accessing or using TandaXn services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services. TandaXn reserves the right to modify these terms at any time.",
    },
    {
      id: "services",
      title: "2. Description of Services",
      content:
        "TandaXn provides a digital platform for rotating savings circles (tandas/ROSCAs), personal savings goals, and cross-border remittance services. Our platform facilitates group savings, individual savings, and international money transfers to supported countries.",
    },
    {
      id: "eligibility",
      title: "3. Eligibility",
      content:
        "You must be at least 18 years old and a legal resident of the United States to use TandaXn services. You must provide accurate identity verification information and maintain the security of your account credentials.",
    },
    {
      id: "accounts",
      title: "4. User Accounts",
      content:
        "You are responsible for maintaining the confidentiality of your account information. You agree to notify us immediately of any unauthorized use of your account. TandaXn is not liable for any loss arising from unauthorized access to your account.",
    },
    {
      id: "circles",
      title: "5. Savings Circles",
      content:
        "Participation in savings circles requires commitment to the agreed contribution schedule. Early withdrawal may incur fees as specified in the circle terms. TandaXn facilitates but does not guarantee member performance.",
    },
    {
      id: "payments",
      title: "6. Payments & Fees",
      content:
        "All fees are disclosed before transactions. Exchange rates for international transfers are locked at time of transaction. TandaXn is not responsible for delays caused by third-party payment providers.",
    },
    {
      id: "prohibited",
      title: "7. Prohibited Activities",
      content:
        "Users may not use TandaXn for money laundering, fraud, or any illegal activities. Violation of these terms may result in immediate account termination and reporting to relevant authorities.",
    },
    {
      id: "liability",
      title: "8. Limitation of Liability",
      content:
        "TandaXn's liability is limited to the amount of fees paid by you in the preceding 12 months. We are not liable for indirect, incidental, or consequential damages arising from use of our services.",
    },
    {
      id: "disputes",
      title: "9. Dispute Resolution",
      content:
        "Any disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. Class action lawsuits are waived by agreeing to these terms.",
    },
    {
      id: "termination",
      title: "10. Termination",
      content:
        "TandaXn may terminate or suspend your account at any time for violation of these terms. Upon termination, you remain liable for any outstanding obligations.",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "200px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Terms of Service</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Last updated: {lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Intro */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: 1.6 }}>
            Welcome to TandaXn. These Terms of Service govern your use of our platform and services. Please read them
            carefully before using our services.
          </p>
        </div>

        {/* Sections */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {sections.map((section, idx) => (
            <div key={section.id}>
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#FFFFFF",
                  border: "none",
                  borderBottom: idx < sections.length - 1 ? "1px solid #F5F7FA" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{section.title}</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  style={{
                    transform: expandedSection === section.id ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {expandedSection === section.id && (
                <div
                  style={{
                    padding: "0 16px 16px 16px",
                    background: "#F5F7FA",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: 1.7 }}>{section.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Info */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.6 }}>
            Questions about these terms? Contact us at{" "}
            <span style={{ color: "#00897B", fontWeight: "500" }}>legal@tandaxn.com</span>
          </p>
        </div>
      </div>

      {/* Accept Button */}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        {accepted ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "16px",
              background: "#F0FDFB",
              borderRadius: "14px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#065F46" }}>
              Terms Accepted
            </span>
          </div>
        ) : (
          <button
            onClick={() => {
              setAccepted(true)
              console.log("Terms accepted")
            }}
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
            I Accept These Terms
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
