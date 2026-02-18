"use client"
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Download,
  Copy,
  HelpCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  Share2,
} from "lucide-react"
import { useState } from "react"

export default function TransactionDetailsScreen() {
  const [copied, setCopied] = useState<string | null>(null)

  const transaction = {
    id: "TXN-2025-0108-78542",
    type: "sent",
    status: "completed",
    amount: 150000,
    currency: "XOF",
    amountUSD: 245.9,
    fee: 2.5,
    feeWaived: false,
    recipient: {
      name: "Mama Diallo",
      phone: "+221 77 XXX XX42",
      location: "Dakar, Senegal",
      flag: "🇸🇳",
    },
    paymentMethod: "Wallet Balance",
    deliveryMethod: "Wave Mobile Money",
    exchangeRate: "1 USD = 610.50 XOF",
    date: "January 8, 2025",
    time: "3:45 PM EST",
    completedAt: "January 8, 2025, 3:47 PM EST",
    reference: "REF-WAVE-2025010878542",
    note: "Monthly support",
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return {
          icon: CheckCircle,
          color: "#00C6AE",
          bg: "#F0FDFB",
          text: "Completed",
          desc: "Transaction successful",
        }
      case "pending":
        return {
          icon: Clock,
          color: "#D97706",
          bg: "#FEF3C7",
          text: "Pending",
          desc: "Processing in progress",
        }
      case "failed":
        return {
          icon: AlertCircle,
          color: "#DC2626",
          bg: "#FEE2E2",
          text: "Failed",
          desc: "Transaction failed",
        }
      default:
        return {
          icon: Clock,
          color: "#6B7280",
          bg: "#F5F7FA",
          text: status,
          desc: "",
        }
    }
  }

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "sent":
        return { icon: ArrowUpRight, color: "#DC2626", label: "Sent", prefix: "-" }
      case "received":
        return { icon: ArrowDownLeft, color: "#00C6AE", label: "Received", prefix: "+" }
      case "converted":
        return { icon: RefreshCw, color: "#1565C0", label: "Converted", prefix: "" }
      case "deposit":
        return { icon: ArrowDownLeft, color: "#00C6AE", label: "Deposit", prefix: "+" }
      case "withdrawal":
        return { icon: ArrowUpRight, color: "#0A2342", label: "Withdrawal", prefix: "-" }
      default:
        return { icon: RefreshCw, color: "#6B7280", label: type, prefix: "" }
    }
  }

  const statusConfig = getStatusConfig(transaction.status)
  const typeConfig = getTypeConfig(transaction.type)
  const StatusIcon = statusConfig.icon
  const TypeIcon = typeConfig.icon

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "XOF" || currency === "NGN" || currency === "KES") {
      return `${currency} ${amount.toLocaleString()}`
    }
    return `$${amount.toFixed(2)}`
  }

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transaction Details</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
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
          {/* Type Icon */}
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background:
                typeConfig.color === "#DC2626" ? "#FEE2E2" : typeConfig.color === "#00C6AE" ? "#F0FDFB" : "#E3F2FD",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <TypeIcon size={32} color={typeConfig.color} />
          </div>

          {/* Amount */}
          <p
            style={{
              margin: "0 0 4px 0",
              fontSize: "12px",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {typeConfig.label}
          </p>
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: "36px",
              fontWeight: "700",
              color: typeConfig.color,
            }}
          >
            {typeConfig.prefix}
            {formatCurrency(transaction.amount, transaction.currency)}
          </p>
          {transaction.amountUSD && transaction.currency !== "USD" && (
            <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>≈ ${transaction.amountUSD.toFixed(2)} USD</p>
          )}

          {/* Status Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: statusConfig.bg,
              padding: "8px 16px",
              borderRadius: "20px",
              marginTop: "16px",
            }}
          >
            <StatusIcon size={16} color={statusConfig.color} />
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: statusConfig.color,
              }}
            >
              {statusConfig.text}
            </span>
          </div>
        </div>

        {/* Recipient Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "13px",
              fontWeight: "600",
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Recipient
          </h3>
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
                fontSize: "24px",
              }}
            >
              {transaction.recipient.flag}
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
                {transaction.recipient.name}
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{transaction.recipient.location}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#9CA3AF" }}>{transaction.recipient.phone}</p>
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
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
            }}
          >
            Details
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Date */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Date & Time</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                {transaction.date}, {transaction.time}
              </span>
            </div>

            {/* Exchange Rate */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Exchange Rate</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{transaction.exchangeRate}</span>
            </div>

            {/* Fee */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Fee</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: transaction.feeWaived ? "#00C6AE" : "#0A2342",
                }}
              >
                {transaction.feeWaived ? "Waived" : `$${transaction.fee.toFixed(2)}`}
              </span>
            </div>

            {/* Payment Method */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Paid From</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{transaction.paymentMethod}</span>
            </div>

            {/* Delivery Method */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Delivered Via</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                {transaction.deliveryMethod}
              </span>
            </div>

            {/* Completed At */}
            {transaction.status === "completed" && transaction.completedAt && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Completed</span>
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#00C6AE" }}>{transaction.completedAt}</span>
              </div>
            )}

            {/* Note */}
            <>
              <div style={{ height: "1px", background: "#E5E7EB" }} />
              <div>
                <span style={{ fontSize: "13px", color: "#6B7280", display: "block", marginBottom: "4px" }}>Note</span>
                <span style={{ fontSize: "14px", color: "#0A2342" }}>"{transaction.note}"</span>
              </div>
            </>
          </div>
        </div>

        {/* Reference Numbers */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
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
            Reference
          </h3>

          {/* Transaction ID */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div>
              <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#6B7280" }}>Transaction ID</p>
              <p
                style={{
                  margin: 0,
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
              onClick={() => handleCopy(transaction.id)}
              style={{
                background: copied === transaction.id ? "#F0FDFB" : "#F5F7FA",
                border: "none",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <Copy size={16} color={copied === transaction.id ? "#00C6AE" : "#6B7280"} />
            </button>
          </div>

          {/* Provider Reference */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#6B7280" }}>Provider Reference</p>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#0A2342",
                  fontFamily: "monospace",
                }}
              >
                {transaction.reference}
              </p>
            </div>
            <button
              onClick={() => handleCopy(transaction.reference)}
              style={{
                background: copied === transaction.reference ? "#F0FDFB" : "#F5F7FA",
                border: "none",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <Copy size={16} color={copied === transaction.reference ? "#00C6AE" : "#6B7280"} />
            </button>
          </div>
        </div>

        {/* Help Link */}
        <button
          onClick={() => console.log("Get help")}
          style={{
            width: "100%",
            padding: "14px",
            background: "#F5F7FA",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <HelpCircle size={18} color="#6B7280" />
          <span style={{ fontSize: "14px", fontWeight: "500", color: "#6B7280" }}>
            Need help with this transaction?
          </span>
        </button>
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
          onClick={() => console.log("Download receipt")}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Download size={18} />
          Receipt
        </button>
        <button
          onClick={() => console.log("Share")}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Share2 size={18} />
          Share
        </button>
        <button
          onClick={() => console.log("Send again")}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "#00C6AE",
            fontSize: "14px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          Send Again
        </button>
      </div>
    </div>
  )
}
