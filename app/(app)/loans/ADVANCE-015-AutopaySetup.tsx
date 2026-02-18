"use client"

import { useState } from "react"

export default function AutopaySetupScreen() {
  const activeAdvance = {
    id: "ADV-2025-0120-001",
    amount: 300,
    totalDue: 315,
    withholdingDate: "Feb 15, 2025",
    daysUntil: 25,
  }

  const paymentMethods = [
    { id: "wallet", name: "TandaXn Wallet", balance: 450, icon: "💳", default: true },
    { id: "bank1", name: "Chase Checking ••••4521", icon: "🏦", default: false },
  ]

  const [autopayEnabled, setAutopayEnabled] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState("wallet")
  const [reminderDays, setReminderDays] = useState(3)

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Repayment Settings</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Manage your advance repayment</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Default Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00897B"
              strokeWidth="2"
              style={{ marginTop: "2px", flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>How repayment works</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#047857", lineHeight: 1.5 }}>
                By default, your advance is <strong>auto-withheld from your circle payout</strong> on{" "}
                {activeAdvance.withholdingDate}. No action needed!
                <br />
                <br />
                The settings below are for <strong>optional early repayment</strong> if you want to pay off before your
                payout date.
              </p>
            </div>
          </div>
        </div>

        {/* Current Advance */}
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
            Current Advance
          </h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Amount due</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                ${activeAdvance.totalDue}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Auto-withhold on</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                {activeAdvance.withholdingDate}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{activeAdvance.daysUntil} days</p>
            </div>
          </div>
        </div>

        {/* Early Repayment Autopay */}
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
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Early Repayment Autopay
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                Automatically repay early when you have sufficient funds
              </p>
            </div>
            <button
              onClick={() => setAutopayEnabled(!autopayEnabled)}
              style={{
                width: "52px",
                height: "28px",
                borderRadius: "14px",
                border: "none",
                background: autopayEnabled ? "#00C6AE" : "#E5E7EB",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  position: "absolute",
                  top: "2px",
                  left: autopayEnabled ? "26px" : "2px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>

          {autopayEnabled && (
            <>
              {/* Payment Method Selection */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#0A2342",
                  }}
                >
                  Pay from
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        background: selectedMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                        borderRadius: "10px",
                        border: selectedMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "18px" }}>{method.icon}</span>
                        <div style={{ textAlign: "left" }}>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                            {method.name}
                          </p>
                          {method.balance && (
                            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                              Balance: ${method.balance}
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          border: selectedMethod === method.id ? "none" : "2px solid #D1D5DB",
                          background: selectedMethod === method.id ? "#00C6AE" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {selectedMethod === method.id && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-trigger explanation */}
              <div
                style={{
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#6B7280",
                  lineHeight: 1.5,
                }}
              >
                When enabled: If your wallet balance exceeds ${activeAdvance.totalDue}, we'll automatically pay off your
                advance early, saving you fees.
              </div>
            </>
          )}
        </div>

        {/* Payment Reminders */}
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
            Reminder Before Withholding
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            Get notified before your payout withholding date
          </p>

          <div style={{ display: "flex", gap: "8px" }}>
            {[1, 3, 5, 7].map((days) => (
              <button
                key={days}
                onClick={() => setReminderDays(days)}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  borderRadius: "10px",
                  border: reminderDays === days ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: reminderDays === days ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>{days}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{days === 1 ? "day" : "days"}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            Benefits of early repayment:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { icon: "💰", text: "Save on advance fees (pro-rated)" },
              { icon: "⭐", text: "+2 bonus XnScore points" },
              { icon: "🔓", text: "Keep your full payout" },
              { icon: "📈", text: "Better rates on future advances" },
            ].map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", color: "#4B5563" }}>{item.text}</span>
              </div>
            ))}
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
          onClick={() => console.log("Save Settings", { autopayEnabled, selectedMethod, reminderDays })}
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
          Save Settings
        </button>
      </div>
    </div>
  )
}
