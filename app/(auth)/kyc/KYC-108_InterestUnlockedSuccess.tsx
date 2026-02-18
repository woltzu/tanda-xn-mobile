"use client"

export default function InterestUnlockedSuccess() {
  const totalInterest = 47.83
  const goals = [
    { name: "First Home in Ghana", interest: 31.42 },
    { name: "Emergency Fund", interest: 16.41 },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* SUCCESS HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Confetti decorations */}
        <div style={{ position: "absolute", top: "20px", left: "10%", fontSize: "24px", opacity: 0.6 }}>✨</div>
        <div style={{ position: "absolute", top: "40px", right: "15%", fontSize: "20px", opacity: 0.5 }}>🎉</div>
        <div style={{ position: "absolute", bottom: "80px", left: "20%", fontSize: "18px", opacity: 0.4 }}>💫</div>
        <div style={{ position: "absolute", bottom: "100px", right: "10%", fontSize: "22px", opacity: 0.5 }}>✨</div>
        <div style={{ position: "absolute", top: "60px", left: "25%", fontSize: "16px", opacity: 0.3 }}>🎊</div>
        <div style={{ position: "absolute", bottom: "120px", right: "25%", fontSize: "18px", opacity: 0.4 }}>🎊</div>

        {/* Success Icon */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700" }}>Interest Unlocked! 🎉</h1>
        <p style={{ margin: 0, fontSize: "16px", opacity: 0.9 }}>Your earnings are now accessible</p>
      </div>

      {/* CONTENT */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Total Interest Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#6B7280" }}>Total Interest Now Available</p>
          <p style={{ margin: "0 0 16px 0", fontSize: "48px", fontWeight: "700", color: "#059669" }}>
            ${totalInterest.toFixed(2)}
          </p>

          {/* Breakdown */}
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "12px",
              padding: "12px",
            }}
          >
            {goals.map((goal, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: idx > 0 ? "8px 0 0 0" : 0,
                  borderTop: idx > 0 ? "1px solid #E5E7EB" : "none",
                  marginTop: idx > 0 ? "8px" : 0,
                }}
              >
                <span style={{ fontSize: "13px", color: "#065F46" }}>{goal.name}</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#059669" }}>
                  +${goal.interest.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* What's Changed */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            What's changed
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { before: "Interest locked", after: "Interest accessible anytime" },
              { before: "Manual claims needed", after: "Auto-deposits to your balance" },
              { before: "Limited withdrawals", after: "Unlimited withdrawal access" },
              { before: "Basic features", after: "Full TandaXn access" },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "16px" }}>✅</span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      color: "#9CA3AF",
                      textDecoration: "line-through",
                    }}
                  >
                    {item.before}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "#059669",
                    }}
                  >
                    {item.after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What Would You Like To Do */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            What would you like to do?
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={() => console.log("Transfer to bank")}
              style={{
                width: "100%",
                padding: "16px",
                background: "#059669",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                🏦
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#FFFFFF" }}>Transfer to my bank</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                  Get your ${totalInterest.toFixed(2)} now
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={() => console.log("Keep growing")}
              style={{
                width: "100%",
                padding: "16px",
                background: "#F5F7FA",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                📈
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Keep it growing</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Add to savings and earn more interest
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION */}
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
          onClick={() => console.log("Go to Dashboard")}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "15px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
