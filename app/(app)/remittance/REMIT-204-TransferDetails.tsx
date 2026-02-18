"use client"

import { useState } from "react"

export default function TransferDetailsScreen() {
  const [transfer] = useState({
    id: "TXN-2025122900001",
    sendAmount: 200.0,
    fee: 2.99,
    totalPaid: 202.99,
    receiveAmount: 121100,
    exchangeRate: 605.5,
    recipient: {
      name: "Mama Kengne",
      phone: "+237 6XX XXX XXX",
      country: "Cameroon",
      flag: "🇨🇲",
      currency: "XAF",
    },
    deliveryMethod: "Mobile Money",
    provider: "MTN Mobile Money",
    status: "completed", // completed, processing, failed
    createdAt: "Dec 29, 2025 3:45 PM",
    completedAt: "Dec 29, 2025 3:47 PM",
    paymentMethod: "Bank Account (•••• 4521)",
  })

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return { bg: "#F0FDFB", text: "#00897B", label: "Completed", icon: "✅" }
      case "processing":
        return { bg: "#FEF3C7", text: "#D97706", label: "Processing", icon: "⏳" }
      case "failed":
        return { bg: "#FEE2E2", text: "#DC2626", label: "Failed", icon: "❌" }
      default:
        return { bg: "#F5F7FA", text: "#6B7280", label: status, icon: "📤" }
    }
  }

  const statusStyle = getStatusStyle(transfer.status)

  const handleBack = () => console.log("Navigate back to transfer history")
  const handleRepeatTransfer = () => console.log("Repeat this transfer")
  const handleDownloadReceipt = () => console.log("Download receipt")
  const handleContactSupport = () => console.log("Contact support")
  const handleTrack = () => console.log("Track transfer")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transfer Details</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8, fontFamily: "monospace" }}>
              {transfer.id}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "rgba(255,255,255,0.1)",
            padding: "12px 16px",
            borderRadius: "12px",
          }}
        >
          <span style={{ fontSize: "28px" }}>{statusStyle.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{statusStyle.label}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {transfer.status === "completed" ? transfer.completedAt : transfer.createdAt}
            </p>
          </div>
          {transfer.status === "processing" && (
            <button
              onClick={handleTrack}
              style={{
                padding: "8px 16px",
                background: "#00C6AE",
                border: "none",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Track
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Amount Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              marginBottom: "16px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>You sent</p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
                ${transfer.sendAmount.toFixed(2)}
              </p>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>They received</p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
                {transfer.receiveAmount.toLocaleString()} {transfer.recipient.currency}
              </p>
            </div>
          </div>

          {/* Recipient */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#FFFFFF",
                border: "2px solid #00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              {transfer.recipient.flag}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {transfer.recipient.name}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{transfer.provider}</p>
            </div>
          </div>
        </div>

        {/* Transaction Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Transaction Details
          </h3>

          {[
            { label: "Transaction ID", value: transfer.id, mono: true },
            { label: "Transfer amount", value: `$${transfer.sendAmount.toFixed(2)}` },
            { label: "Transfer fee", value: `$${transfer.fee.toFixed(2)}` },
            { label: "Total paid", value: `$${transfer.totalPaid.toFixed(2)}`, bold: true },
            { label: "Exchange rate", value: `1 USD = ${transfer.exchangeRate} ${transfer.recipient.currency}` },
            { label: "Recipient phone", value: transfer.recipient.phone },
            { label: "Delivery method", value: transfer.deliveryMethod },
            { label: "Payment method", value: transfer.paymentMethod },
            { label: "Initiated", value: transfer.createdAt },
            {
              label: transfer.status === "completed" ? "Completed" : "Status updated",
              value: transfer.completedAt || "In progress",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: idx < 9 ? "1px solid #F5F7FA" : "none",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>{item.label}</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: item.bold ? "700" : "500",
                  color: "#0A2342",
                  fontFamily: item.mono ? "monospace" : "inherit",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Actions</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={handleDownloadReceipt}
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ flex: 1, fontSize: "14px", color: "#0A2342", textAlign: "left" }}>Download Receipt</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              onClick={handleContactSupport}
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span style={{ flex: 1, fontSize: "14px", color: "#0A2342", textAlign: "left" }}>
                Need Help with This Transfer?
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
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
          onClick={handleRepeatTransfer}
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          Send Again to {transfer.recipient.name.split(" ")[0]}
        </button>
      </div>
    </div>
  )
}
