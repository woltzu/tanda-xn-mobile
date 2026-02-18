"use client"

export default function PromoReferralScreen() {
  const referralCode = "FRANCK25"
  const stats = {
    totalReferred: 7,
    pendingRewards: 15,
    earnedRewards: 35,
    successfulReferrals: 5,
  }
  const referrals = [
    { name: "Marie N.", status: "completed", reward: 10, date: "Dec 28, 2024" },
    { name: "Paul K.", status: "completed", reward: 10, date: "Dec 15, 2024" },
    { name: "Jean M.", status: "pending", reward: 0, date: "Jan 5, 2025" },
  ]

  const handleBack = () => console.log("Back")
  const handleShareCode = () => console.log("Share code")
  const handleCopyCode = () => console.log("Copy code")

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
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Refer & Earn</h1>
        </div>

        {/* Hero */}
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
              fontSize: "36px",
            }}
          >
            🎁
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>Give $10, Get $10</h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>
            Share your code with friends. When they send their first transfer, you both get $10 in transfer credits!
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Referral Code */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "2px solid #00C6AE",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Your Referral Code</p>
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "32px",
              fontWeight: "700",
              fontFamily: "monospace",
              letterSpacing: "4px",
              color: "#0A2342",
            }}
          >
            {referralCode}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleCopyCode}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </button>
            <button
              onClick={handleShareCode}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: "#00C6AE",
                fontSize: "14px",
                fontWeight: "600",
                color: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>${stats.earnedRewards}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Total Earned</p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#D97706" }}>${stats.pendingRewards}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Pending</p>
          </div>
        </div>

        {/* Referral History */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Your Referrals ({stats.totalReferred})
            </h3>
          </div>
          {referrals.length > 0 ? (
            referrals.map((ref, idx) => (
              <div
                key={idx}
                style={{
                  padding: "14px 16px",
                  borderBottom: idx < referrals.length - 1 ? "1px solid #F5F7FA" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{ref.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{ref.date}</p>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    background: ref.status === "completed" ? "#F0FDFB" : "#FEF3C7",
                    color: ref.status === "completed" ? "#00897B" : "#D97706",
                    fontSize: "11px",
                    fontWeight: "600",
                    borderRadius: "6px",
                  }}
                >
                  {ref.status === "completed" ? `+$${ref.reward}` : "Pending"}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No referrals yet</p>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "#F5F7FA",
            borderRadius: "14px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>How It Works</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              "Share your code with friends and family",
              "They sign up and enter your code",
              "When they complete their first transfer, you both get $10",
              "Your credit is applied to your next transfer",
            ].map((step, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#FFFFFF",
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#374151", lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Share Button */}
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
          onClick={handleShareCode}
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
          Share & Earn $10
        </button>
      </div>
    </div>
  )
}
