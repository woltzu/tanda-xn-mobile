"use client"

import { useState } from "react"
import { TabBarInline } from "../../components/TabBar"

export default function CircleParticipationAgreementScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  const lastUpdated = "January 12, 2026"

  const sections = [
    {
      id: "overview",
      title: "1. Circle Overview",
      content:
        "A TandaXn Savings Circle (also known as a tanda, ROSCA, or chit fund) is a group savings arrangement where members contribute a fixed amount on a regular schedule. Each period, the total pool is paid out to one member according to the predetermined rotation. TandaXn facilitates these circles digitally but members are bound by this agreement.",
    },
    {
      id: "membership",
      title: "2. Membership Requirements",
      content:
        "To join a circle, you must: (1) Be at least 18 years old; (2) Have a verified TandaXn account; (3) Meet the circle's XN Score requirement if applicable; (4) Have a valid payment method linked to your account; (5) Agree to the specific terms of the circle you are joining including contribution amount and schedule.",
    },
    {
      id: "contributions",
      title: "3. Contribution Obligations",
      content:
        "You agree to make all scheduled contributions on time and in full. Contributions are automatically debited from your linked payment method on the due date. Failure to make a contribution may result in: late fees, removal from the circle, negative impact to your XN Score, and legal action for amounts owed.",
    },
    {
      id: "payouts",
      title: "4. Payout Rules",
      content:
        "Payouts follow the rotation determined when the circle was formed (random, bid-based, or first-come). Once you receive your payout, you must continue making all remaining contributions until the circle completes. Payouts are deposited to your TandaXn Wallet within 24 hours of the contribution deadline.",
    },
    {
      id: "early-exit",
      title: "5. Early Exit & Penalties",
      content:
        "If you exit a circle before completion: (1) Before receiving payout: Your contributions minus a 5% administrative fee will be returned; (2) After receiving payout: You must repay the remaining balance owed immediately, plus a 10% early termination fee. Failure to repay will result in legal collection action.",
    },
    {
      id: "defaults",
      title: "6. Default & Recovery",
      content:
        "If a member defaults on contributions, TandaXn's Member Protection Fund covers the shortfall to ensure other members receive their payouts. TandaXn will pursue recovery of defaulted amounts including fees and legal costs. Defaulting members will be reported to credit bureaus and banned from future circles.",
    },
    {
      id: "disputes",
      title: "7. Dispute Resolution",
      content:
        "Disputes between circle members should first be reported through the app's dispute system. TandaXn will mediate disputes but is not liable for member conduct. Unresolved disputes will be subject to binding arbitration. By joining a circle, you waive the right to jury trial or class action.",
    },
    {
      id: "liability",
      title: "8. Liability & Insurance",
      content:
        "TandaXn provides the Member Protection Fund to cover verified member defaults up to the circle's total value. This fund does not cover losses due to fraud committed by members acting together. TandaXn is not liable for amounts exceeding the circle value or for consequential damages.",
    },
    {
      id: "termination",
      title: "9. Circle Termination",
      content:
        "A circle may be terminated early if: (1) All members agree; (2) Fewer than 3 members remain; (3) Regulatory action requires it. Upon early termination, members who have not yet received payouts will receive their contributions back. Members who received payouts must continue payments until balanced.",
    },
    {
      id: "amendments",
      title: "10. Agreement Changes",
      content:
        "TandaXn may update this agreement with 30 days notice. Continuing to participate in circles after the effective date constitutes acceptance. Material changes affecting active circles require member consent. Members may exit active circles without penalty if they reject material changes.",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Circle Agreement</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Last updated: {lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Alert Banner */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "20px" }}>!</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
              Required to Join Circles
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#B45309", lineHeight: 1.5 }}>
              You must accept this agreement before joining any savings circle. Please read all sections carefully.
            </p>
          </div>
        </div>

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
            {String.fromCodePoint(0x1f504)} <strong>Savings Circle Participation Agreement</strong> - This agreement
            governs your participation in TandaXn savings circles. It covers your obligations, rights, and the rules
            for payouts and penalties.
          </p>
        </div>

        {/* Key Points */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Key Points</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              "You commit to all contributions for the full circle duration",
              "After receiving payout, you MUST continue contributing",
              "Defaults impact your credit and XN Score",
              "Early exit incurs fees (5-10% depending on payout status)",
              "Member Protection Fund covers verified defaults",
            ].map((point, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#00C6AE",
                    marginTop: "6px",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}>{point}</span>
              </div>
            ))}
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
            Questions about circle participation? Contact us at{" "}
            <span style={{ color: "#00897B", fontWeight: "500" }}>circles@tandaxn.com</span>
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
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#065F46" }}>Agreement Accepted</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setAccepted(true)
              console.log("Circle agreement accepted")
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
            I Accept This Agreement
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
