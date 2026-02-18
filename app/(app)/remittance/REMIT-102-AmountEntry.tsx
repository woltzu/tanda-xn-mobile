"use client"

import { useState, useMemo } from "react"
import {
  SUPPORTED_COUNTRIES,
  DELIVERY_OPTIONS,
  calculateFees,
  formatCurrency,
  formatUSD,
  getExchangeRate,
  type Country,
  type DeliveryOption,
} from "../../../lib/transferConfig"

export default function AmountEntryScreen() {
  // ── State ────────────────────────────────────────────
  const [amount, setAmount] = useState("")
  const [sendCurrency] = useState("USD")
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>(DELIVERY_OPTIONS[0])

  // Recipient (would come from navigation params in real app)
  const [selectedCountry] = useState<Country>(
    SUPPORTED_COUNTRIES.find((c) => c.code === "CM")!
  )

  const recipient = {
    name: "Mama",
    country: selectedCountry.name,
    flag: selectedCountry.flag,
    currency: selectedCountry.currency,
    currencyName: selectedCountry.currencyName,
  }

  // ── Derived values ───────────────────────────────────
  const exchangeRate = getExchangeRate("USD", selectedCountry.currency)
  const userBalance = 2450.0 // TODO: from WalletContext
  const numericAmount = parseFloat(amount) || 0

  const fees = useMemo(() => {
    return calculateFees(numericAmount, deliveryOption, exchangeRate, selectedCountry.decimals)
  }, [numericAmount, deliveryOption, exchangeRate, selectedCountry.decimals])

  const hasEnoughBalance = fees.totalToPay <= userBalance
  const quickAmounts = [50, 100, 200, 500]

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
          background: "#0A2342",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <button
            onClick={() => console.log("Back")}
            aria-label="Go back"
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Enter Amount</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Sending to {recipient.name}</p>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            {recipient.flag}
          </div>
        </div>

        {/* Exchange Rate Banner */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "10px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "14px" }}>{"\u{1F4B1}"}</span>
            <span style={{ fontSize: "12px" }}>
              1 USD = {formatCurrency(exchangeRate, selectedCountry.currency)} {recipient.currency}
            </span>
          </div>
          <span
            style={{
              padding: "2px 8px",
              background: "#00C6AE",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: "600",
            }}
          >
            LIVE RATE
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount Input Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#6B7280", marginBottom: "8px" }}
          >
            You Send
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                padding: "10px 14px",
                background: "#F5F7FA",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "18px" }}>{"\u{1F1FA}\u{1F1F8}"}</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>USD</span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              style={{
                flex: 1,
                fontSize: "32px",
                fontWeight: "700",
                color: "#0A2342",
                border: "none",
                outline: "none",
                textAlign: "right",
                background: "transparent",
              }}
            />
          </div>

          {/* Quick Amounts */}
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                onClick={() => setAmount(qa.toString())}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: numericAmount === qa ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: numericAmount === qa ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: numericAmount === qa ? "#00897B" : "#6B7280",
                  cursor: "pointer",
                }}
              >
                ${qa}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient Receives */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "#6B7280", marginBottom: "8px" }}
          >
            {recipient.name} Receives
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                padding: "10px 14px",
                background: "#F5F7FA",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "18px" }}>{recipient.flag}</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{recipient.currency}</span>
            </div>
            <p
              style={{
                flex: 1,
                margin: 0,
                fontSize: "28px",
                fontWeight: "700",
                color: "#00C6AE",
                textAlign: "right",
              }}
            >
              {fees.receiveAmount > 0
                ? formatCurrency(fees.receiveAmount, selectedCountry.currency, selectedCountry.decimals)
                : "0"}
            </p>
          </div>
        </div>

        {/* Delivery Speed */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#6B7280", marginBottom: "8px" }}>
            DELIVERY SPEED
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {DELIVERY_OPTIONS.map((opt) => {
              const isActive = opt.id === deliveryOption.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setDeliveryOption(opt)}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    borderRadius: "12px",
                    border: isActive ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: isActive ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: "absolute", top: "6px", right: "6px",
                      width: "16px", height: "16px", borderRadius: "50%", background: "#00C6AE",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: isActive ? "#00897B" : "#0A2342" }}>
                    {opt.label}
                  </p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>{opt.daysLabel}</p>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: isActive ? "#00897B" : "#0A2342" }}>
                    {formatUSD(opt.flatFee)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Fee Breakdown */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            Transfer Details
          </h4>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Transfer amount</span>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{formatUSD(numericAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Transfer fee ({deliveryOption.label})</span>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{formatUSD(fees.totalFee)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Exchange rate</span>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
              1 USD = {formatCurrency(exchangeRate, selectedCountry.currency)} {recipient.currency}
            </span>
          </div>

          <div style={{ height: "1px", background: "#E5E7EB", margin: "12px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total to pay</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#0A2342" }}>{formatUSD(fees.totalToPay)}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px",
              background: "#F0FDFB",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#00897B" }}>They receive</span>
            <span style={{ fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
              {formatCurrency(fees.receiveAmount, selectedCountry.currency, selectedCountry.decimals)} {recipient.currency}
            </span>
          </div>
        </div>

        {/* Balance Warning */}
        {numericAmount > 0 && !hasEnoughBalance && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: "#FEF3C7",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>{"\u26A0\uFE0F"}</span>
            <span style={{ fontSize: "12px", color: "#92400E" }}>
              Insufficient balance. You have {formatUSD(userBalance)} available. Total needed: {formatUSD(fees.totalToPay)}.
            </span>
          </div>
        )}

        {/* Savings Comparison */}
        {numericAmount >= 20 && hasEnoughBalance && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: "#F0FDFB",
              borderRadius: "10px",
            }}
          >
            <p style={{ margin: 0, fontSize: "12px", color: "#065F46" }}>
              {"\u{1F4B0}"} You save <strong>{formatUSD(numericAmount * 0.05)}</strong> compared to Western Union
            </p>
          </div>
        )}
      </div>

      {/* Continue Button */}
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
          onClick={() =>
            console.log("Continue with", {
              amount: numericAmount,
              fee: fees.totalFee,
              total: fees.totalToPay,
              receives: fees.receiveAmount,
              delivery: deliveryOption.id,
            })
          }
          disabled={numericAmount <= 0 || !hasEnoughBalance}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: numericAmount > 0 && hasEnoughBalance ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: numericAmount > 0 && hasEnoughBalance ? "#FFFFFF" : "#9CA3AF",
            cursor: numericAmount > 0 && hasEnoughBalance ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
