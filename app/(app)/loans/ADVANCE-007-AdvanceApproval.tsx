"use client"

export default function AdvanceApprovalScreen() {
  const advance = {
    id: "ADV-2025-0120-001",
    amount: 300,
    fee: 15,
    total: 315,
    disbursedTo: "TandaXn Wallet",
    disbursedAt: "Jan 20, 2025 at 2:34 PM",
    withholdingDate: "Feb 15, 2025",
    circleName: "Family Circle",
    payoutAmount: 500,
    remainingAfter: 185,
    rate: 9.5,
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
        {/* Success Animation Circle */}
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

        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "700" }}>Advance Approved!</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>Your funds are on the way</p>
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
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#6B7280" }}>Amount Disbursed</p>
          <p style={{ margin: "0 0 4px 0", fontSize: "42px", fontWeight: "700", color: "#0A2342" }}>
            ${advance.amount}
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "#00C6AE" }}>Sent to {advance.disbursedTo}</p>
        </div>

        {/* Details Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance ID</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{advance.id}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Disbursed</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{advance.disbursedAt}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance fee ({advance.rate}%)</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#D97706" }}>${advance.fee}</span>
            </div>
            <div style={{ height: "1px", background: "#E5E7EB" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total to repay</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>${advance.total}</span>
            </div>
          </div>
        </div>

        {/* Withholding Info */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(0,198,174,0.2)",
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
            <div>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Auto-Withholding Date</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                {advance.withholdingDate}
              </p>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>From {advance.circleName} payout</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>${advance.payoutAmount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Withheld for repayment</span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>-${advance.total}</span>
            </div>
            <div style={{ height: "1px", background: "rgba(255,255,255,0.2)", marginBottom: "8px" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>You'll receive</span>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>${advance.remainingAfter}</span>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #00C6AE",
          }}
        >
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#065F46" }}>
            ✅ What happens next
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              "Funds are now in your TandaXn Wallet",
              `On ${advance.withholdingDate}, $${advance.total} will be auto-withheld`,
              "No action needed — repayment is automatic",
            ].map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00C6AE" }} />
                <span style={{ fontSize: "12px", color: "#047857" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => console.log("View Advance")}
            style={{
              width: "100%",
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
              gap: "8px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            View Advance Details
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
