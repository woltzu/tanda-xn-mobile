"use client"

import { useState } from "react"

export default function TransactionDetailsScreen() {
  const [copied, setCopied] = useState(false)

  const transaction = {
    id: "TXN-2024-1229-12345",
    type: "deposit",
    description: "Added from Bank •••4532",
    amount: 500,
    fee: 0,
    net: 500,
    date: "Dec 29, 2024",
    time: "2:30 PM",
    status: "completed",
    method: "Bank Transfer",
    account: "Chase Bank •••• 4532",
    reference: "REF-20241229-ABC123",
  }

  const isPositive = transaction.amount > 0

  const getStatusStyle = () => {
    switch (transaction.status) {
      case "completed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Completed" }
      case "pending":
        return { bg: "#FEF3C7", color: "#D97706", label: "Pending" }
      case "failed":
        return { bg: "#FEE2E2", color: "#DC2626", label: "Failed" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: transaction.status }
    }
  }

  const getTypeIcon = () => {
    switch (transaction.type) {
      case "deposit":
        return { icon: "↓", bg: "#F0FDFB", color: "#00C6AE" }
      case "contribution":
        return { icon: "→", bg: "#0A2342", color: "#FFFFFF" }
      case "payout":
        return { icon: "★", bg: "#00C6AE", color: "#FFFFFF" }
      case "withdrawal":
        return { icon: "↑", bg: "#0A2342", color: "#FFFFFF" }
      case "fee":
        return { icon: "!", bg: "#FEF3C7", color: "#D97706" }
      default:
        return { icon: "•", bg: "#F5F7FA", color: "#6B7280" }
    }
  }

  const statusStyle = getStatusStyle()
  const typeStyle = getTypeIcon()

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleGetHelp = () => {
    console.log("Get help")
  }

  const handleShare = () => {
    console.log("Share transaction")
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(transaction.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transaction Details</h1>
          </div>
          <span
            style={{
              background: statusStyle.bg,
              color: statusStyle.color,
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-50px", padding: "0 20px" }}>
        {/* Amount Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: typeStyle.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              fontSize: "28px",
              fontWeight: "700",
              color: typeStyle.color,
            }}
          >
            {typeStyle.icon}
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#6B7280", textTransform: "capitalize" }}>
            {transaction.type}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "36px",
              fontWeight: "700",
              color: isPositive ? "#00C6AE" : "#0A2342",
            }}
          >
            {isPositive ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#6B7280" }}>{transaction.description}</p>
        </div>

        {/* Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Date & Time</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {transaction.date} at {transaction.time}
              </span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Method</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{transaction.method}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Account</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{transaction.account}</span>
            </div>
            {transaction.fee > 0 && (
              <>
                <div style={{ height: "1px", background: "#E5E7EB" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Fee</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#D97706" }}>
                    -${transaction.fee.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Net Amount</span>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>
                    ${transaction.net.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Reference */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Reference</h3>
          <div
            style={{
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Transaction ID</p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#0A2342",
                  fontFamily: "monospace",
                }}
              >
                {transaction.id}
              </p>
            </div>
            <button
              onClick={handleCopy}
              style={{
                padding: "8px 12px",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "500",
                color: "#6B7280",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          {transaction.reference && (
            <div
              style={{
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "8px",
                marginTop: "8px",
              }}
            >
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Reference Number</p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#0A2342",
                  fontFamily: "monospace",
                }}
              >
                {transaction.reference}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Share</span>
          </button>
          <button
            onClick={handleGetHelp}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Get Help</span>
          </button>
        </div>
      </div>
    </div>
  )
}
