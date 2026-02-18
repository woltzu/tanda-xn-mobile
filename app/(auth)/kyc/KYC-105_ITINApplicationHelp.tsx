"use client"

import { useState } from "react"

export default function ITINApplicationHelp() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)
  const [selectedMethod, setSelectedMethod] = useState("caa")

  const methods = [
    {
      id: "caa",
      icon: "🏢",
      title: "Certified Acceptance Agent (CAA)",
      subtitle: "Recommended — Fastest & easiest",
      badge: "Recommended",
      details: [
        "CAAs are IRS-authorized to help with ITIN applications",
        "They verify your documents so you don't have to mail originals",
        "Many speak multiple languages",
        "Cost: Usually $50-200 plus IRS filing fee",
      ],
      action: "Find a CAA Near Me",
    },
    {
      id: "mail",
      icon: "📬",
      title: "Mail to IRS",
      subtitle: "Free but slower",
      badge: null,
      details: [
        "Download Form W-7 from IRS.gov",
        "Mail with original documents or certified copies",
        "Documents returned within 60 days",
        "Cost: Free (just postage)",
      ],
      action: "Download Form W-7",
    },
    {
      id: "taxpayer",
      icon: "🏛️",
      title: "IRS Taxpayer Assistance Center",
      subtitle: "In-person help",
      badge: null,
      details: [
        "Visit an IRS office in person",
        "Staff can verify documents on the spot",
        "Limited locations and hours",
        "Cost: Free",
      ],
      action: "Find IRS Office",
    },
  ]

  const documents = [
    { name: "Valid passport", note: "Most common choice" },
    { name: "National ID card", note: "From your home country" },
    { name: "US driver's license", note: "If you have one" },
    { name: "Birth certificate", note: "With photo ID" },
    { name: "Foreign voter registration", note: "With photo" },
  ]

  const faqs = [
    {
      q: "How long does it take?",
      a: "Processing takes 7-11 weeks from when the IRS receives your application. Using a CAA can be faster because they verify documents immediately.",
    },
    {
      q: "What if I don't have a passport?",
      a: "You can use other documents like a national ID card, birth certificate with photo ID, or foreign driver's license. A CAA can help you figure out which documents to use.",
    },
    {
      q: "Will this affect my immigration status?",
      a: "No. The IRS is legally prohibited from sharing ITIN information with immigration authorities (Section 6103). Getting an ITIN is purely for tax purposes.",
    },
    {
      q: "How much does it cost?",
      a: "The IRS doesn't charge for ITINs. If you use a CAA, their fees typically range from $50-200. Mailing your application is free (just postage).",
    },
    {
      q: "Can I use TandaXn while I wait?",
      a: "Yes! You can continue using TandaXn in Limited Mode. You can join circles and save to goals. Your interest will keep accruing — it'll be waiting for you when your ITIN arrives.",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>How to Get an ITIN</h1>
        </div>

        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9, lineHeight: 1.5 }}>
          Choose the method that works best for you. We're here to help every step of the way.
        </p>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px" }}>
        {/* Application Methods */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Choose your method
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {methods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                  border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  borderRadius: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>{method.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{method.title}</p>
                      {method.badge && (
                        <span
                          style={{
                            background: "#00C6AE",
                            color: "#FFFFFF",
                            fontSize: "10px",
                            fontWeight: "600",
                            padding: "2px 8px",
                            borderRadius: "8px",
                          }}
                        >
                          {method.badge}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{method.subtitle}</p>

                    {selectedMethod === method.id && (
                      <div style={{ marginTop: "12px" }}>
                        <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
                          {method.details.map((detail, idx) => (
                            <li key={idx} style={{ fontSize: "12px", color: "#4B5563", marginBottom: "4px" }}>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Radio indicator */}
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: selectedMethod === method.id ? "6px solid #00C6AE" : "2px solid #D1D5DB",
                      flexShrink: 0,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Documents Needed */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Documents you'll need
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#6B7280" }}>
            You'll need ONE of the following (original or certified copy):
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {documents.map((doc, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontSize: "13px", color: "#0A2342" }}>{doc.name}</span>
                </div>
                <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{doc.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Common Questions
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {faqs.map((faq, idx) => (
              <div key={idx}>
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === idx ? null : idx)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#F5F7FA",
                    border: "none",
                    borderRadius: expandedFAQ === idx ? "10px 10px 0 0" : "10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{faq.q}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280"
                    strokeWidth="2"
                    style={{
                      transform: expandedFAQ === idx ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.2s",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {expandedFAQ === idx && (
                  <div
                    style={{
                      padding: "12px",
                      background: "#F5F7FA",
                      borderRadius: "0 0 10px 10px",
                      marginTop: "-1px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "12px", color: "#4B5563", lineHeight: 1.6 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "18px" }}>⏱️</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>Timeline: 7-11 weeks</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#B45309", lineHeight: 1.5 }}>
              Don't worry — you can keep using TandaXn while you wait. Your interest will keep accruing!
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTIONS */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <button
          onClick={() => console.log("Action")}
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
            marginBottom: "10px",
          }}
        >
          {selectedMethod === "caa"
            ? "Find a CAA Near Me"
            : selectedMethod === "mail"
              ? "Download Form W-7"
              : "Find IRS Office"}
        </button>
        <button
          onClick={() => console.log("Skip")}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "14px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "500",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          I'll start this later — continue with limited features
        </button>
      </div>
    </div>
  )
}
