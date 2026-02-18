"use client"

import { useState } from "react"

export default function CorridorLimitsScreen() {
  const userTier = "verified"
  const corridors = [
    {
      id: "india",
      country: "India",
      flag: "🇮🇳",
      currency: "INR",
      dailyLimit: 2000,
      dailyUsed: 0,
      monthlyLimit: 10000,
      monthlyUsed: 450,
      regulatoryNote: "RBI regulated. PAN required for transfers over $600.",
      status: "active",
    },
    {
      id: "nigeria",
      country: "Nigeria",
      flag: "🇳🇬",
      currency: "NGN",
      dailyLimit: 1000,
      dailyUsed: 200,
      monthlyLimit: 5000,
      monthlyUsed: 1200,
      regulatoryNote: "CBN regulated. BVN required for all transfers.",
      status: "active",
    },
    {
      id: "philippines",
      country: "Philippines",
      flag: "🇵🇭",
      currency: "PHP",
      dailyLimit: 2000,
      dailyUsed: 0,
      monthlyLimit: 10000,
      monthlyUsed: 0,
      regulatoryNote: "BSP licensed. Additional ID may be required.",
      status: "active",
    },
    {
      id: "cameroon",
      country: "Cameroon",
      flag: "🇨🇲",
      currency: "XAF",
      dailyLimit: 1500,
      dailyUsed: 200,
      monthlyLimit: 7500,
      monthlyUsed: 2400,
      regulatoryNote: "CEMAC zone. Mobile money limits apply.",
      status: "active",
    },
    {
      id: "kenya",
      country: "Kenya",
      flag: "🇰🇪",
      currency: "KES",
      dailyLimit: 1500,
      dailyUsed: 0,
      monthlyLimit: 7500,
      monthlyUsed: 150,
      regulatoryNote: "CBK regulated. M-Pesa limits apply.",
      status: "active",
    },
    {
      id: "mexico",
      country: "Mexico",
      flag: "🇲🇽",
      currency: "MXN",
      dailyLimit: 2500,
      dailyUsed: 0,
      monthlyLimit: 15000,
      monthlyUsed: 0,
      regulatoryNote: "Coming in Phase 2",
      status: "coming_soon",
    },
  ]

  const [selectedCorridor, setSelectedCorridor] = useState<(typeof corridors)[number] | null>(null)

  const activeCorridors = corridors.filter((c) => c.status === "active")
  const comingSoonCorridors = corridors.filter((c) => c.status === "coming_soon")

  const totalMonthlyLimit = activeCorridors.reduce((sum, c) => sum + c.monthlyLimit, 0)
  const totalMonthlyUsed = activeCorridors.reduce((sum, c) => sum + c.monthlyUsed, 0)

  const handleBack = () => console.log("Navigate back")
  const handleUpgrade = () => console.log("Navigate to upgrade")
  const handleSelectCorridor = (corridor: (typeof corridors)[number]) => {
    console.log("Send to", corridor.country)
  }

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
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <button
            onClick={handleBack}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Country Limits</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Your sending limits by destination</p>
          </div>
        </div>

        {/* Overall Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>This month's usage</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>
              ${totalMonthlyUsed.toLocaleString()} / ${totalMonthlyLimit.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              height: "8px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(totalMonthlyUsed / totalMonthlyLimit) * 100}%`,
                height: "100%",
                background: "#00C6AE",
                borderRadius: "4px",
              }}
            />
          </div>
          <p style={{ margin: "10px 0 0 0", fontSize: "11px", opacity: 0.8, textAlign: "center" }}>
            Verified Sender • Upgrade to Trusted for higher limits
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Active Corridors */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Active Corridors ({activeCorridors.length})
          </h3>

          {activeCorridors.map((corridor, idx) => {
            const dailyPercent = (corridor.dailyUsed / corridor.dailyLimit) * 100
            const monthlyPercent = (corridor.monthlyUsed / corridor.monthlyLimit) * 100

            return (
              <button
                key={corridor.id}
                onClick={() => setSelectedCorridor(corridor)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
                  marginBottom: idx < activeCorridors.length - 1 ? "10px" : 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "28px" }}>{corridor.flag}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {corridor.country}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{corridor.currency}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                      ${corridor.dailyLimit - corridor.dailyUsed}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>available today</p>
                  </div>
                </div>

                {/* Daily Progress */}
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>Daily</span>
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>
                      ${corridor.dailyUsed} / ${corridor.dailyLimit}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "4px",
                      background: "#E5E7EB",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${dailyPercent}%`,
                        height: "100%",
                        background: dailyPercent > 80 ? "#F59E0B" : "#00C6AE",
                      }}
                    />
                  </div>
                </div>

                {/* Monthly Progress */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>Monthly</span>
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>
                      ${corridor.monthlyUsed} / ${corridor.monthlyLimit}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "4px",
                      background: "#E5E7EB",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${monthlyPercent}%`,
                        height: "100%",
                        background: monthlyPercent > 80 ? "#F59E0B" : "#00C6AE",
                      }}
                    />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Coming Soon */}
        {comingSoonCorridors.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Coming Soon</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              {comingSoonCorridors.map((corridor) => (
                <div
                  key={corridor.id}
                  style={{
                    flex: 1,
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "12px",
                    textAlign: "center",
                    opacity: 0.7,
                  }}
                >
                  <span style={{ fontSize: "32px" }}>{corridor.flag}</span>
                  <p style={{ margin: "8px 0 0 0", fontSize: "12px", fontWeight: "500", color: "#6B7280" }}>
                    {corridor.country}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>ℹ️</span>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
                About Corridor Limits
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#B45309", lineHeight: 1.5 }}>
                Limits vary by country due to local regulations. Some countries have additional requirements like BVN
                (Nigeria) or PAN (India). Upgrade your verification level to unlock higher limits.
              </p>
            </div>
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
          onClick={handleUpgrade}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          Upgrade to Unlock Higher Limits
        </button>
      </div>

      {/* Corridor Detail Modal */}
      {selectedCorridor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,35,66,0.8)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 100,
          }}
          onClick={() => setSelectedCorridor(null)}
        >
          <div
            style={{
              width: "100%",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "20px 20px 40px 20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "36px" }}>{selectedCorridor.flag}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                    {selectedCorridor.country}
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{selectedCorridor.currency}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCorridor(null)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Limits Detail */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ padding: "14px", background: "#F5F7FA", borderRadius: "12px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>Daily Limit</p>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                  ${selectedCorridor.dailyLimit.toLocaleString()}
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                  ${selectedCorridor.dailyUsed} used today
                </p>
              </div>
              <div style={{ padding: "14px", background: "#F5F7FA", borderRadius: "12px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>Monthly Limit</p>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                  ${selectedCorridor.monthlyLimit.toLocaleString()}
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                  ${selectedCorridor.monthlyUsed} used this month
                </p>
              </div>
            </div>

            {/* Regulatory Note */}
            <div
              style={{
                padding: "14px",
                background: "#F0FDFB",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#065F46" }}>{selectedCorridor.regulatoryNote}</p>
            </div>

            <button
              onClick={() => {
                setSelectedCorridor(null)
                handleSelectCorridor(selectedCorridor)
              }}
              style={{
                width: "100%",
                marginTop: "16px",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "#00C6AE",
                fontSize: "15px",
                fontWeight: "600",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Send to {selectedCorridor.country}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
