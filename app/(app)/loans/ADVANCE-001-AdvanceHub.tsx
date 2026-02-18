"use client"

export default function AdvanceHubScreen() {
  const user = {
    name: "Franck",
    xnScore: 75,
    smc: 200,
    nextPayout: { amount: 500, date: "Feb 15, 2025", circleName: "Family Circle" },
    onTimePayments: 18,
    circlesCompleted: 2,
  }

  const advanceProducts = [
    {
      id: "contribution",
      name: "Contribution Cover",
      icon: "🛡️",
      tagline: "Never miss a contribution",
      description: "Cover your circle payment, auto-repay from next payout",
      maxAdvance: 500,
      advanceFee: "$5 flat",
      repayment: "Next payout",
      minScore: 50,
      state: "active",
      userRate: null,
    },
    {
      id: "quick",
      name: "Quick Advance",
      icon: "⚡",
      tagline: "Bridge to your next payout",
      description: "Advance up to 80% of your upcoming circle payout",
      maxAdvance: 400,
      advanceFee: "9.5%",
      repayment: "1-4 weeks",
      minScore: 65,
      state: "active",
      userRate: "9.5%",
    },
    {
      id: "flex",
      name: "Flex Advance",
      icon: "📊",
      tagline: "Larger amounts, flexible terms",
      description: "For bigger needs with 3-12 month repayment",
      maxAdvance: 2500,
      advanceFee: "From 8%",
      repayment: "3-12 months",
      minScore: 75,
      state: "preview",
      userRate: null,
      scoreNeeded: 75,
    },
    {
      id: "premium",
      name: "Premium Advance",
      icon: "💎",
      tagline: "Best rates for top performers",
      description: "Up to $5,000 at our lowest rates",
      maxAdvance: 5000,
      advanceFee: "From 6%",
      repayment: "Up to 24 months",
      minScore: 85,
      state: "locked",
      userRate: null,
      scoreNeeded: 85,
    },
  ]

  const getStateStyles = (state: string) => {
    switch (state) {
      case "active":
        return {
          bg: "#FFFFFF",
          border: "2px solid #00C6AE",
          opacity: 1,
          badge: { bg: "#00C6AE", text: "#FFFFFF", label: "ACTIVE ✅" },
        }
      case "preview":
        return {
          bg: "#FFFFFF",
          border: "1px solid #3B82F6",
          opacity: 1,
          badge: { bg: "#3B82F6", text: "#FFFFFF", label: "PREVIEW 👁️" },
        }
      case "locked":
        return {
          bg: "#F5F7FA",
          border: "1px solid #E5E7EB",
          opacity: 0.7,
          badge: { bg: "#6B7280", text: "#FFFFFF", label: "LOCKED 🔒" },
        }
      default:
        return { bg: "#FFFFFF", border: "1px solid #E5E7EB", opacity: 1 }
    }
  }

  const getProgressToUnlock = (minScore: number) => {
    const progress = Math.min((user.xnScore / minScore) * 100, 100)
    return progress
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Advance Payouts</h1>
        </div>

        {/* XnScore Display */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "3px solid #00C6AE",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>{user.xnScore}</p>
              <p style={{ margin: 0, fontSize: "9px", opacity: 0.8 }}>XnScore</p>
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600" }}>
              {user.xnScore >= 75
                ? "3 advances available!"
                : user.xnScore >= 65
                  ? "2 advances available"
                  : user.xnScore >= 50
                    ? "1 advance available"
                    : "Build your score to unlock"}
            </p>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>
              {user.circlesCompleted} circles completed • {user.onTimePayments} on-time payments
            </p>
            <button
              onClick={() => console.log("View improvement")}
              style={{
                marginTop: "8px",
                padding: "6px 12px",
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20V10M18 20V4M6 20v-4" />
              </svg>
              See improvement path
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Upcoming Payout Card */}
        {user.nextPayout && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Next Payout Available to Advance</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                  ${user.nextPayout.amount} on {user.nextPayout.date}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{user.nextPayout.circleName}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Advance up to</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                  ${Math.floor(user.nextPayout.amount * 0.8)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* What is an Advance? */}
        <button
          onClick={() => console.log("Learn more")}
          style={{
            width: "100%",
            padding: "14px",
            background: "#0A2342",
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>
              What is an "Advance Payout"?
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
              Not a loan — you're borrowing from your own future winnings
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Advance Products */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {advanceProducts.map((product) => {
            const styles = getStateStyles(product.state)
            const progress = product.scoreNeeded ? getProgressToUnlock(product.scoreNeeded) : 100

            return (
              <button
                key={product.id}
                onClick={() =>
                  product.state === "active" ? console.log("Select product", product) : console.log("Preview", product)
                }
                disabled={product.state === "locked"}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: styles.bg,
                  borderRadius: "16px",
                  border: styles.border,
                  cursor:
                    product.state === "active" ? "pointer" : product.state === "preview" ? "pointer" : "not-allowed",
                  textAlign: "left",
                  opacity: styles.opacity,
                  position: "relative",
                }}
              >
                {/* State Badge */}
                <div
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "16px",
                    background: styles.badge.bg,
                    color: styles.badge.text,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "10px",
                    fontWeight: "700",
                  }}
                >
                  {styles.badge.label}
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "14px",
                      background:
                        product.state === "active" ? "#F0FDFB" : product.state === "preview" ? "#EFF6FF" : "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "26px",
                      filter: product.state === "locked" ? "grayscale(100%)" : "none",
                    }}
                  >
                    {product.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>{product.name}</p>
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        fontSize: "12px",
                        color:
                          product.state === "active" ? "#00C6AE" : product.state === "preview" ? "#3B82F6" : "#6B7280",
                        fontWeight: "600",
                      }}
                    >
                      {product.tagline}
                    </p>
                    <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.4 }}>
                      {product.description}
                    </p>

                    {/* Stats Row */}
                    <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "10px", color: "#9CA3AF" }}>Max Advance</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                          Up to ${product.maxAdvance.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "10px", color: "#9CA3AF" }}>Advance Fee</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                          {product.state === "active" && product.userRate ? product.userRate : product.advanceFee}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "10px", color: "#9CA3AF" }}>Repayment</p>
                        <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                          {product.repayment}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar for Locked/Preview */}
                    {(product.state === "locked" || product.state === "preview") && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "11px", color: "#6B7280" }}>XnScore progress to unlock</span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              color: product.state === "preview" ? "#3B82F6" : "#6B7280",
                            }}
                          >
                            {user.xnScore}/{product.scoreNeeded}
                          </span>
                        </div>
                        <div style={{ height: "6px", background: "#E5E7EB", borderRadius: "3px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${progress}%`,
                              height: "100%",
                              background: product.state === "preview" ? "#3B82F6" : "#9CA3AF",
                              borderRadius: "3px",
                            }}
                          />
                        </div>
                        <p
                          style={{
                            margin: "6px 0 0 0",
                            fontSize: "11px",
                            color: product.state === "preview" ? "#3B82F6" : "#6B7280",
                          }}
                        >
                          {product.state === "preview"
                            ? `Increase your XnScore by ${product.scoreNeeded! - user.xnScore} points to unlock`
                            : `Make ${Math.ceil((product.scoreNeeded! - user.xnScore) / 2)} more on-time payments to reach ${product.scoreNeeded}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {product.state === "active" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Comparison Note */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
            border: "1px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00897B" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>Why TandaXn Advances?</p>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#047857", lineHeight: 1.5 }}>
            <strong>Local money lender: 15-25%</strong> | <strong>Payday lender: 400%+</strong> |{" "}
            <strong>TandaXn: From 6%</strong>
            <br />
            Plus, repayment is automatic from your payout — no stress, no collectors.
          </p>
        </div>
      </div>
    </div>
  )
}
