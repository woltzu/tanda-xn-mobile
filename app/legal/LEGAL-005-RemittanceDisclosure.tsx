"use client"

import { useState } from "react"
import { TabBarInline } from "../../components/TabBar"

export default function RemittanceDisclosureScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  const lastUpdated = "January 8, 2026"

  const supportedCountries = [
    { country: "Cameroon", flag: String.fromCodePoint(0x1f1e8, 0x1f1f2), currency: "XAF", deliveryTime: "Minutes - 1 day" },
    { country: "Nigeria", flag: String.fromCodePoint(0x1f1f3, 0x1f1ec), currency: "NGN", deliveryTime: "Minutes - 1 day" },
    { country: "Kenya", flag: String.fromCodePoint(0x1f1f0, 0x1f1ea), currency: "KES", deliveryTime: "Minutes - 1 day" },
    { country: "Ghana", flag: String.fromCodePoint(0x1f1ec, 0x1f1ed), currency: "GHS", deliveryTime: "Minutes - 2 days" },
    { country: "Senegal", flag: String.fromCodePoint(0x1f1f8, 0x1f1f3), currency: "XOF", deliveryTime: "Minutes - 1 day" },
    { country: "Cote d'Ivoire", flag: String.fromCodePoint(0x1f1e8, 0x1f1ee), currency: "XOF", deliveryTime: "Minutes - 2 days" },
    { country: "South Africa", flag: String.fromCodePoint(0x1f1ff, 0x1f1e6), currency: "ZAR", deliveryTime: "1-3 days" },
    { country: "Ethiopia", flag: String.fromCodePoint(0x1f1ea, 0x1f1f9), currency: "ETB", deliveryTime: "1-2 days" },
  ]

  const sections = [
    {
      id: "service",
      title: "1. Service Description",
      content:
        "TandaXn provides international money transfer services (remittances) to supported African countries. We facilitate transfers from the United States to recipients abroad through our network of banking and mobile money partners. This disclosure provides important information required under the Dodd-Frank Act and CFPB Regulation E.",
    },
    {
      id: "exchange",
      title: "2. Exchange Rates",
      content:
        "Exchange rates are displayed before you confirm each transfer and are locked at the time of transaction. Rates include TandaXn's margin and may differ from interbank or market rates. You will see the exact amount your recipient will receive in their local currency before confirming. Rates are updated multiple times daily.",
    },
    {
      id: "fees",
      title: "3. Transfer Fees",
      content:
        "Transfer fees depend on: (1) Send amount; (2) Destination country; (3) Delivery method (mobile money, bank transfer, or cash pickup). All fees are disclosed before confirmation. TandaXn fee: $0-4.99 depending on amount. Partner/receiving fees may apply and are disclosed separately. Total cost = TandaXn fee + exchange rate margin.",
    },
    {
      id: "delivery",
      title: "4. Delivery Times",
      content:
        "Delivery times vary by destination and method: Mobile Money: Usually within minutes to 1 business day; Bank Transfer: 1-3 business days; Cash Pickup: Available within hours at partner locations. Delays may occur due to recipient bank processing, verification requirements, or local holidays.",
    },
    {
      id: "cancellation",
      title: "5. Cancellation & Refund Rights",
      content:
        "You may cancel a transfer for a full refund if: (1) The transfer has not been picked up or deposited; (2) You cancel within 30 minutes of sending (subject to processing status). To cancel, go to Transaction History > Select Transfer > Cancel. Refunds are processed within 3-5 business days to your original payment method.",
    },
    {
      id: "errors",
      title: "6. Error Resolution",
      content:
        "If you believe an error occurred, contact us within 180 days. Errors include: wrong amount sent, wrong recipient, funds not delivered. We will investigate within 90 days and provide a written explanation. For errors resulting in a loss of funds, we will resolve within 90 days of notification.",
    },
    {
      id: "recipient",
      title: "7. Recipient Information",
      content:
        "To complete a transfer, recipients may need to: (1) Provide valid government ID; (2) Answer security questions; (3) Provide the MTCN (Money Transfer Control Number). Cash pickup recipients must visit an authorized agent location. Mobile money recipients must have an active account with sufficient limits.",
    },
    {
      id: "taxes",
      title: "8. Tax Reporting",
      content:
        "Transfers exceeding $10,000 annually to a single recipient may be reported to the IRS. You are responsible for any tax obligations related to your transfers. TandaXn does not provide tax advice. Consult a tax professional regarding reporting requirements for international transfers.",
    },
    {
      id: "compliance",
      title: "9. Regulatory Compliance",
      content:
        "TandaXn is licensed as a money transmitter in all states where required. We comply with the Bank Secrecy Act, OFAC sanctions, and anti-money laundering regulations. Transfers may be delayed or declined for compliance review. We may request additional documentation to verify the source or purpose of funds.",
    },
    {
      id: "liability",
      title: "10. Limitation of Liability",
      content:
        "TandaXn's liability is limited to the transfer amount plus fees paid. We are not responsible for: delays caused by recipient institutions, errors in recipient information provided by you, losses due to exchange rate fluctuations after rate lock, or circumstances beyond our reasonable control.",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Remittance Disclosure</h1>
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
          <p style={{ margin: 0, fontSize: "13px", color: "#065F46", lineHeight: 1.6 }}>
            {String.fromCodePoint(0x1f30d)} <strong>International Money Transfer Disclosure</strong> - This document
            explains fees, exchange rates, delivery times, and your rights when sending money abroad through TandaXn.
            Required by the Consumer Financial Protection Bureau.
          </p>
        </div>

        {/* Supported Countries */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Supported Countries & Delivery Times
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {supportedCountries.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: idx < supportedCountries.length - 1 ? "1px solid #F5F7FA" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>{item.flag}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{item.country}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{item.currency}</p>
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: "#00C6AE", fontWeight: "500" }}>{item.deliveryTime}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Summary */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Fee Structure Overview
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { range: "$1 - $100", fee: "$2.99" },
              { range: "$101 - $500", fee: "$3.99" },
              { range: "$501 - $1,000", fee: "$4.99" },
              { range: "$1,001 - $2,999", fee: "0.5%" },
              { range: "$3,000+", fee: "Free", highlight: true },
            ].map((tier, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: tier.highlight ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#6B7280" }}>{tier.range}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: tier.highlight ? "#00C6AE" : "#0A2342",
                  }}
                >
                  {tier.fee}
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "#9CA3AF", lineHeight: 1.5 }}>
            * Fees shown are TandaXn fees only. Additional partner fees may apply for certain delivery methods.
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
            Questions about international transfers? Contact us at{" "}
            <span style={{ color: "#00897B", fontWeight: "500" }}>remittance@tandaxn.com</span>
            <br />
            For errors or complaints: 1-800-TANDAXN or{" "}
            <span style={{ color: "#00897B", fontWeight: "500" }}>complaints@tandaxn.com</span>
          </p>
        </div>
      </div>

      {/* Acknowledge Button */}
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
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#065F46" }}>Disclosure Acknowledged</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setAcknowledged(true)
              console.log("Remittance disclosure acknowledged")
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
            I Acknowledge This Disclosure
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
