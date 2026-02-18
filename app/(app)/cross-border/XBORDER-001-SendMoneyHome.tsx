"use client"

export default function SendMoneyHomeScreen() {
  const familyCircles = [
    {
      id: "fc1",
      name: "Support for Mama & Papa",
      beneficiary: "Mama Françoise",
      members: 4,
      contributed: 3,
      totalAmount: 400,
      nextSendDate: "Feb 1",
      status: "collecting",
    },
  ]

  const recentRecipients = [
    { id: "r1", name: "Mama Françoise", country: "🇨🇲", lastSent: "Dec 20", amount: 200 },
    { id: "r2", name: "Papa Jean", country: "🇨🇲", lastSent: "Dec 5", amount: 150 },
  ]

  const savingsVsTraditional = { monthly: 51, yearly: 612 }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Send Money Home</h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>Support family, together or direct</p>
            </div>
          </div>
          <button
            onClick={() => console.log("View history")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>

        {/* Savings Highlight */}
        <button
          onClick={() => console.log("View comparison")}
          style={{
            width: "100%",
            padding: "14px",
            background: "rgba(0,198,174,0.2)",
            borderRadius: "12px",
            border: "1px solid rgba(0,198,174,0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "20px" }}>💰</span>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>
              Save ${savingsVsTraditional.yearly}/year on fees
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              vs Western Union & MoneyGram • See comparison
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Choose How to Send */}
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
            Choose How to Send
          </h3>

          {/* Option 1: Family Support Circle */}
          <button
            onClick={() => console.log("Family Support Circle")}
            style={{
              width: "100%",
              padding: "16px",
              background: "#F0FDFB",
              borderRadius: "14px",
              border: "2px solid #00C6AE",
              cursor: "pointer",
              marginBottom: "12px",
              textAlign: "left",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-8px",
                right: "12px",
                background: "#00C6AE",
                color: "#FFFFFF",
                padding: "3px 10px",
                borderRadius: "10px",
                fontSize: "10px",
                fontWeight: "700",
              }}
            >
              BEST VALUE
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                  Family Support Circle
                </p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.4 }}>
                  Pool money with siblings • Send one transfer • Save 80% on fees
                </p>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#00897B",
                      fontWeight: "600",
                      background: "#F0FDFB",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    ~1.2% fee
                  </span>
                  <span style={{ fontSize: "11px", color: "#00897B", fontWeight: "600" }}>Automated monthly</span>
                </div>
              </div>
            </div>
          </button>

          {/* Option 2: Direct Send */}
          <button
            onClick={() => console.log("Direct Send")}
            style={{
              width: "100%",
              padding: "16px",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Direct Send</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.4 }}>
                  Send to anyone, anytime • One-time or recurring
                </p>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#6B7280",
                      fontWeight: "500",
                      background: "#F5F7FA",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    ~1.5% fee
                  </span>
                  <span style={{ fontSize: "11px", color: "#6B7280", fontWeight: "500" }}>Instant delivery</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Active Family Circles */}
        {familyCircles.length > 0 && (
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
              Your Family Circles
            </h3>
            {familyCircles.map((circle) => (
              <button
                key={circle.id}
                onClick={() => console.log("View circle", circle.name)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{circle.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      Beneficiary: {circle.beneficiary}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "3px 8px",
                      background: circle.contributed === circle.members ? "#F0FDFB" : "#FEF3C7",
                      color: circle.contributed === circle.members ? "#00897B" : "#D97706",
                      fontSize: "10px",
                      fontWeight: "600",
                      borderRadius: "4px",
                    }}
                  >
                    {circle.contributed}/{circle.members} contributed
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>
                    ${circle.totalAmount} collected • Sends {circle.nextSendDate}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Quick Send Again */}
        {recentRecipients.length > 0 && (
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
              Quick Send Again
            </h3>
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
              {recentRecipients.map((recipient) => (
                <button
                  key={recipient.id}
                  onClick={() => console.log("Send to", recipient.name)}
                  style={{
                    padding: "12px 16px",
                    background: "#F5F7FA",
                    borderRadius: "12px",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "center",
                    minWidth: "100px",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "#0A2342",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      color: "#FFFFFF",
                      fontWeight: "600",
                      margin: "0 auto 8px auto",
                    }}
                  >
                    {recipient.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                    {recipient.name.split(" ")[0]}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{recipient.country}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cost Comparison Preview */}
        <button
          onClick={() => console.log("View comparison")}
          style={{
            width: "100%",
            padding: "16px",
            background: "#0A2342",
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Why TandaXn is Cheaper</h4>
            <span style={{ fontSize: "11px", color: "#00C6AE" }}>View full comparison →</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div
              style={{
                flex: 1,
                padding: "10px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>Western Union</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "700", color: "#D97706" }}>~6% fee</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "10px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.7)" }}>MoneyGram</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "700", color: "#D97706" }}>~5% fee</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "10px",
                background: "rgba(0,198,174,0.3)",
                borderRadius: "8px",
                textAlign: "center",
                border: "1px solid #00C6AE",
              }}
            >
              <p style={{ margin: 0, fontSize: "10px", color: "#00C6AE" }}>TandaXn</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>~1.2% fee</p>
            </div>
          </div>
        </button>

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => console.log("View rates")}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>Rates</span>
          </button>
          <button
            onClick={() => console.log("View history")}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>History</span>
          </button>
        </div>
      </div>
    </div>
  )
}
