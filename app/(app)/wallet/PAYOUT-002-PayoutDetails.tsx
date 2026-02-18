"use client"

export default function PayoutDetailsScreen() {
  const payout = {
    id: "PO-2025-0105-12345",
    circleName: "Family Savings Circle",
    cycleNumber: 3,
    totalCycles: 12,
    contributions: 1000,
    platformBonus: 20,
    earlyPayerBonus: 4,
    totalPayout: 1224,
    xnScoreEarned: 15,
    date: "Jan 5, 2025",
    time: "9:00 AM",
    status: "completed",
  }

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleDownloadReceipt = () => {
    console.log("Download receipt")
  }

  const handleViewCircle = () => {
    console.log("Navigate to circle details")
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payout Details</h1>
          </div>
          <span
            style={{
              background: "#00C6AE",
              color: "#FFFFFF",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            Completed
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-50px", padding: "0 20px" }}>
        {/* Amount Card */}
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
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              fontSize: "28px",
            }}
          >
            💰
          </div>
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#6B7280" }}>Total Payout</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>
            ${payout.totalPayout.toLocaleString()}
          </p>
        </div>

        {/* Breakdown */}
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
            Payout Breakdown
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Your Contributions</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                ${payout.contributions.toLocaleString()}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Platform Bonus (2%)</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>+${payout.platformBonus}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Early Payer Bonus</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>+${payout.earlyPayerBonus}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total</span>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                ${payout.totalPayout.toLocaleString()}
              </span>
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
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Circle Information
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Circle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{payout.circleName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Cycle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {payout.cycleNumber} of {payout.totalCycles}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Date & Time</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {payout.date} at {payout.time}
              </span>
            </div>
          </div>
          <button
            onClick={handleViewCircle}
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
              border: "none",
              fontSize: "13px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            View Circle →
          </button>
        </div>

        {/* XnScore Earned */}
        <div
          style={{
            background: "#0A2342",
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
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>XnScore Earned</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
              For completing this payout
            </p>
          </div>
          <span style={{ fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>+{payout.xnScoreEarned}</span>
        </div>

        {/* Reference */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Payout ID</p>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0A2342",
                fontFamily: "monospace",
              }}
            >
              {payout.id}
            </p>
          </div>
          <button
            onClick={handleDownloadReceipt}
            style={{
              padding: "8px 12px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "500",
              color: "#6B7280",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Receipt
          </button>
        </div>
      </div>
    </div>
  )
}
