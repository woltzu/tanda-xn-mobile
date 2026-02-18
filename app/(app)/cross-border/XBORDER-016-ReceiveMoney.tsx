"use client"

export default function ReceiveMoneyScreen() {
  const pendingTransfers = [
    {
      id: "IN-001",
      sender: { name: "Brother Marcel", flag: "🇫🇷", country: "France" },
      amount: 150,
      currency: "USD",
      status: "arriving",
      eta: "Today by 5 PM",
    },
  ]

  const receivedTransfers = [
    {
      id: "IN-002",
      sender: { name: "Sister Claire", flag: "🇫🇷", country: "France" },
      amount: 100,
      currency: "USD",
      receivedAt: "Dec 28, 2024",
    },
    {
      id: "IN-003",
      sender: { name: "Cousin Pierre", flag: "🇨🇦", country: "Canada" },
      amount: 75,
      currency: "USD",
      receivedAt: "Dec 15, 2024",
    },
  ]

  const totalReceived = 325

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Receive Money</h1>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>${totalReceived}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Total Received</p>
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
              {pendingTransfers.length}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", opacity: 0.8 }}>On the Way</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Pending Transfers */}
        {pendingTransfers.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "2px solid #00C6AE",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: "#00897B",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#00C6AE",
                  animation: "pulse 2s infinite",
                }}
              />
              On the Way
            </h3>
            {pendingTransfers.map((transfer) => (
              <button
                key={transfer.id}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#F0FDFB",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    From {transfer.sender.name} {transfer.sender.flag}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#00897B" }}>{transfer.eta}</p>
                </div>
                <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>+${transfer.amount}</p>
              </button>
            ))}
          </div>
        )}

        {/* Received Transfers */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB" }}>
            <h3 style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>RECEIVED</h3>
          </div>
          {receivedTransfers.length > 0 ? (
            receivedTransfers.map((transfer, idx) => (
              <button
                key={transfer.id}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "#FFFFFF",
                  border: "none",
                  borderBottom: idx < receivedTransfers.length - 1 ? "1px solid #F5F7FA" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  {transfer.sender.flag}
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    {transfer.sender.name}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{transfer.receivedAt}</p>
                </div>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#00C6AE" }}>+${transfer.amount}</p>
              </button>
            ))
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No transfers received yet</p>
            </div>
          )}
        </div>

        {/* Share Your Details */}
        <button
          style={{
            width: "100%",
            padding: "16px",
            background: "#0A2342",
            borderRadius: "14px",
            border: "none",
            cursor: "pointer",
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
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#FFFFFF" }}>Share Your Details</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
              Let family send money to you
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
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
