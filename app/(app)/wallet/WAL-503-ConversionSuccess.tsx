"use client"

import { CheckCircle, RefreshCw, Copy, ArrowRight } from "lucide-react"
import { useState } from "react"

export default function ConversionSuccessScreen() {
  const [copied, setCopied] = useState(false)

  const conversion = {
    id: "CVT-2025-0108-34521",
    fromCurrency: {
      code: "USD",
      name: "US Dollar",
      flag: "🇺🇸",
      symbol: "$",
      amount: 200.0,
    },
    toCurrency: {
      code: "XOF",
      name: "CFA Franc",
      flag: "🇸🇳",
      symbol: "CFA",
      amount: 122000,
    },
    exchangeRate: 610.0,
    fee: 0,
    timestamp: "January 8, 2025 at 3:52 PM EST",
    balances: {
      USD: 2250.0,
      XOF: 607000,
    },
  }

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatCurrency = (amount: number, code: string, symbol: string) => {
    if (code === "XOF" || code === "NGN" || code === "KES") {
      return `${symbol} ${amount.toLocaleString()}`
    }
    return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
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
            }}
          >
            <RefreshCw size={36} color="#FFFFFF" />
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Conversion Complete! ✨</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>
          Successfully converted {conversion.fromCurrency.code} to {conversion.toCurrency.code}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Conversion Summary Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* From → To Visual */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "20px",
              borderBottom: "1px solid #E5E7EB",
              marginBottom: "16px",
            }}
          >
            {/* From */}
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "36px", display: "block", marginBottom: "8px" }}>
                {conversion.fromCurrency.flag}
              </span>
              <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#6B7280" }}>Converted</p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                -
                {formatCurrency(
                  conversion.fromCurrency.amount,
                  conversion.fromCurrency.code,
                  conversion.fromCurrency.symbol,
                )}
              </p>
            </div>

            {/* Arrow */}
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowRight size={20} color="#0A2342" />
            </div>

            {/* To */}
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "36px", display: "block", marginBottom: "8px" }}>
                {conversion.toCurrency.flag}
              </span>
              <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#00897B" }}>Received</p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                +
                {formatCurrency(conversion.toCurrency.amount, conversion.toCurrency.code, conversion.toCurrency.symbol)}
              </p>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Exchange Rate</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                1 {conversion.fromCurrency.code} = {conversion.exchangeRate.toLocaleString()}{" "}
                {conversion.toCurrency.code}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Fee</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: conversion.fee === 0 ? "#00C6AE" : "#0A2342",
                }}
              >
                {conversion.fee === 0 ? "Free ✨" : `$${conversion.fee.toFixed(2)}`}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Date & Time</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{conversion.timestamp}</span>
            </div>
          </div>
        </div>

        {/* New Balances */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "13px",
              fontWeight: "600",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Updated Balances
          </h3>

          <div style={{ display: "flex", gap: "12px" }}>
            {/* USD Balance */}
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "14px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>
                {conversion.fromCurrency.flag}
              </span>
              <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                {conversion.fromCurrency.code}
              </p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#FFFFFF" }}>
                {formatCurrency(conversion.balances.USD, "USD", "$")}
              </p>
            </div>

            {/* XOF Balance */}
            <div
              style={{
                flex: 1,
                background: "rgba(0,198,174,0.2)",
                borderRadius: "10px",
                padding: "14px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>
                {conversion.toCurrency.flag}
              </span>
              <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "rgba(0,198,174,0.8)" }}>
                {conversion.toCurrency.code}
              </p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                {formatCurrency(conversion.balances.XOF, "XOF", "CFA")}
              </p>
            </div>
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
                {conversion.id}
              </p>
            </div>
            <button
              onClick={() => handleCopy(conversion.id)}
              style={{
                background: "#F5F7FA",
                border: "none",
                borderRadius: "8px",
                padding: "10px",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <Copy size={18} color="#6B7280" />
            </button>
          </div>
        </div>

        {/* Info Card */}
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
          <CheckCircle size={18} color="#00897B" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Conversion recorded.</strong> Your updated balances are now available in your wallet. You can send{" "}
            {conversion.toCurrency.code} to contacts in supported regions.
          </p>
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
          onClick={() => console.log("Convert Again")}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <RefreshCw size={18} />
          Convert More
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
