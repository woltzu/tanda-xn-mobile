"use client"

import { useState } from "react"
import { TabBarInline } from "../../components/TabBar"

export default function FeeScheduleScreen() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>("wallet")

  const lastUpdated = "January 5, 2026"

  const feeCategories = [
    {
      id: "wallet",
      title: "Wallet & Account",
      icon: String.fromCodePoint(0x1f4b3),
      fees: [
        { name: "Account Opening", fee: "FREE", description: "No cost to create your TandaXn account" },
        { name: "Monthly Maintenance", fee: "FREE", description: "No monthly fees ever" },
        { name: "Wallet Balance", fee: "FREE", description: "Hold any amount at no cost" },
        { name: "Internal Transfers", fee: "FREE", description: "Send to other TandaXn users instantly" },
        { name: "Add Funds (Bank Transfer)", fee: "FREE", description: "ACH transfers from linked bank" },
        { name: "Add Funds (Debit Card)", fee: "1.5%", description: "Instant funding via debit card" },
        { name: "Add Funds (Apple Pay)", fee: "1.5%", description: "Instant funding via Apple Pay" },
        { name: "Withdraw to Bank", fee: "FREE", description: "Standard ACH (1-3 days)" },
        { name: "Instant Withdraw to Bank", fee: "$0.99", description: "Same-day bank deposit" },
      ],
    },
    {
      id: "circles",
      title: "Savings Circles",
      icon: String.fromCodePoint(0x1f504),
      fees: [
        { name: "Join Circle", fee: "FREE", description: "No fee to join any circle" },
        { name: "Create Circle", fee: "FREE", description: "Start your own circle at no cost" },
        { name: "Circle Contribution", fee: "FREE", description: "No fees on regular contributions" },
        { name: "Receive Payout", fee: "FREE", description: "Get your full payout amount" },
        { name: "Early Exit (Before Payout)", fee: "5%", description: "Of total contributions made" },
        { name: "Early Exit (After Payout)", fee: "10%", description: "Plus remaining balance owed" },
        { name: "Late Payment Fee", fee: "$5", description: "Per day until contribution is made" },
        { name: "Returned Payment Fee", fee: "$25", description: "If contribution payment fails" },
        { name: "Circle Admin Features", fee: "FREE", description: "Manage your circle at no cost" },
      ],
    },
    {
      id: "goals",
      title: "Savings Goals",
      icon: String.fromCodePoint(0x1f3af),
      fees: [
        { name: "Create Goal", fee: "FREE", description: "Set unlimited savings goals" },
        { name: "Goal Deposits", fee: "FREE", description: "Add money to goals anytime" },
        { name: "Goal Withdrawal (Completed)", fee: "FREE", description: "Withdraw after reaching goal" },
        { name: "Early Goal Withdrawal", fee: "2%", description: "Of withdrawn amount if goal not met" },
        { name: "Delete Unfunded Goal", fee: "FREE", description: "Remove goals with $0 balance" },
        { name: "Delete Funded Goal", fee: "2%", description: "Fee on balance, rest returned to wallet" },
        { name: "Auto-Save Setup", fee: "FREE", description: "Automatic contributions at no cost" },
        { name: "Payout Allocation", fee: "FREE", description: "Route payouts to goals automatically" },
      ],
    },
    {
      id: "remittance",
      title: "International Transfers",
      icon: String.fromCodePoint(0x1f30d),
      fees: [
        { name: "$1 - $100", fee: "$2.99", description: "Flat fee for small transfers" },
        { name: "$101 - $500", fee: "$3.99", description: "Flat fee for medium transfers" },
        { name: "$501 - $1,000", fee: "$4.99", description: "Flat fee for larger transfers" },
        { name: "$1,001 - $2,999", fee: "0.5%", description: "Percentage-based fee" },
        { name: "$3,000+", fee: "FREE", highlight: true, description: "No TandaXn fee on large transfers" },
        { name: "Mobile Money Delivery", fee: "Varies", description: "Partner fees may apply ($0-2)" },
        { name: "Bank Transfer Delivery", fee: "Varies", description: "Partner fees may apply ($0-5)" },
        { name: "Cash Pickup", fee: "+$3", description: "Additional fee for cash pickup" },
        { name: "Transfer Cancellation", fee: "FREE", description: "If funds not yet delivered" },
      ],
    },
    {
      id: "cards",
      title: "Payment Methods",
      icon: String.fromCodePoint(0x1f4b0),
      fees: [
        { name: "Link Bank Account", fee: "FREE", description: "Add unlimited bank accounts" },
        { name: "Link Debit Card", fee: "FREE", description: "Add unlimited debit cards" },
        { name: "Link Mobile Money", fee: "FREE", description: "Connect Orange Money, MTN, etc." },
        { name: "Remove Payment Method", fee: "FREE", description: "Unlink anytime" },
        { name: "Failed Payment Retry", fee: "FREE", description: "First retry at no charge" },
        { name: "Repeated Failed Payment", fee: "$5", description: "After 3 failed attempts" },
      ],
    },
    {
      id: "xnscore",
      title: "XN Score & Features",
      icon: String.fromCodePoint(0x2b50),
      fees: [
        { name: "XN Score Access", fee: "FREE", description: "View your score anytime" },
        { name: "Score History", fee: "FREE", description: "Full history available" },
        { name: "Score Improvement Tips", fee: "FREE", description: "Personalized recommendations" },
        { name: "Request Score Report", fee: "FREE", description: "Download detailed report" },
        { name: "Premium Features", fee: "Coming Soon", description: "Enhanced analytics" },
      ],
    },
  ]

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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Fee Schedule</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Last updated: {lastUpdated}</p>
          </div>
        </div>

        {/* Highlight */}
        <div
          style={{
            background: "rgba(0, 198, 174, 0.2)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "28px" }}>{String.fromCodePoint(0x1f389)}</span>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>Most Features are FREE</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.9 }}>
              No hidden fees. No monthly charges. Save more with TandaXn.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Fee Categories */}
        {feeCategories.map((category) => (
          <div
            key={category.id}
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              marginBottom: "12px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
              style={{
                width: "100%",
                padding: "16px",
                background: "#FFFFFF",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: "24px" }}>{category.icon}</span>
              <span style={{ flex: 1, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{category.title}</span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="2"
                style={{
                  transform: expandedCategory === category.id ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {expandedCategory === category.id && (
              <div style={{ padding: "0 16px 16px 16px" }}>
                {category.fees.map((fee, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px",
                      background: fee.highlight ? "#F0FDFB" : "#F5F7FA",
                      borderRadius: "10px",
                      marginBottom: idx < category.fees.length - 1 ? "8px" : 0,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{fee.name}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{fee.description}</p>
                    </div>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "20px",
                        background: fee.fee === "FREE" || fee.highlight ? "#00C6AE" : "#E5E7EB",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: fee.fee === "FREE" || fee.highlight ? "#FFFFFF" : "#0A2342",
                      }}
                    >
                      {fee.fee}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Disclaimer */}
        <div
          style={{
            marginTop: "8px",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Important Notes</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              "Fees are subject to change with 30 days notice",
              "Exchange rate margins apply to international transfers",
              "Partner fees (banks, mobile money) may apply",
              "Promotional offers may temporarily reduce or waive fees",
            ].map((note, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{String.fromCodePoint(0x2022)}</span>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>{note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div
          style={{
            marginTop: "12px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.6 }}>
            Questions about fees? Contact us at{" "}
            <span style={{ fontWeight: "600" }}>support@tandaxn.com</span> or call{" "}
            <span style={{ fontWeight: "600" }}>1-800-TANDAXN</span>
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="profile" />
    </div>
  )
}
