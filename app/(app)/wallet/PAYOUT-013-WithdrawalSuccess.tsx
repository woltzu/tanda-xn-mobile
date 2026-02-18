"use client"

export default function WithdrawalSuccessScreen() {
  const withdrawal = {
    id: "WD-2025-0110-12345",
    amount: 1000,
    fee: 0,
    total: 1000,
    account: "Chase Bank",
    last4: "4532",
    speed: "standard",
    estimatedArrival: "Jan 12-14, 2025",
    initiatedAt: "Jan 10, 2025 at 2:30 PM",
  }

  const remainingBalance = 1074

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
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative elements */}
        <div style={{ position: "absolute", top: "20px", left: "10%", fontSize: "20px", opacity: 0.4 }}>✨</div>
        <div style={{ position: "absolute", top: "60px", right: "15%", fontSize: "16px", opacity: 0.3 }}>💫</div>
        <div style={{ position: "absolute", bottom: "80px", left: "20%", fontSize: "18px", opacity: 0.3 }}>✨</div>

        {/* Success Icon */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
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
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Withdrawal Initiated!</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>Your money is on its way</p>
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
          <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#6B7280" }}>Amount Sent</p>
          <p style={{ margin: "0 0 16px 0", fontSize: "42px", fontWeight: "700", color: "#059669" }}>
            ${withdrawal.total.toLocaleString()}
          </p>

          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "12px",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#0A2342",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{withdrawal.account}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>••••{withdrawal.last4}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
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
            What happens next
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#059669" }}>Initiated</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{withdrawal.initiatedAt}</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFFFFF" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Processing</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>In progress...</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: "600" }}>3</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#9CA3AF" }}>Arrives in bank</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{withdrawal.estimatedArrival}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Remaining Balance */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Remaining Balance</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>
              ${remainingBalance.toLocaleString()}
            </p>
          </div>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            💳
          </div>
        </div>

        {/* Reference ID */}
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
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Transaction ID</p>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0A2342",
                fontFamily: "monospace",
              }}
            >
              {withdrawal.id}
            </p>
          </div>
          <button
            style={{
              padding: "8px 12px",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "500",
              color: "#6B7280",
              cursor: "pointer",
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Bottom Actions */}
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
          onClick={() => console.log("Done")}
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
            marginBottom: "10px",
          }}
        >
          Done
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => console.log("Track Status")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Track Status
          </button>
          <button
            onClick={() => console.log("Share Receipt")}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Share Receipt
          </button>
        </div>
      </div>
    </div>
  )
}
