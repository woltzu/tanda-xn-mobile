"use client"

import { useState } from "react"

export default function PayoutHistoryScreen() {
  const [activeFilter, setActiveFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Mock data
  const payouts = [
    {
      id: "PO-001",
      circleName: "Family Savings Circle",
      emoji: "👨‍👩‍👧‍👦",
      amount: 1224,
      bonus: 24,
      date: "Jan 5, 2025",
      status: "completed",
      cycleNumber: 3,
    },
    {
      id: "PO-002",
      circleName: "Home Buyers Circle",
      emoji: "🏠",
      amount: 4000,
      bonus: 80,
      date: "Dec 15, 2024",
      status: "completed",
      cycleNumber: 2,
    },
    {
      id: "PO-003",
      circleName: "Holiday Fund",
      emoji: "🎄",
      amount: 600,
      bonus: 12,
      date: "Dec 1, 2024",
      status: "completed",
      cycleNumber: 6,
    },
    {
      id: "PO-004",
      circleName: "Business Investment",
      emoji: "💼",
      amount: 2500,
      bonus: 50,
      date: "Nov 20, 2024",
      status: "completed",
      cycleNumber: 4,
    },
    {
      id: "PO-005",
      circleName: "Family Savings Circle",
      emoji: "👨‍👩‍👧‍👦",
      amount: 1200,
      bonus: 24,
      date: "Oct 5, 2024",
      status: "completed",
      cycleNumber: 2,
    },
  ]

  const totalReceived = 9524
  const totalBonuses = 190

  const filters = [
    { id: "all", label: "All" },
    { id: "3months", label: "3 Months" },
    { id: "6months", label: "6 Months" },
    { id: "year", label: "This Year" },
  ]

  const filteredPayouts = payouts.filter((p) => p.circleName.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payout History</h1>
        </div>

        {/* Summary Stats */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>Total Received</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
              ${totalReceived.toLocaleString()}
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>Total Bonuses</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>+${totalBonuses}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Search */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "12px 16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by circle name..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "14px",
              color: "#0A2342",
            }}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto" }}>
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                background: activeFilter === filter.id ? "#00C6AE" : "#FFFFFF",
                color: activeFilter === filter.id ? "#FFFFFF" : "#6B7280",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Payout List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {filteredPayouts.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <span style={{ fontSize: "40px" }}>📭</span>
              <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No payouts found</p>
            </div>
          ) : (
            filteredPayouts.map((payout, idx) => (
              <button
                key={payout.id}
                onClick={() => console.log("Payout detail:", payout)}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: idx < filteredPayouts.length - 1 ? "1px solid #F3F4F6" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                  }}
                >
                  {payout.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {payout.circleName}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    Cycle {payout.cycleNumber} • {payout.date}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                    +${(payout.amount + payout.bonus).toLocaleString()}
                  </p>
                  {payout.bonus > 0 && (
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                      incl. ${payout.bonus} bonus
                    </p>
                  )}
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))
          )}
        </div>

        {/* Export Option */}
        <button
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            fontSize: "14px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export History (PDF)
        </button>
      </div>
    </div>
  )
}
