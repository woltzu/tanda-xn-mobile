"use client"

import { useState } from "react"
import {
  SUPPORTED_COUNTRIES,
  DELIVERY_OPTIONS,
  calculateFees,
  formatCurrency,
  formatUSD,
  getExchangeRate,
} from "../../../lib/transferConfig"

export default function ReviewConfirmScreen() {
  // In real app, these come from navigation params / transfer context
  const country = SUPPORTED_COUNTRIES.find((c) => c.code === "CM")!
  const delivery = DELIVERY_OPTIONS.find((d) => d.id === "instant")!
  const exchangeRate = getExchangeRate("USD", country.currency)
  const fees = calculateFees(200, delivery, exchangeRate, country.decimals)

  const transfer = {
    sendAmount: fees.sendAmount,
    fee: fees.totalFee,
    totalDebit: fees.totalToPay,
    receiveAmount: fees.receiveAmount,
    exchangeRate: exchangeRate,
    recipient: {
      name: "Mama Kengne",
      phone: "+237 6XX XXX XXX",
      country: country.name,
      flag: country.flag,
      currency: country.currency,
    },
    deliveryMethod: "Mobile Money",
    provider: "MTN Mobile Money",
    estimatedDelivery: delivery.daysLabel,
  }

  const [agreed, setAgreed] = useState(false)
  const [processing, setProcessing] = useState(false)

  const handleConfirm = () => {
    setProcessing(true)
    console.log("Transfer confirmed")
  }

  const handleEdit = (section: string) => {
    console.log(`Edit ${section}`)
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
      {/* Header - Navy */}
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Review Transfer</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Confirm details before sending</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount Summary Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#6B7280" }}>You're sending</p>
          <p style={{ margin: "0 0 16px 0", fontSize: "36px", fontWeight: "700", color: "#0A2342" }}>
            {formatUSD(transfer.sendAmount)}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              🇺🇸
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <div
              style={{
                width: "40px",
                height: "40px",
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
          </div>

          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>{transfer.recipient.name} receives</p>
          <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
            {formatCurrency(transfer.receiveAmount, transfer.recipient.currency)} {transfer.recipient.currency}
          </p>
        </div>

        {/* Recipient Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Recipient</h3>
            <button
              onClick={() => handleEdit("recipient")}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "11px",
                fontWeight: "500",
                color: "#6B7280",
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
                background: "#F0FDFB",
                border: "2px solid #00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              {transfer.recipient.flag}
            </div>
            <div>
              <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                {transfer.recipient.name}
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{transfer.recipient.phone}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>{transfer.provider}</p>
            </div>
          </div>
        </div>

        {/* Transfer Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Transfer Details</h3>
            <button
              onClick={() => handleEdit("amount")}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "11px",
                fontWeight: "500",
                color: "#6B7280",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          </div>

          {[
            { label: "Transfer amount", value: formatUSD(transfer.sendAmount) },
            { label: "Transfer fee", value: formatUSD(transfer.fee) },
            { label: "Exchange rate", value: `1 USD = ${formatCurrency(transfer.exchangeRate, transfer.recipient.currency)} ${transfer.recipient.currency}` },
            { label: "Delivery method", value: transfer.deliveryMethod },
            { label: "Estimated delivery", value: transfer.estimatedDelivery, highlight: true },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: idx < 4 ? "1px solid #F5F7FA" : "none",
              }}
            >
              <span style={{ fontSize: "13px", color: "#6B7280" }}>{item.label}</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: item.highlight ? "#00897B" : "#0A2342",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}

          <div style={{ height: "1px", background: "#E5E7EB", margin: "12px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Total to pay</span>
            <span style={{ fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              {formatUSD(transfer.totalDebit)}
            </span>
          </div>
        </div>

        {/* Terms Agreement */}
        <button
          onClick={() => setAgreed(!agreed)}
          style={{
            width: "100%",
            padding: "14px 16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              border: agreed ? "none" : "2px solid #E5E7EB",
              background: agreed ? "#00C6AE" : "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            {agreed && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            I confirm the recipient details are correct and agree to the{" "}
            <span style={{ color: "#00897B", textDecoration: "underline" }}>Terms of Service</span> and{" "}
            <span style={{ color: "#00897B", textDecoration: "underline" }}>Transfer Policy</span>
          </span>
        </button>
      </div>

      {/* Confirm Button */}
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
          onClick={handleConfirm}
          disabled={!agreed || processing}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: agreed && !processing ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: agreed && !processing ? "#FFFFFF" : "#9CA3AF",
            cursor: agreed && !processing ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {processing ? (
            <>
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  border: "2px solid #9CA3AF",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Processing...
            </>
          ) : (
            <>{"\u{1F512}"} Confirm & Send {formatUSD(transfer.totalDebit)}</>
          )}
        </button>
        <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "#9CA3AF", textAlign: "center" }}>
          Secured by TandaXn • Your money is protected
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
