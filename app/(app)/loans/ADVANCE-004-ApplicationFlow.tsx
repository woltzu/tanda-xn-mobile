"use client"

import { useState } from "react"

export default function ApplicationFlowScreen() {
  const user = {
    name: "Franck",
    xnScore: 75,
  }

  const upcomingPayouts = [
    { id: "p1", circleName: "Family Circle", amount: 500, date: "Feb 15, 2025", maxAdvance: 400 },
    { id: "p2", circleName: "Business Builders", amount: 800, date: "Mar 1, 2025", maxAdvance: 640 },
    { id: "p3", circleName: "Community Fund", amount: 300, date: "Mar 10, 2025", maxAdvance: 240 },
  ]

  const advanceDetails = {
    amount: 300,
    fee: 15,
    total: 315,
    rate: 9.5,
  }

  const [step, setStep] = useState(1)
  const [selectedPayout, setSelectedPayout] = useState(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToWithholding, setAgreedToWithholding] = useState(false)
  const [agreedToDefault, setAgreedToDefault] = useState(false)

  const allAgreed = agreedToTerms && agreedToWithholding && agreedToDefault

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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : console.log("Back"))}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Request Advance</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Step {step} of 3</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: s === step ? "40px" : "24px",
                height: "6px",
                borderRadius: "3px",
                background: s <= step ? "#00C6AE" : "rgba(255,255,255,0.3)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* STEP 1: Select Payout */}
        {step === 1 && (
          <>
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
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                Which circle payout do you want to advance?
              </label>
              <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#6B7280" }}>
                Select the payout you want to receive early. We'll automatically withhold repayment when it arrives.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {upcomingPayouts.map((payout) => (
                  <button
                    key={payout.id}
                    onClick={() => setSelectedPayout(payout)}
                    style={{
                      width: "100%",
                      padding: "16px",
                      background: selectedPayout?.id === payout.id ? "#F0FDFB" : "#F5F7FA",
                      borderRadius: "12px",
                      border: selectedPayout?.id === payout.id ? "2px solid #00C6AE" : "1px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "12px",
                          background: selectedPayout?.id === payout.id ? "#00C6AE" : "#E5E7EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={selectedPayout?.id === payout.id ? "#FFFFFF" : "#6B7280"}
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 12h8" />
                          <path d="M12 8v8" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                          {payout.circleName}
                        </p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Payout: {payout.date}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "18px",
                          fontWeight: "700",
                          color: selectedPayout?.id === payout.id ? "#00C6AE" : "#0A2342",
                        }}
                      >
                        ${payout.amount}
                      </p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                        Up to ${payout.maxAdvance}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedPayout && (
              <div
                style={{
                  background: "#F0FDFB",
                  borderRadius: "12px",
                  padding: "14px",
                  border: "1px solid #00C6AE",
                }}
              >
                <p style={{ margin: 0, fontSize: "13px", color: "#065F46" }}>
                  <strong>Selected:</strong> {selectedPayout.circleName} payout of ${selectedPayout.amount}
                  <br />
                  <span style={{ fontSize: "12px" }}>You can advance up to 80% (${selectedPayout.maxAdvance})</span>
                </p>
              </div>
            )}
          </>
        )}

        {/* STEP 2: Advance Details */}
        {step === 2 && selectedPayout && (
          <>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                Advance Details
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Advancing from</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {selectedPayout.circleName}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Payout date</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{selectedPayout.date}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Payout amount</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    ${selectedPayout.amount}
                  </span>
                </div>
                <div style={{ height: "1px", background: "#E5E7EB" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance amount</span>
                  <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                    ${advanceDetails.amount}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance fee ({advanceDetails.rate}%)</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>
                    +${advanceDetails.fee.toFixed(2)}
                  </span>
                </div>
                <div style={{ height: "1px", background: "#E5E7EB" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    Total withheld from payout
                  </span>
                  <span style={{ fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                    ${advanceDetails.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* After Withholding */}
            <div
              style={{
                background: "#0A2342",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                After repayment, you keep:
              </p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
                ${(selectedPayout.amount - advanceDetails.total).toFixed(2)}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                From your ${selectedPayout.amount} payout
              </p>
            </div>

            {/* Timeline */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                What happens next
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  { icon: "⚡", title: "Instant", text: `$${advanceDetails.amount} sent to your wallet now` },
                  { icon: "📅", title: selectedPayout.date, text: "Your circle payout arrives" },
                  {
                    icon: "🔄",
                    title: "Auto-withhold",
                    text: `$${advanceDetails.total.toFixed(2)} deducted automatically`,
                  },
                  {
                    icon: "✅",
                    title: "Done",
                    text: `$${(selectedPayout.amount - advanceDetails.total).toFixed(2)} credited to your wallet`,
                  },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#F0FDFB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{item.title}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* STEP 3: Agreement */}
        {step === 3 && (
          <>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                Auto-Repayment Agreement
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Agreement 1 */}
                <button
                  onClick={() => setAgreedToWithholding(!agreedToWithholding)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: agreedToWithholding ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "12px",
                    border: agreedToWithholding ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      border: agreedToWithholding ? "none" : "2px solid #D1D5DB",
                      background: agreedToWithholding ? "#00C6AE" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {agreedToWithholding && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#0A2342", lineHeight: 1.5 }}>
                    I authorize TandaXn to <strong>withhold ${advanceDetails.total.toFixed(2)}</strong> from my{" "}
                    {selectedPayout?.circleName} payout on <strong>{selectedPayout?.date}</strong>.
                  </p>
                </button>

                {/* Agreement 2 */}
                <button
                  onClick={() => setAgreedToDefault(!agreedToDefault)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: agreedToDefault ? "#FEF3C7" : "#F5F7FA",
                    borderRadius: "12px",
                    border: agreedToDefault ? "2px solid #D97706" : "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      border: agreedToDefault ? "none" : "2px solid #D1D5DB",
                      background: agreedToDefault ? "#D97706" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {agreedToDefault && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#0A2342", lineHeight: 1.5 }}>
                    I understand that if my payout is insufficient, my <strong>XnScore drops 20 points</strong> and I
                    may be restricted from circles until I repay.
                  </p>
                </button>

                {/* Agreement 3 */}
                <button
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: agreedToTerms ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "12px",
                    border: agreedToTerms ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      border: agreedToTerms ? "none" : "2px solid #D1D5DB",
                      background: agreedToTerms ? "#00C6AE" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {agreedToTerms && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#0A2342", lineHeight: 1.5 }}>
                    I have read and agree to the{" "}
                    <span style={{ color: "#00C6AE", fontWeight: "600" }}>Advance Payout Terms</span> and understand
                    this is not a traditional loan.
                  </p>
                </button>
              </div>
            </div>

            {/* Summary */}
            <div
              style={{
                background: "#0A2342",
                borderRadius: "14px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>You receive now</span>
                <span style={{ fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>${advanceDetails.amount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                  Withheld on {selectedPayout?.date}
                </span>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#FFFFFF" }}>
                  ${advanceDetails.total.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Button */}
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
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !selectedPayout}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: step === 1 && !selectedPayout ? "#E5E7EB" : "#00C6AE",
              fontSize: "16px",
              fontWeight: "600",
              color: step === 1 && !selectedPayout ? "#9CA3AF" : "#FFFFFF",
              cursor: step === 1 && !selectedPayout ? "not-allowed" : "pointer",
            }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={() => console.log("Submit advance request", { payout: selectedPayout, advance: advanceDetails })}
            disabled={!allAgreed}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: allAgreed ? "#00C6AE" : "#E5E7EB",
              fontSize: "16px",
              fontWeight: "600",
              color: allAgreed ? "#FFFFFF" : "#9CA3AF",
              cursor: allAgreed ? "pointer" : "not-allowed",
            }}
          >
            Confirm & Get ${advanceDetails.amount} Now
          </button>
        )}
      </div>
    </div>
  )
}
