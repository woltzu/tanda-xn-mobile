"use client"

import { useState } from "react"
import { TabBarInline } from "../../components/TabBar"

export default function PrivacyPolicyScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  const lastUpdated = "January 15, 2026"

  const sections = [
    {
      id: "collect",
      title: "Information We Collect",
      icon: "📋",
      content:
        "We collect personal information you provide (name, email, phone, government ID), financial information (bank accounts, transaction history), and device information (IP address, device type, usage patterns). We also collect biometric data for identity verification.",
    },
    {
      id: "use",
      title: "How We Use Your Information",
      icon: "⚙️",
      content:
        "We use your information to provide services, verify identity, process transactions, detect fraud, improve our platform, communicate with you, and comply with legal obligations. We may use data for analytics to enhance user experience.",
    },
    {
      id: "share",
      title: "Information Sharing",
      icon: "🔗",
      content:
        "We share information with payment processors, identity verification providers, and banking partners as necessary for services. We may share with law enforcement when required by law. We never sell your personal information to third parties.",
    },
    {
      id: "security",
      title: "Data Security",
      icon: "🔒",
      content:
        "We use industry-standard encryption (AES-256) for data at rest and in transit. We employ multi-factor authentication, regular security audits, and strict access controls. Your financial data is stored with PCI-DSS compliant partners.",
    },
    {
      id: "retention",
      title: "Data Retention",
      icon: "📅",
      content:
        "We retain your information for as long as your account is active or as needed to provide services. We retain transaction records for 7 years as required by financial regulations. You may request data deletion subject to legal requirements.",
    },
    {
      id: "rights",
      title: "Your Rights",
      icon: "✋",
      content:
        "You have the right to access, correct, or delete your personal information. You can opt out of marketing communications. California residents have additional rights under CCPA. Contact us to exercise these rights.",
    },
    {
      id: "cookies",
      title: "Cookies & Tracking",
      icon: "🍪",
      content:
        "We use essential cookies for app functionality and analytics cookies to improve services. You can manage cookie preferences in your device settings. Disabling cookies may limit some features.",
    },
    {
      id: "children",
      title: "Children's Privacy",
      icon: "👶",
      content:
        "TandaXn is not intended for users under 18. We do not knowingly collect information from children. If we learn we have collected information from a child, we will delete it promptly.",
    },
    {
      id: "international",
      title: "International Transfers",
      icon: "🌍",
      content:
        "Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.",
    },
    {
      id: "changes",
      title: "Policy Changes",
      icon: "📝",
      content:
        "We may update this policy periodically. We will notify you of material changes via email or in-app notification. Continued use of services after changes constitutes acceptance of the updated policy.",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Privacy Policy</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Last updated: {lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#065F46", lineHeight: 1.6 }}>
            🔐 <strong>Your privacy matters.</strong> This policy explains how TandaXn collects, uses, and protects your
            personal information. We are committed to transparency and safeguarding your data.
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
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "20px" }}>{section.icon}</span>
                <span style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{section.title}</span>
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
                    padding: "0 16px 16px 48px",
                    background: "#F5F7FA",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: 1.7 }}>{section.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Contact Our Privacy Team
          </h4>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.6 }}>
            For privacy inquiries or to exercise your data rights:
            <br />
            <span style={{ color: "#00897B", fontWeight: "500" }}>privacy@tandaxn.com</span>
            <br />
            TandaXn Inc., 123 Financial District, Wilmington, DE 19801
          </p>
        </div>
      </div>

      {/* Acknowledgment Button */}
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
        {acknowledged ? (
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
              Policy Acknowledged
            </span>
          </div>
        ) : (
          <button
            onClick={() => {
              setAcknowledged(true)
              console.log("Privacy policy acknowledged")
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
            I Acknowledge This Policy
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
