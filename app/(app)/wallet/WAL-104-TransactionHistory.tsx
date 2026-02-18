"use client"
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, RefreshCw, Clock } from "lucide-react"
import { useState } from "react"

export default function TransactionHistoryScreen() {
  const [activeFilter, setActiveFilter] = useState("all")

  const transactions = [
    {
      id: 1,
      type: "received",
      description: "From Amadou Diallo",
      flag: "🇫🇷",
      amount: 500,
      currency: "EUR",
      date: "Dec 20",
      time: "14:32",
      status: "completed",
    },
    {
      id: 2,
      type: "converted",
      description: "USD → XOF",
      fromAmount: 200,
      toAmount: 122000,
      toCurrency: "XOF",
      date: "Dec 19",
      time: "09:15",
      status: "completed",
    },
    {
      id: 3,
      type: "sent",
      description: "To Mama Diallo",
      flag: "🇸🇳",
      amount: -150000,
      currency: "XOF",
      date: "Dec 18",
      time: "16:45",
      status: "completed",
    },
    {
      id: 4,
      type: "received",
      description: "Circle Payout",
      flag: "🔄",
      amount: 2000,
      currency: "USD",
      date: "Dec 15",
      time: "12:00",
      status: "completed",
    },
    {
      id: 5,
      type: "converted",
      description: "GBP → USD",
      fromAmount: 100,
      toAmount: 126.8,
      toCurrency: "USD",
      date: "Dec 14",
      time: "11:20",
      status: "completed",
    },
  ]

  const filters = [
    { id: "all", label: "All" },
    { id: "sent", label: "Sent" },
    { id: "received", label: "Received" },
    { id: "converted", label: "Converted" },
  ]

  const filteredTransactions =
    activeFilter === "all" ? transactions : transactions.filter((tx) => tx.type === activeFilter)

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "received":
        return { icon: ArrowDownLeft, color: "#00C6AE", bg: "#F0FDFB" }
      case "sent":
        return { icon: ArrowUpRight, color: "#DC2626", bg: "#FEE2E2" }
      case "converted":
        return { icon: RefreshCw, color: "#1565C0", bg: "#E3F2FD" }
      default:
        return { icon: Clock, color: "#6B7280", bg: "#F5F7FA" }
    }
  }

  const formatAmount = (tx: any) => {
    if (tx.type === "converted") {
      return `${tx.toCurrency} ${Math.abs(tx.toAmount).toLocaleString()}`
    }
    const code = tx.currency
    const amount = Math.abs(tx.amount)
    if (code === "XOF" || code === "NGN" || code === "KES") {
      return `${code} ${amount.toLocaleString()}`
    }
    if (code === "EUR") return `€${amount.toFixed(2)}`
    if (code === "GBP") return `£${amount.toFixed(2)}`
    return `$${amount.toFixed(2)}`
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
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
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transaction History</h1>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              style={{
                padding: "10px 18px",
                background: activeFilter === filter.id ? "#FFFFFF" : "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "600",
                color: activeFilter === filter.id ? "#0A2342" : "#FFFFFF",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {filteredTransactions.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <Clock size={40} color="#9CA3AF" style={{ marginBottom: "12px" }} />
            <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No transactions found</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredTransactions.map((tx) => {
              const txStyle = getTransactionIcon(tx.type)
              const TxIcon = txStyle.icon
              const isPositive = tx.type === "received" || (tx.amount && tx.amount > 0)

              return (
                <button
                  key={tx.id}
                  onClick={() => console.log("Transaction clicked", tx.id)}
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "14px",
                    padding: "14px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: txStyle.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <TxIcon size={20} color={txStyle.color} />
                      </div>
                      <div>
                        <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                          {tx.description}
                        </p>
                        <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                          {tx.date} • {tx.time}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "16px",
                          fontWeight: "700",
                          color: isPositive ? "#00C6AE" : tx.type === "sent" ? "#DC2626" : "#0A2342",
                        }}
                      >
                        {isPositive ? "+" : "-"}
                        {formatAmount(tx)}
                      </p>
                      {tx.type === "converted" && (
                        <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>
                          from {tx.fromAmount} {tx.currency || "USD"}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
