"use client"

import { useState } from "react"

export default function ReviewTransferScreen() {
  const [confirmed, setConfirmed] = useState(false)

  const recipient = {
    name: "Mama Françoise",
    flag: "🇨🇲",
    countryName: "Cameroon",
    method: "mobile_money",
    provider: "MTN MoMo",
    phone: "+237 6XX XXX XX45",
  }

  const transfer = {
    sendAmount: 200,
    receiveAmount: 121100,
    currency: "XAF",
    exchangeRate: 605.5,
    deliveryFee: 2.99,
    deliverySpeed: "Instant",
    deliveryTime: "Within minutes",
    totalCost: 202.99,
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "160px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Review & Send</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount Display */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
            {recipient.name} receives
          </p>
          <p style={{ margin: "0 0 8px 0", fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>
            {transfer.receiveAmount.toLocaleString()} {transfer.currency}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <span style={{ fontSize: "14px" }}>⚡</span>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)" }}>{transfer.deliveryTime}</span>
          </div>
        </div>

        {/* Recipient */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>RECIPIENT</h3>
            <button
              onClick={() => console.log("Edit recipient")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                color: "#0A2342",
                fontWeight: "600",
              }}
            >
              {recipient.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                {recipient.name} {recipient.flag}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                📱 {recipient.provider} • {recipient.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Transfer Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>TRANSFER DETAILS</h3>
            <button
              onClick={() => console.log("Edit amount")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>You send</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                ${transfer.sendAmount.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Exchange rate</span>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>
                1 USD = {transfer.exchangeRate} {transfer.currency}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Delivery fee ({transfer.deliverySpeed})</span>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>${transfer.deliveryFee.toFixed(2)}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total cost</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                ${transfer.totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <button
          onClick={() => setConfirmed(!confirmed)}
          style={{
            width: "100%",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              border: confirmed ? "none" : "2px solid #D1D5DB",
              background: confirmed ? "#00C6AE" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            {confirmed && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            I confirm that the recipient details are correct and authorize this transfer of $
            {transfer.totalCost.toFixed(2)} from my TandaXn wallet.
          </p>
        </button>
      </div>

      {/* Send Button */}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontSize: "11px", color: "#6B7280" }}>Secured with 256-bit encryption</span>
        </div>
        <button
          onClick={() => console.log("Send money")}
          disabled={!confirmed}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: confirmed ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: confirmed ? "#FFFFFF" : "#9CA3AF",
            cursor: confirmed ? "pointer" : "not-allowed",
          }}
        >
          Send ${transfer.totalCost.toFixed(2)}
        </button>
      </div>
    </div>
  )
}
