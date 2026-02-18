"use client"

import { useState } from "react"
import { CheckCircle, Share2, Download, Clock, Copy, ArrowRight } from "lucide-react"

export default function SendMoneySuccessScreen() {
  const [copied, setCopied] = useState(false)

  const transfer = {
    id: "TXN-2025-0108-78542",
    recipient: {
      name: "Mama Diallo",
      flag: "🇸🇳",
      location: "Dakar, Senegal",
    },
    amountSent: 200.0,
    currencySent: "USD",
    amountReceived: 122000,
    currencyReceived: "XOF",
    deliveryMethod: "Wave Mobile Money",
    estimatedDelivery: "Within minutes",
    fee: 0,
    exchangeRate: 610.0,
    timestamp: "January 8, 2025 at 3:45 PM EST",
    newBalance: 2250.0,
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "XOF" || currency === "NGN" || currency === "KES") {
      return `${currency} ${amount.toLocaleString()}`
    }
    return `$${amount.toFixed(2)}`
  }

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Success Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        {/* Success Animation */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 30px rgba(0,198,174,0.4)",
            }}
          >
            <CheckCircle size={40} color="#FFFFFF" />
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Money Sent! 🎉</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>
          {formatCurrency(transfer.amountReceived, transfer.currencyReceived)} is on its way to{" "}
          {transfer.recipient.name}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Transfer Summary Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* Recipient */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingBottom: "16px",
              borderBottom: "1px solid #E5E7EB",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
              }}
            >
              {transfer.recipient.flag}
            </div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: "0 0 2px 0",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                {transfer.recipient.name}
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{transfer.recipient.location}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  margin: "0 0 2px 0",
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#00C6AE",
                }}
              >
                {formatCurrency(transfer.amountReceived, transfer.currencyReceived)}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Receiving</p>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>You Sent</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {formatCurrency(transfer.amountSent, transfer.currencySent)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Exchange Rate</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                1 {transfer.currencySent} = {transfer.exchangeRate.toLocaleString()} {transfer.currencyReceived}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Fee</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#00C6AE" }}>
                {transfer.fee === 0 ? "Free ✨" : `$${transfer.fee.toFixed(2)}`}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Delivery Via</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{transfer.deliveryMethod}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Date & Time</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{transfer.timestamp}</span>
            </div>
          </div>
        </div>

        {/* Delivery Status */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
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
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={22} color="#FFFFFF" />
          </div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: "0 0 2px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: "#065F46",
              }}
            >
              Estimated Delivery
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#047857" }}>{transfer.estimatedDelivery}</p>
          </div>
        </div>

        {/* Transaction Reference */}
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
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Transaction ID</p>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                  fontFamily: "monospace",
                }}
              >
                {transfer.id}
              </p>
            </div>
            <button
              onClick={() => handleCopy(transfer.id)}
              style={{
                background: copied ? "#F0FDFB" : "#F5F7FA",
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                cursor: "pointer",
                display: "flex",
                transition: "background 0.2s",
              }}
            >
              <Copy size={18} color={copied ? "#00C6AE" : "#6B7280"} />
            </button>
          </div>
        </div>

        {/* New Balance */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>New Wallet Balance</p>
          <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#FFFFFF" }}>
            ${transfer.newBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
            }}
          >
            Quick Actions
          </h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => console.log("Share")}
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Share2 size={16} color="#0A2342" />
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>Share</span>
            </button>
            <button
              onClick={() => console.log("Download receipt")}
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Download size={16} color="#0A2342" />
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>Receipt</span>
            </button>
            <button
              onClick={() => console.log("Track")}
              style={{
                flex: 1,
                padding: "12px",
                background: "#F0FDFB",
                borderRadius: "10px",
                border: "1px solid #00C6AE",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <ArrowRight size={16} color="#00C6AE" />
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#00C6AE" }}>Track</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={() => console.log("Send again")}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "15px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          Send Again
        </button>
        <button
          onClick={() => console.log("Done")}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#00C6AE",
            fontSize: "15px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
