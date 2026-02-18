"use client"

import { useState } from "react"

export default function MobileMoneyTransferScreen() {
  const availableBalance = 2074
  const linkedMobileAccounts = [
    { id: "mm1", provider: "M-Pesa", phone: "+254 7XX XXX 890", country: "Kenya", flag: "🇰🇪", verified: true },
    { id: "mm2", provider: "Orange Money", phone: "+221 7X XXX XX XX", country: "Senegal", flag: "🇸🇳", verified: true },
  ]
  const providers = [
    { id: "mpesa", name: "M-Pesa", logo: "📱", countries: ["Kenya", "Tanzania"], color: "#4CAF50" },
    {
      id: "orange",
      name: "Orange Money",
      logo: "🍊",
      countries: ["Senegal", "Côte d'Ivoire", "Mali", "Cameroon"],
      color: "#FF6600",
    },
    { id: "wave", name: "Wave", logo: "🌊", countries: ["Senegal", "Côte d'Ivoire"], color: "#1DA1F2" },
    {
      id: "mtn",
      name: "MTN MoMo",
      logo: "💛",
      countries: ["Ghana", "Nigeria", "Uganda", "Cameroon"],
      color: "#FFCC00",
    },
  ]
  const exchangeRates: Record<string, number> = {
    KES: 153.25,
    XOF: 605.5,
    GHS: 12.5,
    NGN: 1550.0,
  }

  const [amount, setAmount] = useState("")
  const [selectedAccount, setSelectedAccount] = useState(linkedMobileAccounts[0]?.id || null)

  const parsedAmount = Number.parseFloat(amount) || 0
  const fee = parsedAmount > 0 ? Math.min(parsedAmount * 0.01, 5) : 0 // 1% fee, max $5
  const total = parsedAmount + fee

  const selectedAccountData = linkedMobileAccounts.find((a) => a.id === selectedAccount)
  const localCurrency = selectedAccountData?.country === "Kenya" ? "KES" : "XOF"
  const rate = exchangeRates[localCurrency] || 1
  const localAmount = parsedAmount * rate

  const canContinue = parsedAmount >= 5 && parsedAmount <= availableBalance && selectedAccount

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Mobile Money</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Send to M-Pesa, Orange Money & more</p>
          </div>
        </div>

        {/* Available Balance */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "13px", opacity: 0.8 }}>Available Balance</span>
          <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
            ${availableBalance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount Input */}
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
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Amount to Send (USD)
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "16px",
              background: "#F5F7FA",
              borderRadius: "12px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "28px", fontWeight: "600", color: "#0A2342" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "36px",
                fontWeight: "700",
                color: "#0A2342",
                outline: "none",
                width: "100%",
              }}
            />
          </div>

          {/* Quick Amounts */}
          <div style={{ display: "flex", gap: "8px" }}>
            {[50, 100, 200, 500].map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                disabled={amt > availableBalance}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: amt <= availableBalance ? "pointer" : "not-allowed",
                  opacity: amt <= availableBalance ? 1 : 0.5,
                }}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Local Amount Preview */}
          {parsedAmount > 0 && selectedAccountData && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                background: "#F0FDFB",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Recipient gets approximately</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
                {localCurrency} {localAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                Rate: $1 = {localCurrency} {rate.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Select Mobile Account */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <label style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Send To</label>
            <button
              onClick={() => console.log("Add mobile account")}
              style={{
                padding: "6px 10px",
                background: "#F0FDFB",
                borderRadius: "6px",
                border: "1px solid #00C6AE",
                fontSize: "11px",
                fontWeight: "600",
                color: "#00C6AE",
                cursor: "pointer",
              }}
            >
              + Add New
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {linkedMobileAccounts.map((account) => {
              const provider = providers.find((p) => p.name === account.provider)
              return (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account.id)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: selectedAccount === account.id ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "12px",
                    border: selectedAccount === account.id ? "2px solid #00C6AE" : "1px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: provider?.color || "#6B7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    {provider?.logo || "📱"}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                        {account.provider}
                      </p>
                      <span style={{ fontSize: "16px" }}>{account.flag}</span>
                      {account.verified && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#00C6AE">
                          <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.997-6l7.07-7.071-1.414-1.414-5.656 5.657-2.829-2.829-1.414 1.414L11.003 16z" />
                        </svg>
                      )}
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      {account.phone} • {account.country}
                    </p>
                  </div>
                  {selectedAccount === account.id && (
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#00C6AE",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {linkedMobileAccounts.length === 0 && (
            <button
              onClick={() => console.log("Add mobile account")}
              style={{
                width: "100%",
                padding: "24px",
                background: "#F5F7FA",
                borderRadius: "12px",
                border: "2px dashed #E5E7EB",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "32px" }}>📱</span>
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Add Mobile Money Account
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                M-Pesa, Orange Money, Wave, MTN MoMo
              </p>
            </button>
          )}
        </div>

        {/* Supported Providers */}
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
            Supported Providers
          </h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {providers.map((provider) => (
              <div
                key={provider.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  background: "#F5F7FA",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontSize: "16px" }}>{provider.logo}</span>
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#6B7280" }}>{provider.name}</span>
              </div>
            ))}
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Fast & Reliable:</strong> Transfers typically arrive within minutes. Exchange rates are locked at
            time of transfer.
          </p>
        </div>
      </div>

      {/* Bottom Summary & Button */}
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
        {parsedAmount > 0 && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Send amount</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>${parsedAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Transfer fee (1%)</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#D97706" }}>${fee.toFixed(2)}</span>
            </div>
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.2)",
                paddingTop: "8px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Total</span>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button
          onClick={() =>
            console.log("Continue", {
              amount: parsedAmount,
              accountId: selectedAccount,
              fee,
              total,
              localAmount,
              localCurrency,
            })
          }
          disabled={!canContinue}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canContinue ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canContinue ? "#FFFFFF" : "#9CA3AF",
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
