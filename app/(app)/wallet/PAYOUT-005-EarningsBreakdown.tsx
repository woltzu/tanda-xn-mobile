"use client"

export default function EarningsBreakdownScreen() {
  const earnings = {
    totalEarnings: 248.5,
    period: "All Time",
    breakdown: {
      payoutBonuses: 120.0,
      earlyPayerBonuses: 45.5,
      referralRewards: 50.0,
      interestEarned: 33.0,
    },
    history: [
      { id: 1, type: "Payout Bonus", circle: "Family Savings", amount: 24, date: "Jan 5, 2025" },
      { id: 2, type: "Early Payer", circle: "Family Savings", amount: 4, date: "Jan 1, 2025" },
      { id: 3, type: "Referral Reward", circle: null, amount: 25, date: "Dec 28, 2024" },
      { id: 4, type: "Payout Bonus", circle: "Holiday Fund", amount: 48, date: "Dec 20, 2024" },
      { id: 5, type: "Interest Earned", circle: null, amount: 8.5, date: "Dec 15, 2024" },
    ],
  }

  const periods = ["This Month", "Last 3 Months", "This Year", "All Time"]

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handlePeriodChange = (period: string) => {
    console.log("Change period to:", period)
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Earnings</h1>
        </div>

        {/* Total Earnings */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Total Earned ({earnings.period})</p>
          <p style={{ margin: 0, fontSize: "42px", fontWeight: "700", color: "#00C6AE" }}>
            ${earnings.totalEarnings.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Period Filter */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                background: earnings.period === period ? "#00C6AE" : "#FFFFFF",
                color: earnings.period === period ? "#FFFFFF" : "#6B7280",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Breakdown Card */}
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
            Earnings Breakdown
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                  }}
                >
                  💰
                </div>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Payout Bonuses</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                +${earnings.breakdown.payoutBonuses.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                  }}
                >
                  ⚡
                </div>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Early Payer Bonuses</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                +${earnings.breakdown.earlyPayerBonuses.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                  }}
                >
                  👥
                </div>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Referral Rewards</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                +${earnings.breakdown.referralRewards.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                  }}
                >
                  📈
                </div>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Interest Earned</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>
                +${earnings.breakdown.interestEarned.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Earnings History */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Recent Earnings
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {earnings.history.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                  }}
                >
                  {item.type.includes("Payout")
                    ? "💰"
                    : item.type.includes("Early")
                      ? "⚡"
                      : item.type.includes("Referral")
                        ? "👥"
                        : "📈"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{item.type}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                    {item.circle || "TandaXn"} • {item.date}
                  </p>
                </div>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>
                  +${item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Earn more:</strong> Pay early, refer friends, and complete all cycles to maximize your bonuses!
          </p>
        </div>
      </div>
    </div>
  )
}
