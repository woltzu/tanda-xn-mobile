"use client"

import { useState } from "react"

export default function TransferHistoryScreen() {
  const [filter, setFilter] = useState("all")

  const transfers = [
    {
      id: "TXN-2025-0105-78901",
      recipient: { name: "Mama Françoise", flag: "🇨🇲" },
      sendAmount: 200,
      receiveAmount: 121100,
      currency: "XAF",
      status: "delivered",
      date: "Jan 5, 2025",
    },
    {
      id: "TXN-2024-1220-45678",
      recipient: { name: "Papa Jean", flag: "🇨🇲" },
      sendAmount: 150,
      receiveAmount: 90825,
      currency: "XAF",
      status: "delivered",
      date: "Dec 20, 2024",
    },
    {
      id: "TXN-2024-1205-12345",
      recipient: { name: "Mama Françoise", flag: "🇨🇲" },
      sendAmount: 100,
      receiveAmount: 60550,
      currency: "XAF",
      status: "delivered",
      date: "Dec 5, 2024",
    },
    {
      id: "TXN-2024-1128-98765",
      recipient: { name: "Auntie Marie", flag: "🇸🇳" },
      sendAmount: 100,
      receiveAmount: 60550,
      currency: "XOF",
      status: "delivered",
      date: "Nov 28, 2024",
    },
  ]

  const stats = {
    totalSent: 550,
    transferCount: 4,
    savedVsWU: 42.5,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return { label: "Delivered", bg: "#F0FDFB", color: "#00897B" }
      case "processing":
        return { label: "Processing", bg: "#FEF3C7", color: "#D97706" }
      case "failed":
        return { label: "Failed", bg: "#FEE2E2", color: "#DC2626" }
      default:
        return { label: status, bg: "#F5F7FA", color: "#6B7280" }
    }
  }

  const filteredTransfers = transfers.filter((t) => filter === "all" || t.status === filter)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transfer History</h1>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>${stats.totalSent}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Total Sent</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>{stats.transferCount}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Transfers</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>${stats.savedVsWU}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Saved</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Filter */}
        <div
          style={{
            display: "flex",
            background: "#FFFFFF",
            borderRadius: "10px",
            padding: "4px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          {["all", "delivered", "processing"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                background: filter === f ? "#0A2342" : "transparent",
                color: filter === f ? "#FFFFFF" : "#6B7280",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Transfers List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {filteredTransfers.length > 0 ? (
            filteredTransfers.map((transfer, idx, arr) => {
              const statusBadge = getStatusBadge(transfer.status)
              return (
                <button
                  key={transfer.id}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    background: "#FFFFFF",
                    border: "none",
                    borderBottom: idx < arr.length - 1 ? "1px solid #F5F7FA" : "none",
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
                      borderRadius: "50%",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                    }}
                  >
                    {transfer.recipient.flag}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {transfer.recipient.name}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{transfer.date}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      -${transfer.sendAmount}
                    </p>
                    <span
                      style={{
                        padding: "2px 6px",
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        fontSize: "10px",
                        fontWeight: "600",
                        borderRadius: "4px",
                        display: "inline-block",
                        marginTop: "2px",
                      }}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                </button>
              )
            })
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No transfers found</p>
            </div>
          )}
        </div>
      </div>

      {/* New Transfer Button */}
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
          Send Money
        </button>
      </div>
    </div>
  )
}
