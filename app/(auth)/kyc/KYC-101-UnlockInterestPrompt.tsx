"use client"

export default function UnlockInterestPrompt() {
  const totalInterest = 47.83
  const monthlyEarning = 12.45
  const interestRate = 4.0
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
        paddingBottom: "160px",
      }}
    >
      {/* HEADER - Celebration */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative elements */}
        <div style={{ position: "absolute", top: "20px", left: "10%", fontSize: "24px", opacity: 0.5 }}>✨</div>
        <div style={{ position: "absolute", top: "60px", right: "15%", fontSize: "20px", opacity: 0.4 }}>🎉</div>
        <div style={{ position: "absolute", bottom: "80px", left: "20%", fontSize: "18px", opacity: 0.3 }}>💫</div>
        <div style={{ position: "absolute", bottom: "100px", right: "10%", fontSize: "22px", opacity: 0.4 }}>✨</div>

        {/* Back Button */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "30px" }}>
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
        </div>

        {/* Celebration Icon */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
            }}
          >
            🎉
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>You've Earned Interest!</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>Your savings have been working for you</p>
      </div>

      {/* CONTENT */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Total Interest Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "16px",
            color: "#FFFFFF",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-30px",
              right: "-30px",
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
            }}
          />

          <p style={{ margin: "0 0 4px 0", fontSize: "13px", opacity: 0.9 }}>Total Interest Earned</p>
          <p style={{ margin: "0 0 12px 0", fontSize: "48px", fontWeight: "700" }}>${totalInterest.toFixed(2)}</p>

          {/* Breakdown by goal */}
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
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
                  borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.2)" : "none",
                  marginTop: idx > 0 ? "8px" : 0,
                }}
              >
                <span style={{ fontSize: "13px", opacity: 0.9 }}>{goal.name}</span>
                <span style={{ fontSize: "14px", fontWeight: "600" }}>+${goal.interest.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Status badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255,255,255,0.2)",
              padding: "8px 14px",
              borderRadius: "20px",
              marginTop: "16px",
              fontSize: "13px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Ready to unlock
          </div>
        </div>

        {/* One Simple Step */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>
            One simple step
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#6B7280", lineHeight: 1.6 }}>
            To access your interest, we need to verify your identity. This is required by U.S. tax law for interest
            payments.
          </p>

          {/* What we accept */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {[
              { icon: "🇺🇸", label: "SSN" },
              { icon: "📋", label: "ITIN" },
              { icon: "🌍", label: "International ID" },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "10px 14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What You'll Unlock */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            What you'll unlock
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "💰", title: "Access your interest", desc: `Claim your $${totalInterest.toFixed(2)} now` },
              { icon: "📈", title: "Auto-deposit future interest", desc: "No more locked earnings" },
              { icon: "💳", title: "Unlimited withdrawals", desc: "No restrictions on your money" },
              { icon: "🌍", title: "Send money internationally", desc: "To family back home" },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  background: "#F0FDFB",
                  borderRadius: "10px",
                }}
              >
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>{item.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#047857" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Note */}
        <div
          style={{
            background: "#EFF6FF",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>
              Your information is protected
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#3B82F6", lineHeight: 1.5 }}>
              We only use your tax ID for IRS reporting. Your data is encrypted and never shared.
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTIONS */}
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
          onClick={() => console.log("Continue to verification")}
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
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Unlock My ${totalInterest.toFixed(2)}
        </button>
        <button
          onClick={() => console.log("Maybe later")}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "14px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "500",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          Maybe later — my interest will keep growing
        </button>
      </div>
    </div>
  )
}
