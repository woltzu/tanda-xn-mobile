"use client"

export default function AboutAppScreen() {
  const appInfo = {
    version: "2.5.0",
    build: "250115",
    lastUpdated: "January 2025",
  }

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleTermsOfService = () => {
    console.log("Open Terms of Service")
  }

  const handlePrivacyPolicy = () => {
    console.log("Open Privacy Policy")
  }

  const handleLicenses = () => {
    console.log("Open Open Source Licenses")
  }

  const handleRateApp = () => {
    console.log("Rate app on App Store")
  }

  const handleShareApp = () => {
    console.log("Share app with friends")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>About TandaXn</h1>
        </div>

        {/* Logo & Tagline */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              boxShadow: "0 4px 20px rgba(0,198,174,0.3)",
            }}
          >
            <span style={{ fontSize: "36px", fontWeight: "700", color: "#FFFFFF" }}>Xn</span>
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "700" }}>TandaXn</h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>Dream it! Save it! Achieve!</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Version Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Version</p>
          <p style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
            {appInfo.version}
          </p>
          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
            Build {appInfo.build} • Updated {appInfo.lastUpdated}
          </p>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <button
            onClick={handleRateApp}
            style={{
              width: "100%",
              padding: "16px",
              background: "#FFFFFF",
              border: "none",
              borderBottom: "1px solid #F5F7FA",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#D97706" stroke="#D97706" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Rate TandaXn</p>
              <p style={{ margin: "1px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Leave a review on the App Store</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <button
            onClick={handleShareApp}
            style={{
              width: "100%",
              padding: "16px",
              background: "#FFFFFF",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Share TandaXn</p>
              <p style={{ margin: "1px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Invite friends to save together</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Legal */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {[
            { label: "Terms of Service", action: handleTermsOfService },
            { label: "Privacy Policy", action: handlePrivacyPolicy },
            { label: "Open Source Licenses", action: handleLicenses },
          ].map((item, idx, arr) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: "100%",
                padding: "16px",
                background: "#FFFFFF",
                border: "none",
                borderBottom: idx < arr.length - 1 ? "1px solid #F5F7FA" : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "14px", color: "#0A2342" }}>{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        {/* Company Info */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>TandaXn, LLC</p>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Delaware, USA</p>
          <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
            TandaXn is not a bank. Funds are safeguarded with licensed partners. Investment products carry risk. See
            Terms for details.
          </p>
        </div>

        {/* Copyright */}
        <p style={{ margin: "20px 0 0 0", textAlign: "center", fontSize: "11px", color: "#9CA3AF" }}>
          © 2026-2025 TandaXn, LLC. All rights reserved.
        </p>
      </div>
    </div>
  )
}
