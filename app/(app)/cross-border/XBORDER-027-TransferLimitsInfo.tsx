"use client"

export default function TransferLimitsInfoScreen() {
  const limits = {
    current: {
      perTransaction: 2000,
      daily: 5000,
      monthly: 20000,
    },
    used: {
      daily: 450,
      monthly: 1850,
    },
    verificationLevel: "basic",
    nextLevel: "enhanced",
  }

  const dailyRemaining = limits.current.daily - limits.used.daily
  const monthlyRemaining = limits.current.monthly - limits.used.monthly
  const dailyPercent = (limits.used.daily / limits.current.daily) * 100
  const monthlyPercent = (limits.used.monthly / limits.current.monthly) * 100

  const verificationLevels = [
    {
      id: "basic",
      name: "Basic",
      perTxn: 2000,
      daily: 5000,
      monthly: 20000,
      requirements: ["Email verified", "Phone verified"],
      complete: true,
    },
    {
      id: "enhanced",
      name: "Enhanced",
      perTxn: 10000,
      daily: 25000,
      monthly: 100000,
      requirements: ["Government ID", "Proof of address"],
      complete: false,
    },
    {
      id: "premium",
      name: "Premium",
      perTxn: 50000,
      daily: 100000,
      monthly: 500000,
      requirements: ["Source of funds", "Business verification"],
      complete: false,
    },
  ]

  const handleBack = () => console.log("Back")
  const handleVerifyIdentity = () => console.log("Verify Identity")
  const handleContactSupport = () => console.log("Contact Support")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Transfer Limits</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              Level: {limits.verificationLevel.charAt(0).toUpperCase() + limits.verificationLevel.slice(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Current Usage */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Your Current Usage
          </h3>

          {/* Daily */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Daily</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                ${limits.used.daily.toLocaleString()} / ${limits.current.daily.toLocaleString()}
              </span>
            </div>
            <div style={{ height: "8px", background: "#E5E7EB", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${dailyPercent}%`,
                  background: dailyPercent > 80 ? "#D97706" : "#00C6AE",
                  borderRadius: "4px",
                }}
              />
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
              ${dailyRemaining.toLocaleString()} remaining today
            </p>
          </div>

          {/* Monthly */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Monthly</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                ${limits.used.monthly.toLocaleString()} / ${limits.current.monthly.toLocaleString()}
              </span>
            </div>
            <div style={{ height: "8px", background: "#E5E7EB", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${monthlyPercent}%`,
                  background: monthlyPercent > 80 ? "#D97706" : "#00C6AE",
                  borderRadius: "4px",
                }}
              />
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
              ${monthlyRemaining.toLocaleString()} remaining this month
            </p>
          </div>
        </div>

        {/* Current Limits */}
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
            Your Current Limits
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${(limits.current.perTransaction / 1000).toFixed(0)}K
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Per Transfer</p>
            </div>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${(limits.current.daily / 1000).toFixed(0)}K
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Daily</p>
            </div>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${(limits.current.monthly / 1000).toFixed(0)}K
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Monthly</p>
            </div>
          </div>
        </div>

        {/* Increase Limits */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px", borderBottom: "1px solid #E5E7EB" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Increase Your Limits</h3>
          </div>
          {verificationLevels.map((level, idx) => (
            <div
              key={level.id}
              style={{
                padding: "14px 16px",
                borderBottom: idx < verificationLevels.length - 1 ? "1px solid #F5F7FA" : "none",
                background: level.complete ? "#F0FDFB" : "#FFFFFF",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {level.complete ? (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
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
                  ) : (
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: "2px solid #E5E7EB",
                      }}
                    />
                  )}
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{level.name}</span>
                </div>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>
                  Up to ${(level.monthly / 1000).toFixed(0)}K/mo
                </span>
              </div>
              <p style={{ margin: "0 0 0 28px", fontSize: "11px", color: "#6B7280" }}>
                Requires: {level.requirements.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Verify Button */}
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
          onClick={handleVerifyIdentity}
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
          Increase My Limits
        </button>
      </div>
    </div>
  )
}
