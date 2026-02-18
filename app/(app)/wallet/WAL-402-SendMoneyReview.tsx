"use client"

import { useState } from "react"
import { ArrowLeft, Edit2, AlertCircle, Clock, Shield } from "lucide-react"

export default function SendMoneyReviewScreen() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const transfer = {
    recipient: {
      name: "Mama Diallo",
      phone: "+221 77 123 4567",
      location: "Dakar, Senegal",
      flag: "🇸🇳",
      deliveryMethod: "Wave Mobile Money",
      deliveryAccount: "••••4567",
    },
    amountSend: 200.0,
    currencySend: "USD",
    amountReceive: 122000,
    currencyReceive: "XOF",
    exchangeRate: 610.0,
    fee: 0,
    feeWaived: true,
    totalDebit: 200.0,
    payFrom: "Wallet Balance ($2,450.00)",
    estimatedDelivery: "Within minutes",
    note: "Monthly support",
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "XOF" || currency === "NGN" || currency === "KES") {
      return `${currency} ${amount.toLocaleString()}`
    }
    return `$${amount.toFixed(2)} ${currency}`
  }

  const handleConfirm = () => {
    setIsProcessing(true)
    setTimeout(() => {
      console.log("Transfer confirmed")
    }, 1500)
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Review Transfer</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Recipient Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
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
              marginBottom: "12px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: "600",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Sending To
            </h3>
            <button
              onClick={() => console.log("Edit recipient")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              <Edit2 size={14} />
              Edit
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
              }}
            >
              {transfer.recipient.flag}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 2px 0", fontSize: "17px", fontWeight: "600", color: "#0A2342" }}>
                {transfer.recipient.name}
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{transfer.recipient.location}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                {transfer.recipient.deliveryMethod} • {transfer.recipient.deliveryAccount}
              </p>
            </div>
          </div>
        </div>

        {/* Amount Breakdown */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
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
              marginBottom: "16px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: "600",
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Amount
            </h3>
            <button
              onClick={() => console.log("Edit amount")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              <Edit2 size={14} />
              Edit
            </button>
          </div>

          {/* You Send */}
          <div
            style={{
              background: "#F5F7FA",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "12px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>You Send</p>
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#0A2342" }}>
              {formatCurrency(transfer.amountSend, transfer.currencySend)}
            </p>
          </div>

          {/* Exchange Rate */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px 0",
              marginBottom: "12px",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
            <span
              style={{
                fontSize: "12px",
                color: "#6B7280",
                background: "#FFFFFF",
                padding: "0 12px",
              }}
            >
              1 {transfer.currencySend} = {transfer.exchangeRate.toLocaleString()} {transfer.currencyReceive}
            </span>
            <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
          </div>

          {/* They Receive */}
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid #00C6AE",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#00897B" }}>
              {transfer.recipient.name} Receives
            </p>
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
              {formatCurrency(transfer.amountReceive, transfer.currencyReceive)}
            </p>
          </div>
        </div>

        {/* Fee & Payment Details */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Payment Details
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Amount */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", color: "#6B7280" }}>Amount</span>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                ${transfer.amountSend.toFixed(2)}
              </span>
            </div>

            {/* Fee */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", color: "#6B7280" }}>Transfer Fee</span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: transfer.feeWaived ? "#00C6AE" : "#0A2342",
                }}
              >
                {transfer.feeWaived ? "Free ✨" : `$${transfer.fee.toFixed(2)}`}
              </span>
            </div>

            <div style={{ height: "1px", background: "#E5E7EB" }} />

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Total Debit</span>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${transfer.totalDebit.toFixed(2)}
              </span>
            </div>

            <div style={{ height: "1px", background: "#E5E7EB" }} />

            {/* Pay From */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", color: "#6B7280" }}>Pay From</span>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{transfer.payFrom}</span>
            </div>

            {/* Delivery */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", color: "#6B7280" }}>Delivery</span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Clock size={14} />
                {transfer.estimatedDelivery}
              </span>
            </div>
          </div>
        </div>

        {/* Note */}
        {transfer.note && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>
              Note to Recipient
            </h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#0A2342" }}>"{transfer.note}"</p>
          </div>
        )}

        {/* Security Notice */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <Shield size={18} color="#00897B" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Secure Transfer:</strong> This transfer is protected by bank-level encryption. Funds will be
            delivered via {transfer.recipient.deliveryMethod}.
          </p>
        </div>

        {/* Terms Checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{
              width: "20px",
              height: "20px",
              marginTop: "2px",
              accentColor: "#00C6AE",
            }}
          />
          <span style={{ fontSize: "13px", color: "#6B7280", lineHeight: 1.5 }}>
            I confirm the details are correct and agree to the{" "}
            <span style={{ color: "#00C6AE", fontWeight: "500" }}>Transfer Terms</span>
          </span>
        </label>
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
        {/* Rate Lock Warning */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
            padding: "10px",
            background: "#FEF3C7",
            borderRadius: "8px",
          }}
        >
          <AlertCircle size={16} color="#D97706" />
          <span style={{ fontSize: "12px", color: "#92400E" }}>Exchange rate locked for 2 minutes</span>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!agreedToTerms || isProcessing}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: agreedToTerms && !isProcessing ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: agreedToTerms && !isProcessing ? "#FFFFFF" : "#9CA3AF",
            cursor: agreedToTerms && !isProcessing ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isProcessing ? (
            "Processing..."
          ) : (
            <>
              <Shield size={18} />
              Confirm & Send ${transfer.totalDebit.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
