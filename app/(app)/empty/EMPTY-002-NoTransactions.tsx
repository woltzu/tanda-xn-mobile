"use client"

import { TabBarInline } from "../../../components/TabBar"

export default function NoTransactionsEmptyState() {
  const handleMakeDeposit = () => {
    console.log("Add money")
  }

  const handleJoinCircle = () => {
    console.log("Join circle")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        paddingBottom: "120px",
        textAlign: "center",
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "#F5F7FA",
          border: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <span style={{ fontSize: "48px" }}>{String.fromCodePoint(0x1f4cb)}</span>
      </div>

      {/* Content */}
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>
        No Transactions Yet
      </h3>
      <p
        style={{
          margin: "0 0 24px 0",
          fontSize: "14px",
          color: "#6B7280",
          lineHeight: 1.5,
          maxWidth: "280px",
        }}
      >
        Your transaction history will appear here once you start saving or sending money.
      </p>

      {/* Actions */}
      <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
        <button
          onClick={handleMakeDeposit}
          style={{
            padding: "12px 20px",
            borderRadius: "10px",
            border: "none",
            background: "#00C6AE",
            fontSize: "14px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          Add Money
        </button>
        <button
          onClick={handleJoinCircle}
          style={{
            padding: "12px 20px",
            borderRadius: "10px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          Join Circle
        </button>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
