"use client"
import {
  ArrowLeft,
  RefreshCw,
  Send,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
} from "lucide-react"

export default function CurrencyDetailScreen() {
  const currency = {
    code: "XOF",
    name: "CFA Franc (BCEAO)",
    flag: "🇸🇳",
    symbol: "CFA",
    balance: 485000,
    usdValue: 785.0,
    rate: 0.00162,
    rateInverse: 610,
    change: 0.45,
    changeAmount: 2.75,
  }

  const transactions = [
    { id: 1, type: "received", description: "From Amadou Diallo", amount: 122000, date: "Dec 20", time: "14:32" },
    { id: 2, type: "sent", description: "To Mama Diallo", amount: -150000, date: "Dec 18", time: "16:45" },
    { id: 3, type: "converted", description: "From USD", amount: 200000, date: "Dec 15", time: "09:15" },
  ]

  const isPositiveChange = currency.change >= 0

  const formatBalance = (amount: number) => {
    if (currency.code === "XOF" || currency.code === "NGN" || currency.code === "KES") {
      return `${currency.symbol} ${amount.toLocaleString()}`
    }
    return `${currency.symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "received":
        return { icon: ArrowDownLeft, color: "#00C6AE", bg: "#F0FDFB" }
      case "sent":
        return { icon: ArrowUpRight, color: "#DC2626", bg: "#FEE2E2" }
      case "converted":
        return { icon: RefreshCw, color: "#1565C0", bg: "#E3F2FD" }
      default:
        return { icon: RefreshCw, color: "#6B7280", bg: "#F5F7FA" }
    }
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
            marginBottom: "24px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "28px" }}>{currency.flag}</span>
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{currency.code}</h1>
              <p style={{ margin: 0, fontSize: "13px", opacity: 0.8 }}>{currency.name}</p>
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", opacity: 0.7 }}>Balance</p>
          <p style={{ margin: "0 0 4px 0", fontSize: "32px", fontWeight: "700" }}>{formatBalance(currency.balance)}</p>
          {currency.usdValue && (
            <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>
              ≈ ${currency.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Exchange Rate Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#6B7280" }}>Exchange Rate</p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>
                1 USD = {currency.rateInverse?.toLocaleString() || (1 / currency.rate).toFixed(2)} {currency.code}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                background: isPositiveChange ? "#F0FDFB" : "#FEE2E2",
                borderRadius: "20px",
              }}
            >
              {isPositiveChange ? <TrendingUp size={16} color="#00C6AE" /> : <TrendingDown size={16} color="#DC2626" />}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: isPositiveChange ? "#00C6AE" : "#DC2626",
                }}
              >
                {isPositiveChange ? "+" : ""}
                {currency.change}%
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={() => console.log("Convert")}
            style={{
              flex: 1,
              padding: "14px",
              background: "#00C6AE",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <RefreshCw size={18} color="#FFFFFF" />
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Convert</span>
          </button>
          <button
            onClick={() => console.log("Send")}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Send size={18} color="#0A2342" />
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Send</span>
          </button>
          <button
            onClick={() => console.log("Add")}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Plus size={18} color="#0A2342" />
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Add</span>
          </button>
        </div>

        {/* Rate Chart Placeholder */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Rate History (7 Days)
          </h3>
          <div
            style={{
              height: "120px",
              background: "#F5F7FA",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>📈 Rate chart coming soon</p>
          </div>
        </div>

        {/* Transactions */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              {currency.code} Transactions
            </h3>
            <button
              onClick={() => console.log("See all transactions")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              See All
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {transactions.map((tx) => {
              const txStyle = getTransactionIcon(tx.type)
              const TxIcon = txStyle.icon
              const isPositive = tx.amount > 0

              return (
                <button
                  key={tx.id}
                  onClick={() => console.log("Transaction clicked", tx.id)}
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "12px",
                    padding: "14px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "50%",
                        background: txStyle.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <TxIcon size={20} color={txStyle.color} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                        {tx.description}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                        {tx.date} • {tx.time}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: "600",
                        color: isPositive ? "#00C6AE" : tx.type === "sent" ? "#DC2626" : "#0A2342",
                      }}
                    >
                      {isPositive ? "+" : ""}
                      {formatBalance(tx.amount)}
                    </p>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
