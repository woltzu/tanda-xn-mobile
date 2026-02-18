"use client"

export default function PayoutReceivedScreen() {
  const payout = {
    id: "PO-2025-0105-12345",
    amount: 1200,
    bonus: 24,
    total: 1224,
    circleName: "Family Savings Circle",
    cycleNumber: 3,
    date: "Jan 5, 2025",
    newBalance: 2074,
  }

  const handleViewDetails = () => {
    console.log("View payout details")
  }

  const handleWithdraw = () => {
    console.log("Navigate to withdraw funds")
  }

  const handleShare = () => {
    console.log("Share payout success")
  }

  const handleDone = () => {
    console.log("Return to dashboard")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Celebration Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        {/* Confetti Animation Placeholder */}
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
              fontSize: "36px",
            }}
          >
            🎉
          </div>
        </div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Payout Received!</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>Congratulations on your savings success</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Payout Amount Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#6B7280" }}>Total Received</p>
          <p style={{ margin: "0 0 4px 0", fontSize: "42px", fontWeight: "700", color: "#00C6AE" }}>
            ${payout.total.toLocaleString()}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Payout</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                ${payout.amount.toLocaleString()}
              </p>
            </div>
            <div style={{ width: "1px", background: "#E5E7EB" }} />
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Bonus</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "600", color: "#00C6AE" }}>
                +${payout.bonus}
              </p>
            </div>
          </div>
        </div>

        {/* Circle Info */}
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
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              👨‍👩‍👧‍👦
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{payout.circleName}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                Cycle {payout.cycleNumber} • {payout.date}
              </p>
            </div>
            <button
              onClick={handleViewDetails}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Details
            </button>
          </div>
        </div>

        {/* New Balance */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>New Wallet Balance</p>
          <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#FFFFFF" }}>
            ${payout.newBalance.toLocaleString()}
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleWithdraw}
            style={{
              flex: 1,
              padding: "14px",
              background: "#F0FDFB",
              borderRadius: "12px",
              border: "1px solid #00C6AE",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Withdraw</span>
          </button>
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              padding: "14px",
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Share</span>
          </button>
        </div>
      </div>

      {/* Done Button */}
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
          onClick={handleDone}
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
          Done
        </button>
      </div>
    </div>
  )
}
