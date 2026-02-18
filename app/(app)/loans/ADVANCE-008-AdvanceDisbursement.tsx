"use client"

import { useState } from "react"

export default function AdvanceDisbursementScreen() {
  const advanceAmount = 300
  const userBankAccounts = [
    { id: "bank1", name: "Chase Checking", last4: "4521", type: "checking" },
    { id: "bank2", name: "Bank of America", last4: "7892", type: "savings" },
  ]
  const walletBalance = 125.5

  const [selectedMethod, setSelectedMethod] = useState("wallet")
  const [selectedBank, setSelectedBank] = useState(userBankAccounts[0]?.id)

  const disbursementOptions = [
    {
      id: "wallet",
      icon: "💳",
      name: "TandaXn Wallet",
      description: "Instant • No fee",
      fee: 0,
      time: "Instant",
      recommended: true,
    },
    {
      id: "bank_standard",
      icon: "🏦",
      name: "Bank Transfer",
      description: "1-3 business days • No fee",
      fee: 0,
      time: "1-3 days",
    },
    {
      id: "bank_instant",
      icon: "⚡",
      name: "Instant Bank Transfer",
      description: "Within minutes • $2.99 fee",
      fee: 2.99,
      time: "Minutes",
    },
  ]

  const selectedOption = disbursementOptions.find((o) => o.id === selectedMethod)
  const totalReceived = advanceAmount - (selectedOption?.fee || 0)

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Where to Send Funds</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Choose your disbursement method</p>
          </div>
        </div>

        {/* Amount */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Advance Amount</p>
          <p style={{ margin: 0, fontSize: "32px", fontWeight: "700" }}>${advanceAmount}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Disbursement Options */}
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
            Select Disbursement Method
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {disbursementOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedMethod(option.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedMethod === option.id ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedMethod === option.id ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                }}
              >
                {option.recommended && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-8px",
                      right: "12px",
                      background: "#00C6AE",
                      color: "#FFFFFF",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: "700",
                    }}
                  >
                    RECOMMENDED
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: selectedMethod === option.id ? "#00C6AE" : "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                    }}
                  >
                    {option.icon}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{option.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{option.description}</p>
                  </div>
                </div>
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: selectedMethod === option.id ? "none" : "2px solid #D1D5DB",
                    background: selectedMethod === option.id ? "#00C6AE" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedMethod === option.id && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bank Selection (if bank method selected) */}
        {(selectedMethod === "bank_standard" || selectedMethod === "bank_instant") && (
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
              Select Bank Account
            </label>

            {userBankAccounts.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {userBankAccounts.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => setSelectedBank(bank.id)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: selectedBank === bank.id ? "#F0FDFB" : "#F5F7FA",
                      borderRadius: "10px",
                      border: selectedBank === bank.id ? "2px solid #00C6AE" : "1px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={selectedBank === bank.id ? "#00C6AE" : "#6B7280"}
                        strokeWidth="2"
                      >
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      <div style={{ textAlign: "left" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{bank.name}</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                          ••••{bank.last4} • {bank.type}
                        </p>
                      </div>
                    </div>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: selectedBank === bank.id ? "none" : "2px solid #D1D5DB",
                        background: selectedBank === bank.id ? "#00C6AE" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {selectedBank === bank.id && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", background: "#F5F7FA", borderRadius: "10px" }}>
                <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#6B7280" }}>No bank accounts linked</p>
                <button
                  style={{
                    padding: "8px 16px",
                    background: "#00C6AE",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  + Add Bank Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
            Disbursement Summary
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Advance amount</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>${advanceAmount}</span>
            </div>
            {selectedOption?.fee > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Instant transfer fee</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>
                  -${selectedOption.fee.toFixed(2)}
                </span>
              </div>
            )}
            <div style={{ height: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>You'll receive</span>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>${totalReceived.toFixed(2)}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              Delivery: <strong style={{ color: "#00C6AE" }}>{selectedOption?.time}</strong>
              {selectedMethod === "wallet" && ` to your TandaXn Wallet (Balance: $${walletBalance.toFixed(2)})`}
            </span>
          </div>
        </div>
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
          onClick={() => console.log("Confirm", { method: selectedMethod, bank: selectedBank, amount: totalReceived })}
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
          Confirm & Receive ${totalReceived.toFixed(2)}
        </button>
      </div>
    </div>
  )
}
