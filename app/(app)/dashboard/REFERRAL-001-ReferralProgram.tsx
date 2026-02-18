"use client"

import { TabBarInline } from "../../../components/TabBar"

export default function ReferralProgramScreen() {
  const referralCode = "FRANCK25"
  const referrals = {
    total: 5,
    pending: 2,
    earned: 50.0,
  }

  const handleBack = () => {
    console.log("Going back...")
  }

  const handleShareCode = () => {
    console.log("Sharing referral code:", referralCode)
    // Share code via native share or copy to clipboard
  }

  const handleViewReferrals = () => {
    console.log("Viewing referrals list...")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Invite Friends</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Earn $10 for each friend</p>
          </div>
        </div>

        {/* Earnings */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Total Earned</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>${referrals.earned.toFixed(2)}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Referral Code Card */}
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
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Your Referral Code</p>
          <div
            style={{
              padding: "16px",
              background: "#F0FDFB",
              borderRadius: "12px",
              border: "2px dashed #00C6AE",
              marginBottom: "16px",
            }}
          >
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE", letterSpacing: "4px" }}>
              {referralCode}
            </p>
          </div>
          <button
            onClick={handleShareCode}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "#00C6AE",
              fontSize: "15px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Code
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: "700", color: "#0A2342" }}>
              {referrals.total}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Total</p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: "700", color: "#D97706" }}>
              {referrals.pending}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Pending</p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
              ${referrals.earned}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Earned</p>
          </div>
        </div>

        {/* How It Works */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>How It Works</h3>
          {[
            { step: "1", icon: "📤", text: "Share your unique code with friends" },
            { step: "2", icon: "👤", text: "They sign up and verify their account" },
            { step: "3", icon: "💰", text: "You both get $10 when they make first deposit" },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
                borderBottom: idx < 2 ? "1px solid #F5F7FA" : "none",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                {item.icon}
              </div>
              <span style={{ fontSize: "13px", color: "#0A2342" }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* View Referrals */}
        <button
          onClick={handleViewReferrals}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "14px",
            fontWeight: "500",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          View My Referrals →
        </button>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
