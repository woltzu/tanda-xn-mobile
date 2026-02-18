"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, ArrowDown, RefreshCw, Clock, AlertCircle, TrendingUp, Shield } from "lucide-react"

export default function ConversionReviewScreen() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [timeLeft, setTimeLeft] = useState(120)

  const conversion = {
    fromCurrency: {
      code: "USD",
      name: "US Dollar",
      flag: "🇺🇸",
      symbol: "$",
      amount: 200.0,
      balance: 2450.0,
    },
    toCurrency: {
      code: "XOF",
      name: "CFA Franc",
      flag: "🇸🇳",
      symbol: "CFA",
      amount: 122000,
    },
    exchangeRate: 610.0,
    marketRate: 608.5,
    fee: 0,
    feePercent: 0,
    newBalanceFrom: 2250.0,
    newBalanceTo: 607000,
    rateLockSeconds: 120,
  }

  // Countdown timer for rate lock
  useEffect(() => {
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Calculate rate advantage
  const rateAdvantage = (((conversion.exchangeRate - conversion.marketRate) / conversion.marketRate) * 100).toFixed(2)
  const isGoodRate = Number.parseFloat(rateAdvantage) >= 0

  const handleConfirm = () => {
    setIsProcessing(true)
    setTimeout(() => {
      console.log("Conversion confirmed")
    }, 1500)
  }

  const handleRefreshRate = () => {
    setTimeLeft(120)
    console.log("Rate refreshed")
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Review Conversion</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Conversion Visual */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* From Currency */}
          <div
            style={{
              background: "#F5F7FA",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "32px" }}>{conversion.fromCurrency.flag}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px 0", fontSize: "12px", color: "#6B7280" }}>You Convert</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
                  {conversion.fromCurrency.symbol}
                  {conversion.fromCurrency.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{conversion.fromCurrency.code}</p>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              margin: "12px 0",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowDown size={20} color="#FFFFFF" />
            </div>
          </div>

          {/* To Currency */}
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "12px",
              padding: "16px",
              border: "1px solid #00C6AE",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "32px" }}>{conversion.toCurrency.flag}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px 0", fontSize: "12px", color: "#00897B" }}>You Receive</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
                  {conversion.toCurrency.symbol} {conversion.toCurrency.amount.toLocaleString()}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#00897B" }}>{conversion.toCurrency.code}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Exchange Rate Card */}
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
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Exchange Rate</h3>
            <button
              onClick={handleRefreshRate}
              disabled={timeLeft <= 0}
              style={{
                background: timeLeft <= 0 ? "#00C6AE" : "#F5F7FA",
                border: "none",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <RefreshCw size={14} color={timeLeft <= 0 ? "#FFFFFF" : "#6B7280"} />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "500",
                  color: timeLeft <= 0 ? "#FFFFFF" : "#6B7280",
                }}
              >
                Refresh
              </span>
            </button>
          </div>

          {/* Rate Display */}
          <div
            style={{
              background: "#F5F7FA",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>Current Rate</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              1 {conversion.fromCurrency.code} = {conversion.exchangeRate.toLocaleString()} {conversion.toCurrency.code}
            </p>
          </div>

          {/* Rate Lock Timer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px",
              background: timeLeft > 30 ? "#F0FDFB" : "#FEF3C7",
              borderRadius: "8px",
            }}
          >
            <Clock size={16} color={timeLeft > 30 ? "#00897B" : "#D97706"} />
            <span
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: timeLeft > 30 ? "#065F46" : "#92400E",
              }}
            >
              {timeLeft > 0 ? `Rate locked for ${formatTime(timeLeft)}` : "Rate expired - tap refresh"}
            </span>
          </div>

          {/* Market Comparison */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "12px",
              padding: "10px",
              background: "#F5F7FA",
              borderRadius: "8px",
            }}
          >
            <TrendingUp size={16} color={isGoodRate ? "#00C6AE" : "#DC2626"} />
            <span style={{ fontSize: "12px", color: "#6B7280" }}>
              Market rate: {conversion.marketRate.toLocaleString()} {conversion.toCurrency.code}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: isGoodRate ? "#00C6AE" : "#DC2626",
                marginLeft: "auto",
              }}
            >
              {isGoodRate ? "+" : ""}
              {rateAdvantage}%
            </span>
          </div>
        </div>

        {/* Fee Breakdown */}
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
            Conversion Details
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Amount to Convert</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                {conversion.fromCurrency.symbol}
                {conversion.fromCurrency.amount.toFixed(2)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Conversion Fee</span>
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

            <div style={{ height: "1px", background: "#E5E7EB" }} />

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>You'll Receive</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                {conversion.toCurrency.symbol} {conversion.toCurrency.amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* New Balances Preview */}
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
            After Conversion
          </h3>

          <div style={{ display: "flex", gap: "12px" }}>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                {conversion.fromCurrency.code} Balance
              </p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#FFFFFF" }}>
                {conversion.fromCurrency.symbol}
                {conversion.newBalanceFrom.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(0,198,174,0.2)",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "rgba(0,198,174,0.8)" }}>
                {conversion.toCurrency.code} Balance
              </p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                {conversion.toCurrency.symbol} {conversion.newBalanceTo.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Security Note */}
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
          <Shield size={18} color="#00897B" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Instant Conversion:</strong> Your funds will be converted immediately at the locked rate. This
            action cannot be undone.
          </p>
        </div>
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
        {timeLeft <= 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
              padding: "10px",
              background: "#FEE2E2",
              borderRadius: "8px",
            }}
          >
            <AlertCircle size={16} color="#DC2626" />
            <span style={{ fontSize: "12px", color: "#991B1B" }}>Rate expired. Please refresh to get a new rate.</span>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={isProcessing || timeLeft <= 0}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: !isProcessing && timeLeft > 0 ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: !isProcessing && timeLeft > 0 ? "#FFFFFF" : "#9CA3AF",
            cursor: !isProcessing && timeLeft > 0 ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isProcessing ? (
            "Converting..."
          ) : (
            <>
              <RefreshCw size={18} />
              Confirm Conversion
            </>
          )}
        </button>
      </div>
    </div>
  )
}
