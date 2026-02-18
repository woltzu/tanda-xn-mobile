"use client"

import { useState } from "react"
import { TabBarInline } from "../../components/TabBar"

export default function LegalHubScreen() {
  const [showContactModal, setShowContactModal] = useState(false)

  const legalDocuments = [
    {
      id: "terms",
      title: "Terms of Service",
      description: "User agreement and service conditions",
      icon: "📜",
      lastUpdated: "January 15, 2026",
      status: "accepted", // or "pending"
    },
    {
      id: "privacy",
      title: "Privacy Policy",
      description: "How we collect and use your data",
      icon: "🔒",
      lastUpdated: "January 15, 2026",
      status: "acknowledged",
    },
    {
      id: "eSign",
      title: "E-Sign Consent",
      description: "Electronic signature authorization",
      icon: "✍️",
      lastUpdated: "January 10, 2026",
      status: "accepted",
    },
    {
      id: "circles",
      title: "Circle Participation Agreement",
      description: "Rules for savings circle membership",
      icon: "🔄",
      lastUpdated: "January 12, 2026",
      status: "pending",
    },
    {
      id: "remittance",
      title: "Remittance Disclosure",
      description: "International transfer terms and fees",
      icon: "🌍",
      lastUpdated: "January 8, 2026",
      status: "accepted",
    },
    {
      id: "fees",
      title: "Fee Schedule",
      description: "Complete list of service fees",
      icon: "💰",
      lastUpdated: "January 5, 2026",
      status: "acknowledged",
    },
  ]

  const getStatusBadge = (status: string) => {
    if (status === "accepted" || status === "acknowledged") {
      return (
        <span
          style={{
            padding: "4px 10px",
            background: "#F0FDFB",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: "600",
            color: "#00C6AE",
          }}
        >
          {status === "accepted" ? "Accepted" : "Acknowledged"}
        </span>
      )
    }
    return (
      <span
        style={{
          padding: "4px 10px",
          background: "#FEF3C7",
          borderRadius: "20px",
          fontSize: "11px",
          fontWeight: "600",
          color: "#D97706",
        }}
      >
        Action Required
      </span>
    )
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Legal & Policies</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Review important documents</p>
          </div>
          <button
            onClick={() => setShowContactModal(true)}
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
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>

        {/* Status Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            justifyContent: "space-around",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>
              {legalDocuments.filter((d) => d.status !== "pending").length}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Completed</p>
          </div>
          <div
            style={{
              width: "1px",
              background: "rgba(255,255,255,0.2)",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>
              {legalDocuments.filter((d) => d.status === "pending").length}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Pending</p>
          </div>
          <div
            style={{
              width: "1px",
              background: "rgba(255,255,255,0.2)",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>{legalDocuments.length}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Total</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Action Required Alert */}
        {legalDocuments.filter((d) => d.status === "pending").length > 0 && (
          <div
            style={{
              background: "#FEF3C7",
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>!</span>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
                Action Required
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#B45309" }}>
                Please review and accept pending documents to use all features
              </p>
            </div>
          </div>
        )}

        {/* Documents List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {legalDocuments.map((doc, idx) => (
            <button
              key={doc.id}
              onClick={() => console.log("Open document:", doc.id)}
              style={{
                width: "100%",
                padding: "16px",
                background: doc.status === "pending" ? "#FFFBEB" : "#FFFFFF",
                border: "none",
                borderBottom: idx < legalDocuments.length - 1 ? "1px solid #F5F7FA" : "none",
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
                  borderRadius: "12px",
                  background: doc.status === "pending" ? "#FEF3C7" : "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                }}
              >
                {doc.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{doc.title}</span>
                  {getStatusBadge(doc.status)}
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{doc.description}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                  Updated: {doc.lastUpdated}
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        {/* Quick Actions */}
        <div
          style={{
            marginTop: "16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <button
            onClick={() => console.log("Download all")}
            style={{
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Download All</span>
          </button>
          <button
            onClick={() => console.log("Print")}
            style={{
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Print</span>
          </button>
        </div>

        {/* Support Section */}
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "#F0FDFB",
            borderRadius: "14px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Need Help Understanding?
          </h4>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Our support team can help explain any legal terms or answer questions about your rights.
          </p>
          <button
            onClick={() => setShowContactModal(true)}
            style={{
              padding: "10px 16px",
              background: "#00C6AE",
              borderRadius: "10px",
              border: "none",
              fontSize: "13px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Contact Support
          </button>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
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
            zIndex: 200,
          }}
          onClick={() => setShowContactModal(false)}
        >
          <div
            style={{
              width: "100%",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 40px 20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "40px",
                height: "4px",
                background: "#E5E7EB",
                borderRadius: "2px",
                margin: "0 auto 20px auto",
              }}
            />
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              Contact Legal Support
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={() => console.log("Email legal")}
                style={{
                  padding: "16px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
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
                    borderRadius: "50%",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  @
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Email Us</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#00C6AE" }}>legal@tandaxn.com</p>
                </div>
              </button>

              <button
                onClick={() => console.log("Chat support")}
                style={{
                  padding: "16px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
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
                    borderRadius: "50%",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  {String.fromCodePoint(0x1f4ac)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Live Chat</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    Available Mon-Fri 9am-6pm EST
                  </p>
                </div>
              </button>

              <button
                onClick={() => console.log("Call support")}
                style={{
                  padding: "16px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
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
                    borderRadius: "50%",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  {String.fromCodePoint(0x1f4de)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Call Us</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>1-800-TANDAXN</p>
                </div>
              </button>
            </div>

            <p
              style={{
                margin: "16px 0 0 0",
                fontSize: "11px",
                color: "#9CA3AF",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              TandaXn Inc. | 123 Financial District, Wilmington, DE 19801
            </p>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
