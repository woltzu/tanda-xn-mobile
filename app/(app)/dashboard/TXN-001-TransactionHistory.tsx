"use client"

import { useState } from "react"
import { TabBarInline } from "../../../components/TabBar"

export default function TransactionHistoryScreen() {
  const [filter, setFilter] = useState("all")

  const transactions = [
    {
      id: 1,
      type: "deposit",
      description: "Added from Bank •••4532",
      amount: 500,
      date: "Dec 29, 2024",
      time: "2:30 PM",
      status: "completed",
    },
    {
      id: 2,
      type: "contribution",
      description: "Family Savings - Cycle 3",
      amount: -200,
      date: "Dec 28, 2024",
      time: "10:15 AM",
      status: "completed",
    },
    {
      id: 3,
      type: "payout",
      description: "Holiday Fund Payout",
      amount: 1200,
      date: "Dec 28, 2024",
      time: "9:00 AM",
      status: "completed",
    },
    {
      id: 4,
      type: "deposit",
      description: "Added from Card •••8821",
      amount: 150,
      date: "Dec 25, 2024",
      time: "3:45 PM",
      status: "completed",
    },
    {
      id: 5,
      type: "withdrawal",
      description: "To Chase Bank •••4532",
      amount: -300,
      date: "Dec 20, 2024",
      time: "11:30 AM",
      status: "completed",
    },
    {
      id: 6,
      type: "contribution",
      description: "Family Savings - Cycle 2",
      amount: -200,
      date: "Dec 15, 2024",
      time: "9:00 AM",
      status: "completed",
    },
    {
      id: 7,
      type: "fee",
      description: "Early withdrawal penalty",
      amount: -20,
      date: "Dec 10, 2024",
      time: "2:00 PM",
      status: "completed",
    },
  ]

  const filters = [
    { id: "all", label: "All" },
    { id: "deposit", label: "Deposits" },
    { id: "contribution", label: "Contributions" },
    { id: "payout", label: "Payouts" },
    { id: "withdrawal", label: "Withdrawals" },
  ]

  const filteredTransactions = filter === "all" ? transactions : transactions.filter((t) => t.type === filter)

  const getTransactionStyle = (type: string) => {
    switch (type) {
      case "deposit":
        return { icon: "↓", bg: "#F0FDFB", color: "#00C6AE" }
      case "contribution":
        return { icon: "→", bg: "#F5F7FA", color: "#0A2342" }
      case "payout":
        return { icon: "★", bg: "#F0FDFB", color: "#00C6AE" }
      case "withdrawal":
        return { icon: "↑", bg: "#F5F7FA", color: "#0A2342" }
      case "fee":
        return { icon: "!", bg: "#FEF3C7", color: "#D97706" }
      default:
        return { icon: "•", bg: "#F5F7FA", color: "#6B7280" }
    }
  }

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleExport = () => {
    console.log("Export transactions")
  }

  const handleTransactionPress = (txn: any) => {
    console.log("View transaction details:", txn)
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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={handleBack}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transaction History</h1>
          </div>
          <button
            onClick={handleExport}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                background: filter === f.id ? "#FFFFFF" : "rgba(255,255,255,0.1)",
                color: filter === f.id ? "#0A2342" : "#FFFFFF",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {filteredTransactions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredTransactions.map((txn) => {
              const style = getTransactionStyle(txn.type)
              const isPositive = txn.amount > 0

              return (
                <button
                  key={txn.id}
                  onClick={() => handleTransactionPress(txn)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#FFFFFF",
                    borderRadius: "14px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: style.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      fontWeight: "700",
                      color: style.color,
                    }}
                  >
                    {style.icon}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {txn.description}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      {txn.date} at {txn.time}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: "700",
                        color: isPositive ? "#00C6AE" : "#0A2342",
                      }}
                    >
                      {isPositive ? "+" : ""}${Math.abs(txn.amount).toFixed(2)}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280", textTransform: "capitalize" }}>
                      {txn.status}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>No transactions found</p>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#6B7280" }}>
              {filter === "all" ? "You haven't made any transactions yet" : `No ${filter}s to show`}
            </p>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
