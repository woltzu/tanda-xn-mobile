"use client"

import { useState } from "react"

export default function WithdrawalFailedScreen() {
  const [errorType] = useState<"account" | "network" | "limit" | "insufficient" | "other">("account")

  const withdrawal = {
    id: "WD-2025-0110-12345",
    amount: 1000,
    account: "Chase Bank",
    last4: "4532",
    attemptedAt: "Jan 10, 2025 at 2:30 PM",
    errorCode: "INVALID_ACCOUNT",
    errorMessage: "The bank account could not be verified",
  }

  const getErrorInfo = () => {
    switch (errorType) {
      case "account":
        return {
          icon: "🏦",
          title: "Account Verification Failed",
          message:
            "We couldn't verify your bank account. This sometimes happens when account details don't match exactly.",
          suggestion: "Double-check your routing and account numbers, or try a different account.",
          canRetry: false,
          showChangeAccount: true,
        }
      case "network":
        return {
          icon: "📡",
          title: "Connection Issue",
          message: "We couldn't connect to the payment network. This is usually temporary.",
          suggestion: "Please wait a few minutes and try again.",
          canRetry: true,
          showChangeAccount: false,
        }
      case "limit":
        return {
          icon: "⚠️",
          title: "Withdrawal Limit Reached",
          message: "You've reached your daily or weekly withdrawal limit.",
          suggestion: "Try again tomorrow or contact support to request a limit increase.",
          canRetry: false,
          showChangeAccount: false,
        }
      case "insufficient":
        return {
          icon: "💰",
          title: "Insufficient Balance",
          message: "Your wallet balance changed while processing the withdrawal.",
          suggestion: "Check your balance and try a smaller amount.",
          canRetry: true,
          showChangeAccount: false,
        }
      default:
        return {
          icon: "❌",
          title: "Transfer Failed",
          message: "Something went wrong with your withdrawal.",
          suggestion: "Please try again or contact our support team for help.",
          canRetry: true,
          showChangeAccount: true,
        }
    }
  }

  const errorInfo = getErrorInfo()

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
      }}
    >
      {/* Error Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        {/* Error Icon */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
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
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
            }}
          >
            {errorInfo.icon}
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>{errorInfo.title}</h1>
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            opacity: 0.9,
            maxWidth: "280px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {errorInfo.message}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Failed Amount Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
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
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Amount</span>
            <span style={{ fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              ${withdrawal.amount.toLocaleString()}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{withdrawal.account}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>••••{withdrawal.last4}</p>
            </div>
          </div>

          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #F3F4F6" }}>
            <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Attempted: {withdrawal.attemptedAt}</p>
          </div>
        </div>

        {/* What to Do */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What you can do
          </h3>

          <div
            style={{
              background: "#FEF3C7",
              borderRadius: "12px",
              padding: "14px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D97706"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: "2px" }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", color: "#92400E", lineHeight: 1.5 }}>{errorInfo.suggestion}</p>
          </div>
        </div>

        {/* Error Details (Collapsible) */}
        <details
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <summary
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#6B7280",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Technical Details
          </summary>
          <div style={{ marginTop: "12px", padding: "12px", background: "#F5F7FA", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Error Code</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "#0A2342",
                  fontFamily: "monospace",
                }}
              >
                {withdrawal.errorCode}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Transaction ID</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "500",
                  color: "#0A2342",
                  fontFamily: "monospace",
                }}
              >
                {withdrawal.id}
              </span>
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Message</span>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#0A2342" }}>{withdrawal.errorMessage}</p>
            </div>
          </div>
        </details>

        {/* Your Money is Safe */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ flexShrink: 0, marginTop: "2px" }}
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>Your money is safe</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#059669", lineHeight: 1.5 }}>
              The ${withdrawal.amount.toLocaleString()} is still in your TandaXn wallet. No funds were transferred.
            </p>
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
        }}
      >
        {errorInfo.canRetry && (
          <button
            onClick={() => console.log("Retry withdrawal")}
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
              marginBottom: "10px",
            }}
          >
            Try Again
          </button>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          {errorInfo.showChangeAccount && (
            <button
              onClick={() => console.log("Change account")}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: "12px",
                border: errorInfo.canRetry ? "1px solid #E5E7EB" : "none",
                background: errorInfo.canRetry ? "#FFFFFF" : "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                color: errorInfo.canRetry ? "#0A2342" : "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Change Account
            </button>
          )}
          <button
            onClick={() => console.log("Contact support")}
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
            }}
          >
            Contact Support
          </button>
        </div>

        <button
          onClick={() => console.log("Back to wallet")}
          style={{
            width: "100%",
            marginTop: "10px",
            padding: "12px",
            background: "transparent",
            border: "none",
            fontSize: "14px",
            fontWeight: "600",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          Back to Wallet
        </button>
      </div>
    </div>
  )
}
