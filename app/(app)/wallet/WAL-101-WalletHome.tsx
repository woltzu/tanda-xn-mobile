"use client"

import { useState } from "react"
import {
  Plus,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Globe,
  Bell,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Plane,
  Users,
  X,
} from "lucide-react"
import { TabBarInline } from "../../../components/TabBar"

export default function WalletHomeScreen() {
  const [showBalance, setShowBalance] = useState(true)
  const [showSendOptions, setShowSendOptions] = useState(false)

  const currencies = [
    { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$", balance: 2450.0, change: 0 },
    { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€", balance: 850.0, usdValue: 923.5, rate: 1.0865, change: 0.23 },
    {
      code: "GBP",
      name: "British Pound",
      flag: "🇬🇧",
      symbol: "£",
      balance: 320.0,
      usdValue: 405.76,
      rate: 1.268,
      change: -0.15,
    },
    {
      code: "XOF",
      name: "CFA Franc",
      flag: "🇸🇳",
      symbol: "CFA",
      balance: 485000,
      usdValue: 785.0,
      rate: 0.00162,
      change: 0.45,
    },
  ]

  const rateAlerts = [
    { id: 1, from: "USD", to: "XOF", target: 620, current: 610, direction: "above", active: true },
    { id: 2, from: "EUR", to: "XOF", target: 650, current: 656, direction: "below", active: true },
  ]

  const recentTransactions = [
    {
      id: 1,
      type: "received",
      description: "From Amadou Diallo",
      flag: "🇫🇷",
      amount: 500,
      currency: "EUR",
      date: "Dec 20",
    },
    { id: 2, type: "converted", description: "USD → XOF", amount: 122000, currency: "XOF", date: "Dec 19" },
    {
      id: 3,
      type: "sent",
      description: "To Mama Diallo",
      flag: "🇸🇳",
      amount: -150000,
      currency: "XOF",
      date: "Dec 18",
    },
  ]

  // Calculate total balance in USD
  const totalBalanceUSD = currencies.reduce((total, curr) => {
    if (curr.code === "USD") return total + curr.balance
    return total + (curr.usdValue || 0)
  }, 0)

  const activeCurrencies = currencies.filter((c) => c.balance > 0)

  const formatCurrency = (amount: number, code: string, symbol?: string) => {
    if (code === "XOF" || code === "NGN" || code === "KES") {
      return `${symbol || code} ${Math.abs(amount).toLocaleString()}`
    }
    return `${symbol || "$"}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
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
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Wallet</h1>
          <Globe size={24} color="rgba(255,255,255,0.7)" />
        </div>

        {/* Total Balance Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "20px",
            padding: "24px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circle */}
          <div
            style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "150px",
              height: "150px",
              background: "rgba(0,198,174,0.1)",
              borderRadius: "50%",
            }}
          />

          <div style={{ position: "relative" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Total Balance</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <span style={{ fontSize: "36px", fontWeight: "700" }}>
                {showBalance ? `$${totalBalanceUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "••••••"}
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
              >
                {showBalance ? (
                  <Eye size={20} color="rgba(255,255,255,0.7)" />
                ) : (
                  <EyeOff size={20} color="rgba(255,255,255,0.7)" />
                )}
              </button>
            </div>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
              Across {activeCurrencies.length} currencies
            </p>

            {/* Quick Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => console.log("Add Money")}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Plus size={16} />
                Add
              </button>
              <button
                onClick={() => console.log("Convert")}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#00C6AE",
                  border: "none",
                  borderRadius: "12px",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw size={16} />
                Convert
              </button>
              <button
                onClick={() => setShowSendOptions(true)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "12px",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Send size={16} />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* My Currencies */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>My Currencies</h2>
            <button
              onClick={() => console.log("Add Currency")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {activeCurrencies.map((currency) => (
              <button
                key={currency.code}
                onClick={() => console.log("Currency clicked:", currency.code)}
                style={{
                  width: "100%",
                  background: "#FFFFFF",
                  borderRadius: "14px",
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
                    {currency.flag}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {currency.code}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{currency.name}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div>
                    <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {showBalance ? formatCurrency(currency.balance, currency.code, currency.symbol) : "••••"}
                    </p>
                    {currency.code !== "USD" && currency.usdValue && (
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                        ≈ ${currency.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} color="#9CA3AF" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Rate Alerts */}
        {rateAlerts.filter((a) => a.active).length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>Rate Alerts</h2>
              <button
                onClick={() => console.log("Manage Alerts")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#00C6AE",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Manage
              </button>
            </div>

            {rateAlerts
              .filter((a) => a.active)
              .slice(0, 2)
              .map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: "#E3F2FD",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Bell size={18} color="#1565C0" />
                    <div>
                      <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                        {alert.from} → {alert.to}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                        Alert when {alert.direction} {alert.target.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#1565C0" }}>
                    Now: {alert.current.toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>Recent Activity</h2>
            <button
              onClick={() => console.log("See All Activity")}
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
            {recentTransactions.slice(0, 3).map((tx) => {
              const txStyle = getTransactionIcon(tx.type)
              const TxIcon = txStyle.icon
              const isPositive = tx.amount > 0

              return (
                <button
                  key={tx.id}
                  onClick={() => console.log("Transaction clicked:", tx.id)}
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "12px",
                    padding: "12px 14px",
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
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: txStyle.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <TxIcon size={18} color={txStyle.color} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                        {tx.description}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{tx.date}</p>
                    </div>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: "600",
                      color: isPositive ? "#00C6AE" : tx.type === "sent" ? "#DC2626" : "#0A2342",
                    }}
                  >
                    {isPositive ? "+" : ""}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Send Options Modal */}
      {showSendOptions && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 200,
          }}
          onClick={() => setShowSendOptions(false)}
        >
          <div
            style={{
              width: "100%",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 40px 20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div
              style={{
                width: "40px",
                height: "4px",
                background: "#E5E7EB",
                borderRadius: "2px",
                margin: "0 auto 20px auto",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                How would you like to send?
              </h2>
              <button
                onClick={() => setShowSendOptions(false)}
                style={{
                  background: "#F5F7FA",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} color="#6B7280" />
              </button>
            </div>

            {/* Send to TandaXn User */}
            <button
              onClick={() => {
                setShowSendOptions(false)
                console.log("Navigate to Send Money - Local Transfer")
              }}
              style={{
                width: "100%",
                padding: "20px",
                background: "#F0FDFB",
                borderRadius: "16px",
                border: "2px solid #00C6AE",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                textAlign: "left",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={28} color="#FFFFFF" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: "700", color: "#0A2342" }}>
                  Send to TandaXn User
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                  Instant & free transfers to friends and family on TandaXn
                </p>
              </div>
              <div
                style={{
                  background: "#00C6AE",
                  padding: "4px 10px",
                  borderRadius: "12px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#FFFFFF" }}>FREE</span>
              </div>
            </button>

            {/* Send Money Abroad */}
            <button
              onClick={() => {
                setShowSendOptions(false)
                console.log("Navigate to Send Money Home - International Transfer")
              }}
              style={{
                width: "100%",
                padding: "20px",
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  background: "#0A2342",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plane size={28} color="#00C6AE" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "17px", fontWeight: "700", color: "#0A2342" }}>
                  Send Money Abroad
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                  International transfers to bank, mobile money, or cash pickup
                </p>
              </div>
              <ChevronRight size={20} color="#9CA3AF" />
            </button>

            {/* Info */}
            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "16px" }}>💡</span>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                Save up to 70% on international fees compared to traditional services
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <TabBarInline activeTab="wallet" />
    </div>
  )
}
