"use client"

export default function ContributionSuccessScreen() {
  const contribution = {
    id: "contrib_12345",
    circleName: "Family Savings",
    amount: 200,
    cycle: 3,
    date: "Jan 5, 2025",
    time: "2:34 PM",
    paymentMethod: "TandaXn Wallet",
    transactionId: "TXN-2025-0105-12345",
  }
  const circleStats = {
    totalContributed: 600,
    cyclesCompleted: 3,
    nextPayout: "Feb 15, 2025",
  }
  const xnScoreBonus = 2

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Success Header - Navy gradient */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        {/* Success Animation */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto",
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
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Contribution Sent! 🎉</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>
          ${contribution.amount} to {contribution.circleName}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Transaction Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              paddingBottom: "16px",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6B7280" }}>Amount</p>
              <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>${contribution.amount}</p>
            </div>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
              }}
            >
              ✓
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Circle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{contribution.circleName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Cycle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{contribution.cycle}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Date & Time</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {contribution.date} at {contribution.time}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Payment Method</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {contribution.paymentMethod}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Transaction ID</span>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#6B7280", fontFamily: "monospace" }}>
                {contribution.transactionId}
              </span>
            </div>
          </div>
        </div>

        {/* XnScore Bonus */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            ⭐
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>XnScore Bonus!</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              On-time payment earned you +{xnScoreBonus} points
            </p>
          </div>
          <span style={{ fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>+{xnScoreBonus}</span>
        </div>

        {/* Circle Stats */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Your Progress</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1, padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${circleStats.totalContributed}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Total Contributed</p>
            </div>
            <div style={{ flex: 1, padding: "12px", background: "#F5F7FA", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                {circleStats.cyclesCompleted}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Cycles Paid</p>
            </div>
          </div>
        </div>

        {/* Next Payout Info */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            💰
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Your Payout is Coming</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
              Scheduled for {circleStats.nextPayout}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          onClick={() => console.log("View Circle")}
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
          View Circle
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => console.log("Share Receipt")}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
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
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
          <button
            onClick={() => console.log("Done")}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
