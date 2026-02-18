"use client"

import { useState } from "react"

export default function MobileMoneySelection() {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  const country = { code: "NG", name: "Nigeria", flag: "🇳🇬" }
  const amount = { send: 100, receive: 91500, currency: "NGN" }

  // Mobile money options by country
  const mobileMoneyOptions = {
    NG: [
      {
        id: "opay",
        name: "OPay",
        logo: "🔵",
        color: "#00A859",
        coverage: "98%",
        speed: "Instant",
        fee: "Free",
        limit: "₦5,000,000/day",
        popular: true,
        description: "Most popular in Nigeria",
        features: ["Free transfers", "24/7 service", "SMS confirmation"],
      },
      {
        id: "paga",
        name: "Paga",
        logo: "🟢",
        color: "#00B050",
        coverage: "85%",
        speed: "Instant",
        fee: "₦50",
        limit: "₦2,000,000/day",
        popular: false,
        description: "Trusted since 2009",
        features: ["Wide agent network", "Bill payments", "Easy withdrawal"],
      },
      {
        id: "palmpay",
        name: "PalmPay",
        logo: "🟣",
        color: "#7E57C2",
        coverage: "80%",
        speed: "Instant",
        fee: "Free",
        limit: "₦3,000,000/day",
        popular: false,
        description: "Growing fast",
        features: ["Cashback rewards", "Free transfers", "Modern app"],
      },
    ],
  }

  const options = mobileMoneyOptions[country.code as keyof typeof mobileMoneyOptions] || mobileMoneyOptions.NG

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
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Delivery Method</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              {country.flag} {country.name} • Mobile Money
            </p>
          </div>
        </div>

        {/* Transfer Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Recipient gets</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>
              {amount.currency} {amount.receive.toLocaleString()}
            </p>
          </div>
          <div
            style={{
              background: "#00C6AE",
              padding: "6px 12px",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "600" }}>⚡ Instant</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* How It Works Button */}
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>🎥</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>How mobile money works</span>
          </div>
          <span style={{ fontSize: "12px", color: "#00C6AE" }}>30 sec</span>
        </button>

        {/* How It Works Expanded */}
        {showHowItWorks && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "20px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span>1</span>
              </div>
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  You send money
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Pay with your card or bank account</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span>2</span>
              </div>
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  We convert instantly
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Best exchange rates, no hidden fees</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#FFFFFF",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  Recipient gets SMS
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                  Money arrives in their mobile wallet instantly
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Selection */}
        <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
          Select mobile wallet
        </h3>

        {options.map((wallet) => (
          <button
            key={wallet.id}
            onClick={() => setSelectedWallet(wallet.id)}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: selectedWallet === wallet.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
              background: selectedWallet === wallet.id ? "#F0FDFB" : "#FFFFFF",
              cursor: "pointer",
              marginBottom: "12px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              {/* Logo */}
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  background: `${wallet.color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  flexShrink: 0,
                }}
              >
                {wallet.logo}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>{wallet.name}</span>
                  {wallet.popular && (
                    <span
                      style={{
                        background: "#00C6AE",
                        color: "#FFFFFF",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                      }}
                    >
                      POPULAR
                    </span>
                  )}
                </div>
                <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>{wallet.description}</p>

                {/* Stats */}
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px" }}>📶</span>
                    <span style={{ fontSize: "11px", color: "#6B7280" }}>{wallet.coverage} coverage</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px" }}>⚡</span>
                    <span style={{ fontSize: "11px", color: "#6B7280" }}>{wallet.speed}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "12px" }}>💰</span>
                    <span style={{ fontSize: "11px", color: wallet.fee === "Free" ? "#00897B" : "#6B7280" }}>
                      {wallet.fee}
                    </span>
                  </div>
                </div>

                {/* Features (expanded when selected) */}
                {selectedWallet === wallet.id && (
                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #E5E7EB",
                    }}
                  >
                    <p style={{ margin: "0 0 8px 0", fontSize: "11px", fontWeight: "600", color: "#0A2342" }}>
                      Features:
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {wallet.features.map((feature, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: "#F5F7FA",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            color: "#6B7280",
                          }}
                        >
                          ✓ {feature}
                        </span>
                      ))}
                    </div>
                    <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                      Daily limit: {wallet.limit}
                    </p>
                  </div>
                )}
              </div>

              {/* Radio */}
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  border: selectedWallet === wallet.id ? "none" : "2px solid #E5E7EB",
                  background: selectedWallet === wallet.id ? "#00C6AE" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {selectedWallet === wallet.id && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Other Options */}
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            background: "#F5F7FA",
            borderRadius: "14px",
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
            Other delivery options
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "20px" }}>🏦</span>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#0A2342" }}>Bank Transfer</span>
            </button>
            <button
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "20px" }}>🏪</span>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#0A2342" }}>Cash Pickup</span>
            </button>
            <button
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "20px" }}>💳</span>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#0A2342" }}>Card</span>
            </button>
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
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={() => console.log("Continue with", selectedWallet)}
          disabled={!selectedWallet}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: selectedWallet ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E5E7EB",
            color: selectedWallet ? "#FFFFFF" : "#9CA3AF",
            fontSize: "16px",
            fontWeight: "700",
            cursor: selectedWallet ? "pointer" : "not-allowed",
          }}
        >
          Continue with {selectedWallet ? options.find((w) => w.id === selectedWallet)?.name : "selected wallet"}
        </button>
      </div>
    </div>
  )
}
