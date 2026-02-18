"use client"

export default function AgentDashboardScreen() {
  const agent = {
    name: "Express Money Akwa",
    id: "AGT-2025-001",
    status: "active",
    cashOnHand: 450000,
    currency: "XAF",
  }

  const stats = {
    todayPayouts: 12,
    todayVolume: 720000,
    todayCommission: 14400,
    monthPayouts: 156,
    monthCommission: 187200,
  }

  const pendingPayouts = [
    { id: "PO-001", code: "TXCP-7890-ABCD", recipient: "Françoise N.", amount: 121100, expiresIn: "2 hours" },
    { id: "PO-002", code: "TXCP-1234-EFGH", recipient: "Jean P.", amount: 90000, expiresIn: "4 hours" },
    { id: "PO-003", code: "TXCP-5678-IJKL", recipient: "Marie D.", amount: 60500, expiresIn: "6 hours" },
  ]

  const handleLogout = () => {
    console.log("Logout")
  }

  const handleProcessPayout = (payout: (typeof pendingPayouts)[0]) => {
    console.log("Process payout", payout)
  }

  const handleViewHistory = () => {
    console.log("View history")
  }

  const handleTopUp = () => {
    console.log("Top up cash")
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
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>Welcome back</p>
            <h1 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "700" }}>{agent.name}</h1>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "8px 12px",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        {/* Cash Status */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>Cash on Hand</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "28px", fontWeight: "700" }}>
              {agent.cashOnHand.toLocaleString()} <span style={{ fontSize: "14px" }}>{agent.currency}</span>
            </p>
          </div>
          <button
            onClick={handleTopUp}
            style={{
              padding: "10px 16px",
              background: "#00C6AE",
              border: "none",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            + Top Up
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Today Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "12px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{stats.todayPayouts}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Payouts Today</p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "12px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              {(stats.todayVolume / 1000).toFixed(0)}K
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Volume (XAF)</p>
          </div>
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "12px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
              {(stats.todayCommission / 1000).toFixed(1)}K
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Commission</p>
          </div>
        </div>

        {/* Pending Payouts */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            marginBottom: "16px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Pending Payouts ({pendingPayouts.length})
            </h3>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#00C6AE",
                animation: "pulse 2s infinite",
              }}
            />
          </div>

          {pendingPayouts.length > 0 ? (
            pendingPayouts.map((payout, idx) => (
              <div
                key={payout.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: idx < pendingPayouts.length - 1 ? "1px solid #F5F7FA" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {payout.recipient}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280", fontFamily: "monospace" }}>
                      {payout.code}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                      {payout.amount.toLocaleString()} XAF
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#D97706" }}>
                      Expires in {payout.expiresIn}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleProcessPayout(payout)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#00C6AE",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  Process Payout
                </button>
              </div>
            ))
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <span style={{ fontSize: "32px" }}>✓</span>
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No pending payouts</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <button
            onClick={handleViewHistory}
            style={{
              padding: "16px",
              background: "#0A2342",
              borderRadius: "14px",
              border: "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00C6AE"
              strokeWidth="2"
              style={{ marginBottom: "6px" }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>History</p>
          </button>
          <button
            style={{
              padding: "16px",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0A2342"
              strokeWidth="2"
              style={{ marginBottom: "6px" }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Support</p>
          </button>
        </div>

        {/* Monthly Summary */}
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "#F0FDFB",
            borderRadius: "14px",
            border: "1px solid #00C6AE",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#065F46" }}>
            This Month&apos;s Earnings
          </h3>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Payouts processed</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                {stats.monthPayouts}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Commission earned</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                {stats.monthCommission.toLocaleString()} XAF
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
