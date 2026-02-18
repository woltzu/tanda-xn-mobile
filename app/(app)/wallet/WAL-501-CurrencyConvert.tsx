"use client"

import { useState } from "react"
import { ArrowLeft, ArrowDown, RefreshCw, TrendingUp } from "lucide-react"

export default function CurrencyConvertScreen() {
  const [fromCurrency, setFromCurrency] = useState("USD")
  const [toCurrency, setToCurrency] = useState("XOF")
  const [amount, setAmount] = useState("")

  const currencies = [
    { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$", balance: 2450.0 },
    { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€", balance: 850.0 },
    { code: "GBP", name: "British Pound", flag: "🇬🇧", symbol: "£", balance: 320.0 },
    { code: "XOF", name: "CFA Franc", flag: "🇸🇳", symbol: "CFA", balance: 485000 },
    { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", symbol: "₦", balance: 0 },
    { code: "GHS", name: "Ghanaian Cedi", flag: "🇬🇭", symbol: "₵", balance: 0 },
    { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪", symbol: "KSh", balance: 0 },
  ]

  const exchangeRates: Record<string, Record<string, number>> = {
    USD: { EUR: 0.92, GBP: 0.79, XOF: 610, NGN: 1550, GHS: 12.8, KES: 129 },
    EUR: { USD: 1.09, GBP: 0.86, XOF: 656, NGN: 1680, GHS: 13.9, KES: 140 },
    GBP: { USD: 1.27, EUR: 1.16, XOF: 772, NGN: 1960, GHS: 16.2, KES: 164 },
    XOF: { USD: 0.00164, EUR: 0.00152, GBP: 0.0013, NGN: 2.54, GHS: 0.021, KES: 0.21 },
  }

  const fromData = currencies.find((c) => c.code === fromCurrency)
  const toData = currencies.find((c) => c.code === toCurrency)

  const rate = exchangeRates[fromCurrency]?.[toCurrency] || 1
  const parsedAmount = Number.parseFloat(amount) || 0
  const convertedAmount = parsedAmount * rate

  const canConvert = parsedAmount > 0 && parsedAmount <= (fromData?.balance || 0) && fromCurrency !== toCurrency

  const formatBalance = (amt: number, code: string) => {
    if (code === "XOF" || code === "NGN" || code === "KES") {
      return `${code} ${amt.toLocaleString()}`
    }
    return `$${amt.toFixed(2)}`
  }

  const swapCurrencies = () => {
    const temp = fromCurrency
    setFromCurrency(toCurrency)
    setToCurrency(temp)
    setAmount("")
  }

  // Quick amounts based on from currency
  const quickAmounts =
    fromCurrency === "USD" ? [50, 100, 200, 500] : fromCurrency === "XOF" ? [50000, 100000, 200000] : [50, 100, 200]

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Convert Currency</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* From Currency */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "8px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>From</span>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>
              Balance: {formatBalance(fromData?.balance || 0, fromCurrency)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              style={{
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "16px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              {currencies
                .filter((c) => c.balance > 0)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "24px",
                fontWeight: "700",
                color: "#0A2342",
                textAlign: "right",
                outline: "none",
              }}
            />
          </div>

          {/* Quick Amounts */}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                disabled={amt > (fromData?.balance || 0)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  background: amount === amt.toString() ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: amt <= (fromData?.balance || 0) ? "pointer" : "not-allowed",
                  opacity: amt <= (fromData?.balance || 0) ? 1 : 0.5,
                }}
              >
                {fromCurrency === "XOF" ? amt.toLocaleString() : amt}
              </button>
            ))}
          </div>
        </div>

        {/* Swap Button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "-4px 0" }}>
          <button
            onClick={swapCurrencies}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#0A2342",
              border: "4px solid #F5F7FA",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            <ArrowDown size={20} color="#FFFFFF" />
          </button>
        </div>

        {/* To Currency */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginTop: "-4px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>To</span>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>
              Balance: {formatBalance(toData?.balance || 0, toCurrency)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              style={{
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "16px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              {currencies
                .filter((c) => c.code !== fromCurrency)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
            </select>
            <div
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                background: "#F0FDFB",
                border: "1px solid #00C6AE",
                textAlign: "right",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#00C6AE",
                }}
              >
                {toCurrency === "XOF" || toCurrency === "NGN" || toCurrency === "KES"
                  ? convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : convertedAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Exchange Rate */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <RefreshCw size={18} color="#6B7280" />
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                1 {fromCurrency} = {rate.toLocaleString()} {toCurrency}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Updated just now</p>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              background: "#F0FDFB",
              borderRadius: "12px",
            }}
          >
            <TrendingUp size={14} color="#00C6AE" />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>+0.5%</span>
          </div>
        </div>

        {/* Info */}
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
          <RefreshCw size={18} color="#00897B" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>No fees on conversions!</strong> Convert between your wallet currencies instantly at competitive
            rates. Rate is locked for 2 minutes after you continue.
          </p>
        </div>
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
          onClick={() => console.log("Continue")}
          disabled={!canConvert}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canConvert ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canConvert ? "#FFFFFF" : "#9CA3AF",
            cursor: canConvert ? "pointer" : "not-allowed",
          }}
        >
          {parsedAmount > (fromData?.balance || 0) ? "Insufficient Balance" : "Continue"}
        </button>
      </div>
    </div>
  )
}
