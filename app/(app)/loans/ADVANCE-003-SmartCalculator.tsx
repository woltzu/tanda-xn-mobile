"use client"

import { useState } from "react"

export default function SmartCalculatorScreen() {
  const user = {
    name: "Franck",
    xnScore: 75,
    smc: 200, // Sustainable Monthly Contribution
    countryRisk: 2, // percentage points
    tierBonus: 0.5, // percentage points reduction for good tier
  }

  const advanceType = "quick" // "contribution", "quick", "flex"

  const baseRates = {
    quick: 8,
    flex: 7,
    contribution: 0, // flat fee
  }

  const maxAdvancePercent = 80 // percent of payout

  const upcomingPayout = {
    amount: 500,
    date: "Feb 15, 2025",
    circleName: "Family Circle",
  }

  const [amount, setAmount] = useState(200)
  const [term, setTerm] = useState(advanceType === "quick" ? 2 : 3) // weeks or months

  const maxAdvance = Math.floor(upcomingPayout.amount * (maxAdvancePercent / 100))

  // Calculate dynamic rate
  const calculateRate = () => {
    if (advanceType === "contribution") return { rate: 0, fee: 5, type: "flat" }

    const base = baseRates[advanceType] || 8
    const countryAdjust = user.countryRisk
    const scoreAdjust = user.xnScore >= 80 ? -1 : user.xnScore >= 70 ? 0 : user.xnScore >= 60 ? 1 : 2
    const tierAdjust = -user.tierBonus

    const totalRate = Math.max(6, base + countryAdjust + scoreAdjust + tierAdjust)
    return { rate: totalRate, type: "percent" }
  }

  const rateInfo = calculateRate()

  // Calculate fee/interest
  const calculateFee = () => {
    if (rateInfo.type === "flat") return rateInfo.fee

    if (advanceType === "quick") {
      // Simple interest for short term
      const weeklyRate = rateInfo.rate / 100 / 52
      return amount * weeklyRate * term
    } else {
      // Monthly interest for flex
      const monthlyRate = rateInfo.rate / 100 / 12
      return amount * monthlyRate * term
    }
  }

  const advanceFee = calculateFee()
  const totalRepayment = amount + advanceFee
  const monthlyPayment = advanceType === "flex" ? totalRepayment / term : null

  // Affordability check
  const affordabilityPercent = monthlyPayment ? (monthlyPayment / user.smc) * 100 : null
  const isAffordable = !monthlyPayment || affordabilityPercent <= 30

  // Comparison with local lenders
  const localLenderRate = 15
  const localLenderFee = amount * (localLenderRate / 100) * (advanceType === "quick" ? term / 52 : term / 12)
  const savings = localLenderFee - advanceFee

  const termOptions =
    advanceType === "quick"
      ? [1, 2, 3, 4] // weeks
      : [3, 6, 9, 12] // months

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>
              {advanceType === "contribution"
                ? "Contribution Cover"
                : advanceType === "quick"
                  ? "Quick Advance"
                  : "Flex Advance"}
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Calculate your advance</p>
          </div>
        </div>

        {/* Your Rate Badge */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>Your XnScore {user.xnScore} →</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                {rateInfo.type === "flat" ? `$${rateInfo.fee} flat fee` : `${rateInfo.rate.toFixed(1)}% rate`}
              </p>
            </div>
          </div>
          <button
            onClick={() => console.log("Why this rate?")}
            style={{
              padding: "8px 12px",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "8px",
              fontSize: "11px",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Why this rate?
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Advance Against */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Advancing against</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                {upcomingPayout.circleName}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Payout: {upcomingPayout.date}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                ${upcomingPayout.amount}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Max: ${maxAdvance}</p>
            </div>
          </div>
        </div>

        {/* Amount Slider */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            How much do you need?
          </label>

          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "42px", fontWeight: "700", color: "#0A2342" }}>${amount}</p>
          </div>

          <input
            type="range"
            min={50}
            max={maxAdvance}
            step={10}
            value={amount}
            onChange={(e) => setAmount(Number.parseInt(e.target.value))}
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "4px",
              background: `linear-gradient(to right, #00C6AE 0%, #00C6AE ${((amount - 50) / (maxAdvance - 50)) * 100}%, #E5E7EB ${((amount - 50) / (maxAdvance - 50)) * 100}%, #E5E7EB 100%)`,
              appearance: "none",
              cursor: "pointer",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>$50</span>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>${maxAdvance} (80% max)</span>
          </div>

          {/* Quick Amount Buttons */}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {[100, 200, 300, maxAdvance]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "8px",
                    border: amount === amt ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: amount === amt ? "#F0FDFB" : "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#0A2342",
                    cursor: "pointer",
                  }}
                >
                  ${amt}
                </button>
              ))}
          </div>
        </div>

        {/* Term Selection (for non-contribution) */}
        {advanceType !== "contribution" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <label
              style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
            >
              Repayment Term
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              {termOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => setTerm(t)}
                  style={{
                    flex: 1,
                    padding: "14px 8px",
                    borderRadius: "10px",
                    border: term === t ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: term === t ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>{t}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                    {advanceType === "quick" ? "weeks" : "months"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cost Summary - Live Updates */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
            Your Advance Summary
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Advance amount</span>
              <span style={{ fontSize: "16px", fontWeight: "600", color: "#FFFFFF" }}>${amount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                Advance fee {rateInfo.type !== "flat" && `(${rateInfo.rate}%)`}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>+${advanceFee.toFixed(2)}</span>
            </div>
            <div style={{ height: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
                {advanceType === "contribution" ? "Auto-withheld from payout" : "Total to repay"}
              </span>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                ${totalRepayment.toFixed(2)}
              </span>
            </div>

            {monthlyPayment && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Monthly payment</span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#FFFFFF" }}>
                  ${monthlyPayment.toFixed(2)}/mo
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Affordability Check */}
        {monthlyPayment && (
          <div
            style={{
              background: isAffordable ? "#F0FDFB" : "#FEF3C7",
              borderRadius: "14px",
              padding: "14px",
              marginBottom: "16px",
              border: `1px solid ${isAffordable ? "#00C6AE" : "#D97706"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {isAffordable ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              )}
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    fontWeight: "600",
                    color: isAffordable ? "#065F46" : "#92400E",
                  }}
                >
                  {isAffordable ? "Affordable ✓" : "High payment warning"}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: isAffordable ? "#047857" : "#B45309" }}>
                  Monthly payment: ${monthlyPayment.toFixed(2)} ({affordabilityPercent.toFixed(0)}% of your ${user.smc}{" "}
                  SMC)
                  {!isAffordable && " — Consider a smaller amount or longer term"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparison with Local Lenders */}
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
            Compare & Save
          </h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>Local money lender</p>
              <p
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#6B7280",
                  textDecoration: "line-through",
                }}
              >
                {localLenderRate}%
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Fee: ${localLenderFee.toFixed(2)}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F0FDFB",
                borderRadius: "10px",
                textAlign: "center",
                border: "2px solid #00C6AE",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#00897B" }}>TandaXn</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                {rateInfo.type === "flat" ? "Flat fee" : `${rateInfo.rate}%`}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#00897B" }}>Fee: ${advanceFee.toFixed(2)}</p>
            </div>
          </div>
          {savings > 0 && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                background: "#F0FDFB",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#065F46" }}>
                You save ${savings.toFixed(2)} with TandaXn!
              </p>
            </div>
          )}
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
          onClick={() =>
            console.log("Request advance", {
              amount,
              term,
              rate: rateInfo.rate,
              fee: advanceFee,
              total: totalRepayment,
            })
          }
          disabled={!isAffordable && monthlyPayment}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isAffordable || !monthlyPayment ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: isAffordable || !monthlyPayment ? "#FFFFFF" : "#9CA3AF",
            cursor: isAffordable || !monthlyPayment ? "pointer" : "not-allowed",
          }}
        >
          Request ${amount} Advance
        </button>
      </div>
    </div>
  )
}
