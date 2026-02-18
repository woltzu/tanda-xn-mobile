"use client"

export default function WithdrawalSuccessScreen() {
  const withdrawal = {
    id: "WD-2025-0101-54321",
    amount: 500,
    account: "Chase Bank •••• 4532",
    estimatedArrival: "Jan 3-5, 2025",
    newBalance: 350,
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
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
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
        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Withdrawal Initiated! 🎉</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>
          ${withdrawal.amount.toFixed(2)} on its way to your bank
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
              <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#0A2342" }}>
                ${withdrawal.amount.toFixed(2)}
              </p>
            </div>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>To</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{withdrawal.account}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Expected Arrival</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                {withdrawal.estimatedArrival}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Transaction ID</span>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#6B7280", fontFamily: "monospace" }}>
                {withdrawal.id}
              </span>
            </div>
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
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
            Remaining Wallet Balance
          </p>
          <p style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "#FFFFFF" }}>
            ${withdrawal.newBalance.toFixed(2)}
          </p>
        </div>

        {/* Timeline */}
        <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "16px", border: "1px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What Happens Next
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { step: 1, title: "Withdrawal initiated", desc: "We're processing your request", done: true },
              { step: 2, title: "Funds sent to bank", desc: "Within 1 business day", done: false },
              { step: 3, title: "Arrives in your account", desc: withdrawal.estimatedArrival, done: false },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: item.done ? "#00C6AE" : "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#6B7280" }}>{item.step}</span>
                  )}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{item.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
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
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={() => console.log("View Wallet")}
          style={{
            flex: 1,
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            fontSize: "16px",
            fontWeight: "600",
            color: "#0A2342",
            cursor: "pointer",
          }}
        >
          View Wallet
        </button>
        <button
          onClick={() => console.log("Done")}
          style={{
            flex: 1,
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
