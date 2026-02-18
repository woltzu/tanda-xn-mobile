"use client"

export default function RepaymentConfirmScreen() {
  const repayment = {
    advanceId: "ADV-2025-0120-001",
    amountPaid: 310,
    feeSaved: 5,
    paidFrom: "TandaXn Wallet",
    paidAt: "Jan 25, 2025 at 3:42 PM",
    xnScoreBonus: 4,
    newXnScore: 82,
    previousXnScore: 78,
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
      {/* Success Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #00C6AE 0%, #00897B 100%)",
          padding: "40px 20px 100px 20px",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {/* Success Animation */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>Advance Paid Off!</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Your advance is now closed</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
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
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#6B7280" }}>Amount Paid</p>
          <p style={{ margin: "0 0 8px 0", fontSize: "42px", fontWeight: "700", color: "#0A2342" }}>
            ${repayment.amountPaid}
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "#00C6AE" }}>From {repayment.paidFrom}</p>
        </div>

        {/* Savings & XnScore */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          {/* Savings */}
          <div
            style={{
              flex: 1,
              background: "#F0FDFB",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
              border: "1px solid #00C6AE",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px auto",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "700", color: "#065F46" }}>
              ${repayment.feeSaved}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#047857" }}>Fees Saved</p>
          </div>

          {/* XnScore Bonus */}
          <div
            style={{
              flex: 1,
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 8px auto",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              +{repayment.xnScoreBonus}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>XnScore Bonus</p>
          </div>
        </div>

        {/* XnScore Progress */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Your XnScore</p>
            <p style={{ margin: 0, fontSize: "13px", color: "#00C6AE" }}>
              {repayment.previousXnScore} → {repayment.newXnScore}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(0,198,174,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "3px solid #00C6AE",
              }}
            >
              <span style={{ fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>{repayment.newXnScore}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: "8px",
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: "4px",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    width: `${repayment.newXnScore}%`,
                    height: "100%",
                    background: "#00C6AE",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                Early repayment earned you{" "}
                <span style={{ color: "#00C6AE", fontWeight: "600" }}>+{repayment.xnScoreBonus} points</span>
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
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
            Repayment Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance ID</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{repayment.advanceId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Paid at</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{repayment.paidAt}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Status</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#166534",
                  background: "#F0FDF4",
                  padding: "4px 10px",
                  borderRadius: "6px",
                }}
              >
                Closed ✓
              </span>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            border: "1px solid #00C6AE",
          }}
        >
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#065F46" }}>✅ What's next</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              "Your advance is now closed",
              "Your full payout will be available on payout date",
              "You're eligible for new advances immediately",
              "Your improved XnScore may qualify you for better rates",
            ].map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00C6AE" }} />
                <span style={{ fontSize: "12px", color: "#047857" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={() => console.log("View History")}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            View History
          </button>
          <button
            onClick={() => console.log("New Advance")}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "#0A2342",
              fontSize: "13px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            New Advance
          </button>
        </div>
      </div>

      {/* Bottom CTA */}
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
          onClick={() => console.log("Go Home")}
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
