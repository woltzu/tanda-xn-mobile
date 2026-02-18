"use client"

export default function CommunityIntelligenceScreen() {
  const corridor = { from: "USD", to: "XAF", country: "Cameroon", flag: "🇨🇲" }
  const insights = {
    currentRate: 605.5,
    avgRate30d: 603.2,
    bestRateToday: 607.8,
    bestTimeToSend: "Tuesday mornings",
    communityVolume: "High",
    lastUpdated: "2 min ago",
  }
  const tips = [
    { id: 1, text: "Rates are typically 0.5% better on Tuesday and Wednesday mornings (EST)", votes: 234 },
    { id: 2, text: "Avoid sending on public holidays in Cameroon - delays are common", votes: 187 },
    { id: 3, text: "MTN MoMo is fastest for amounts under 200,000 XAF", votes: 156 },
  ]
  const recentActivity = [
    { user: "A***a", time: "2 min ago", amount: 150, country: "CM" },
    { user: "J***n", time: "5 min ago", amount: 200, country: "CM" },
    { user: "M***e", time: "12 min ago", amount: 100, country: "CM" },
  ]

  const handleBack = () => console.log("Back")
  const handleSendNow = () => console.log("Send Now")
  const handleSetAlert = () => console.log("Set Alert")

  const rateDiff = (((insights.currentRate - insights.avgRate30d) / insights.avgRate30d) * 100).toFixed(2)
  const isGoodRate = Number.parseFloat(rateDiff) > 0

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Community Insights</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              USD → {corridor.country} {corridor.flag}
            </p>
          </div>
        </div>

        {/* Rate Signal */}
        <div
          style={{
            background: isGoodRate ? "rgba(0,198,174,0.2)" : "rgba(217,119,6,0.2)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              background: isGoodRate ? "#00C6AE" : "#D97706",
              borderRadius: "20px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "14px" }}>{isGoodRate ? "📈" : "📉"}</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>
              {isGoodRate ? "Good time to send!" : "Wait for better rates"}
            </span>
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "28px", fontWeight: "700" }}>
            1 USD = {insights.currentRate} {corridor.to}
          </p>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>
            {isGoodRate ? "+" : ""}
            {rateDiff}% vs 30-day average • Updated {insights.lastUpdated}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Quick Stats */}
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
              padding: "14px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>{insights.bestRateToday}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Best Rate Today</p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "14px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              {insights.bestTimeToSend}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>Best Time to Send</p>
          </div>
        </div>

        {/* Community Tips */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>💡</span> Community Tips
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {tips.map((tip) => (
              <div
                key={tip.id}
                style={{
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "4px 8px",
                    background: "#E5E7EB",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  👍 {tip.votes}
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: 1.5, flex: 1 }}>{tip.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Activity */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#00C6AE",
                animation: "pulse 2s infinite",
              }}
            />
            Live Activity
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentActivity.map((activity, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>
                  {activity.user} sent ${activity.amount}
                </span>
                <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{activity.time}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "#6B7280", textAlign: "center" }}>
            Community volume: <strong style={{ color: "#00C6AE" }}>{insights.communityVolume}</strong>
          </p>
        </div>

        {/* Rate Alert */}
        <button
          onClick={handleSetAlert}
          style={{
            width: "100%",
            padding: "14px",
            background: "#0A2342",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Set Rate Alert</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
              Get notified when rates improve
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Send Now Button */}
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
          onClick={handleSendNow}
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
          Send Money Now
        </button>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}
