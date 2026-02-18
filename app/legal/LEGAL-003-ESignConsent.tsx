"use client"

import { useState } from "react"
import { TabBarInline } from "../../components/TabBar"

export default function ESignConsentScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)

  const lastUpdated = "January 10, 2026"

  const sections = [
    {
      id: "scope",
      title: "1. Scope of Consent",
      content:
        "By providing your consent, you agree to use electronic signatures, electronic records, and electronic communications for all transactions and agreements with TandaXn, including but not limited to: account opening documents, savings circle agreements, remittance authorizations, and any amendments to these documents.",
    },
    {
      id: "types",
      title: "2. Types of Electronic Records",
      content:
        "Electronic records include: account statements, transaction confirmations, circle participation agreements, privacy notices, fee disclosures, regulatory notices, and any other communications or documents related to your TandaXn account and services.",
    },
    {
      id: "requirements",
      title: "3. Hardware & Software Requirements",
      content:
        "To access electronic records, you need: (1) A device with internet access (computer, smartphone, or tablet); (2) A current web browser (Chrome, Safari, Firefox, Edge); (3) An active email address; (4) Sufficient storage to download documents or a printer to print them.",
    },
    {
      id: "withdrawal",
      title: "4. Withdrawing Consent",
      content:
        "You may withdraw your consent to receive electronic records at any time by contacting us at esign@tandaxn.com or through the app settings. Withdrawal of consent may result in termination of your TandaXn account or inability to use certain services that require electronic agreements.",
    },
    {
      id: "paper",
      title: "5. Requesting Paper Copies",
      content:
        "You have the right to request paper copies of any electronic record. Paper copies can be requested at no charge for the first request per document. Additional copies may incur a $5 processing fee. Request paper copies by emailing records@tandaxn.com.",
    },
    {
      id: "updates",
      title: "6. Updating Contact Information",
      content:
        "You agree to keep your email address and phone number current. If your contact information changes, update it immediately through the app or by contacting support. Failure to maintain accurate contact information may result in missed important notices.",
    },
    {
      id: "legal",
      title: "7. Legal Validity",
      content:
        "Electronic signatures and records provided pursuant to this consent are legally binding and enforceable to the same extent as paper documents and handwritten signatures under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and the Uniform Electronic Transactions Act (UETA).",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>E-Sign Consent</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Last updated: {lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Intro */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>{String.fromCodePoint(0x270d)}{String.fromCodePoint(0xfe0f)}</span>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#065F46" }}>
                Electronic Signature Authorization
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
                This consent allows TandaXn to provide documents electronically and accept your electronic signature
                for agreements. Please read carefully before consenting.
              </p>
            </div>
          </div>
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

        {/* System Requirements */}
        <div
          style={{
            marginTop: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            System Requirements Check
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "Active Internet Connection", status: true },
              { label: "Compatible Browser", status: true },
              { label: "Valid Email Address", status: true },
              { label: "PDF Viewer", status: true },
            ].map((req, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: req.status ? "#F0FDFB" : "#FEE2E2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {req.status ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>{req.label}</span>
              </div>
            ))}
          </div>
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
            Questions about electronic signatures? Contact us at{" "}
            <span style={{ color: "#00897B", fontWeight: "500" }}>esign@tandaxn.com</span>
          </p>
        </div>
      </div>

      {/* Consent Button */}
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
        {consented ? (
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
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#065F46" }}>Consent Provided</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setConsented(true)
              console.log("E-Sign consent provided")
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
            I Consent to Electronic Signatures
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
