"use client"

import { useState } from "react"

export default function TransferHistoryScreen() {
  const [filter, setFilter] = useState("all")

  const stats = {
    totalSent: 2450.0,
    thisMonth: 400.0,
    transferCount: 12,
    savedInFees: 186.5,
  }

  const transfers = [
    {
      id: "t1",
      recipient: "Mama Kengne",
      country: "Cameroon",
      flag: "🇨🇲",
      amount: 200,
      receiveAmount: 121100,
      currency: "XAF",
      date: "Dec 29, 2025",
      status: "completed",
      method: "MTN Mobile Money",
    },
    {
      id: "t2",
      recipient: "Papa Kengne",
      country: "Cameroon",
      flag: "🇨🇲",
      amount: 200,
      receiveAmount: 120800,
      currency: "XAF",
      date: "Dec 15, 2025",
      status: "completed",
      method: "Orange Money",
    },
    {
      id: "t3",
      recipient: "Auntie Grace",
      country: "Kenya",
      flag: "🇰🇪",
      amount: 150,
      receiveAmount: 19350,
      currency: "KES",
      date: "Dec 1, 2025",
      status: "completed",
      method: "M-Pesa",
    },
    {
      id: "t4",
      recipient: "Cousin David",
      country: "Nigeria",
      flag: "🇳🇬",
      amount: 100,
      receiveAmount: 155000,
      currency: "NGN",
      date: "Nov 20, 2025",
      status: "completed",
      method: "Bank Transfer",
    },
    {
      id: "t5",
      recipient: "Mama Kengne",
      country: "Cameroon",
      flag: "🇨🇲",
      amount: 300,
      receiveAmount: 180900,
      currency: "XAF",
      date: "Nov 10, 2025",
      status: "completed",
      method: "MTN Mobile Money",
    },
  ]

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return { bg: "#F0FDFB", text: "#00897B", label: "Completed" }
      case "pending":
        return { bg: "#FEF3C7", text: "#D97706", label: "Pending" }
      case "failed":
        return { bg: "#FEE2E2", text: "#DC2626", label: "Failed" }
      default:
        return { bg: "#F5F7FA", text: "#6B7280", label: status }
    }
  }

  const filteredTransfers = transfers.filter((t) => {
    if (filter === "all") return true
    return t.status === filter
  })

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleViewTransfer = (transfer: any) => {
    console.log("View transfer:", transfer)
  }

  const handleSendMoney = () => {
    console.log("Send money")
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transfer History</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Your international transfers</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div
            style={{
              padding: "14px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>Total Sent</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>${stats.totalSent.toLocaleString()}</p>
          </div>
          <div
            style={{
              padding: "14px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>This Month</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>${stats.thisMonth.toLocaleString()}</p>
          </div>
          <div
            style={{
              padding: "14px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>Transfers</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{stats.transferCount}</p>
          </div>
          <div
            style={{
              padding: "14px",
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", opacity: 0.8 }}>Saved in Fees</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
              ${stats.savedInFees.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Filter Tabs */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "16px",
            display: "flex",
            border: "1px solid #E5E7EB",
          }}
        >
          {[
            { value: "all", label: "All" },
            { value: "completed", label: "Completed" },
            { value: "pending", label: "Pending" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: filter === tab.value ? "#0A2342" : "transparent",
                fontSize: "13px",
                fontWeight: "500",
                color: filter === tab.value ? "#FFFFFF" : "#6B7280",
                cursor: "pointer",
              }}
            >
              {tab.label}
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
          {filteredTransfers.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <span style={{ fontSize: "40px" }}>🌍</span>
              <p style={{ margin: "12px 0 4px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                No transfers yet
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Start sending money home to your family</p>
            </div>
          ) : (
            filteredTransfers.map((transfer, idx) => {
              const statusStyle = getStatusStyle(transfer.status)
              return (
                <button
                  key={transfer.id}
                  onClick={() => handleViewTransfer(transfer)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderBottom: idx < filteredTransfers.length - 1 ? "1px solid #F5F7FA" : "none",
                    background: "#FFFFFF",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  {/* Country Flag */}
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "22px",
                    }}
                  >
                    {transfer.flag}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                        {transfer.recipient}
                      </p>
                      <span
                        style={{
                          padding: "2px 6px",
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          fontSize: "9px",
                          fontWeight: "600",
                          borderRadius: "4px",
                        }}
                      >
                        {statusStyle.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                      {transfer.method} • {transfer.date}
                    </p>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      -${transfer.amount}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#00897B" }}>
                      {transfer.receiveAmount.toLocaleString()} {transfer.currency}
                    </p>
                  </div>

                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Send Money Button */}
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
          onClick={handleSendMoney}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          🌍 Send Money Home
        </button>
      </div>
    </div>
  )
}
