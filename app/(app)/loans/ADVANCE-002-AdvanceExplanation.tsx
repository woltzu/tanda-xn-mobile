"use client"

import { useState } from "react"

export default function AdvanceExplanationScreen() {
  const [currentStep, setCurrentStep] = useState(0)

  const user = {
    name: "Franck",
    nextPayout: { amount: 500, date: "Feb 15, 2025", circleName: "Family Circle" },
  }

  const steps = [
    {
      icon: "🎯",
      title: "You Have a Payout Coming",
      description:
        "Every circle member receives a payout when it's their turn. You're expecting $500 on Feb 15 from Family Circle.",
      visual: "payout",
    },
    {
      icon: "⚡",
      title: "Get It Early When You Need It",
      description:
        "Need money before your payout date? Request an advance of up to 80% ($400) of your upcoming payout right now.",
      visual: "advance",
    },
    {
      icon: "🔄",
      title: "Auto-Repay From Your Payout",
      description:
        "When your payout arrives, we automatically withhold the advance + a small fee. No bills, no collectors, no stress.",
      visual: "repay",
    },
    {
      icon: "✅",
      title: "You Keep What's Left",
      description:
        "After repayment, the remaining payout is yours. If you advanced $400 + $20 fee, you'd keep $80 from your $500 payout.",
      visual: "keep",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>How Advance Payouts Work</h1>
        </div>

        {/* Hero Message */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <span style={{ fontSize: "40px" }}>💡</span>
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700" }}>Not a Loan — An Advance</h2>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              opacity: 0.9,
              maxWidth: "300px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            You're borrowing from <strong>your own future winnings</strong>, not from a bank or lender.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Visual Flow Animation */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* Step Indicator */}
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "20px" }}>
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: idx === currentStep ? "24px" : "8px",
                  height: "8px",
                  borderRadius: "4px",
                  background: idx === currentStep ? "#00C6AE" : idx < currentStep ? "#00C6AE" : "#E5E7EB",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>

          {/* Current Step */}
          <div style={{ textAlign: "center", minHeight: "200px" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "36px",
              }}
            >
              {steps[currentStep].icon}
            </div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              {steps[currentStep].title}
            </h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#6B7280", lineHeight: 1.6 }}>
              {steps[currentStep].description}
            </p>

            {/* Visual Representation */}
            <div style={{ marginTop: "20px" }}>
              {steps[currentStep].visual === "payout" && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      padding: "12px 20px",
                      background: "#F0FDFB",
                      borderRadius: "10px",
                      border: "1px solid #00C6AE",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Family Circle</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>$500</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Feb 15, 2025</p>
                  </div>
                </div>
              )}
              {steps[currentStep].visual === "advance" && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                  <div style={{ padding: "10px 16px", background: "#F5F7FA", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>$500</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Your Payout</p>
                  </div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <div
                    style={{
                      padding: "10px 16px",
                      background: "#F0FDFB",
                      borderRadius: "8px",
                      border: "2px solid #00C6AE",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>$400</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#00897B" }}>Get Now!</p>
                  </div>
                </div>
              )}
              {steps[currentStep].visual === "repay" && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                  <div style={{ padding: "10px 16px", background: "#F0FDFB", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>$500</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Payout Arrives</p>
                  </div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <div
                    style={{
                      padding: "10px 16px",
                      background: "#FEF3C7",
                      borderRadius: "8px",
                      border: "1px solid #D97706",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#D97706" }}>-$420</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#92400E" }}>Auto-Withheld</p>
                  </div>
                </div>
              )}
              {steps[currentStep].visual === "keep" && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                  <div style={{ padding: "10px 16px", background: "#F5F7FA", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#6B7280", textDecoration: "line-through" }}>
                      $500
                    </p>
                  </div>
                  <span style={{ fontSize: "16px", color: "#6B7280" }}>−</span>
                  <div style={{ padding: "10px 16px", background: "#FEF3C7", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "14px", color: "#D97706" }}>$420</p>
                  </div>
                  <span style={{ fontSize: "16px", color: "#6B7280" }}>=</span>
                  <div
                    style={{
                      padding: "10px 16px",
                      background: "#F0FDFB",
                      borderRadius: "8px",
                      border: "2px solid #00C6AE",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>$80</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#00897B" }}>Yours! ✓</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: currentStep === 0 ? "#F5F7FA" : "#FFFFFF",
                fontSize: "13px",
                fontWeight: "600",
                color: currentStep === 0 ? "#9CA3AF" : "#0A2342",
                cursor: currentStep === 0 ? "not-allowed" : "pointer",
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: currentStep === steps.length - 1 ? "#E5E7EB" : "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
                color: currentStep === steps.length - 1 ? "#9CA3AF" : "#FFFFFF",
                cursor: currentStep === steps.length - 1 ? "not-allowed" : "pointer",
              }}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Key Differences */}
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
            Why This Is Different
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "🔒", text: "No external collection agencies — we just withhold from your payout" },
              { icon: "📊", text: "Your XnScore (Trust Score) determines your rates — not traditional credit" },
              { icon: "⏱️", text: "Automatic repayment — no bills, no remembering due dates" },
              { icon: "💰", text: "Way cheaper than payday lenders (9.5% vs 400%+)" },
            ].map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>{item.icon}</span>
                <span style={{ fontSize: "13px", color: "#0A2342", lineHeight: 1.4 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Disclaimer */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #D97706",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D97706"
              strokeWidth="2"
              style={{ marginTop: "2px", flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>What if I default?</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#B45309", lineHeight: 1.5 }}>
                If your payout doesn't cover your advance, your XnScore drops 20 points and you may be restricted from
                future circles until you repay. No external collectors — but it affects your ability to participate in
                TandaXn.
              </p>
            </div>
          </div>
        </div>

        {/* See Rates */}
        <button
          onClick={() => console.log("View rates")}
          style={{
            width: "100%",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span style={{ fontSize: "13px", color: "#0A2342", fontWeight: "500" }}>Why this rate? See breakdown</span>
        </button>
      </div>

      {/* Bottom CTA */}
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
          onClick={() => console.log("Get started")}
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
          }}
        >
          I Understand — Get Started
        </button>
      </div>
    </div>
  )
}
