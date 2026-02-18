"use client"

export default function WithdrawalProcessingScreen() {
  const withdrawal = {
    id: "WD-2025-0105-67890",
    amount: 1000,
    fee: 0,
    total: 1000,
    account: "Chase Bank •••• 4532",
    speed: "standard",
    status: "processing",
    estimatedArrival: "Jan 7-9, 2025",
    initiatedAt: "Jan 5, 2025 at 10:30 AM",
  }

  const steps = [
    { id: 1, title: "Withdrawal initiated", status: "completed", time: withdrawal.initiatedAt },
    {
      id: 2,
      title: "Processing",
      status: withdrawal.status === "initiated" ? "pending" : "completed",
      time: "In progress",
    },
    {
      id: 3,
      title: "Sent to bank",
      status: ["initiated", "processing"].includes(withdrawal.status) ? "pending" : "completed",
      time: withdrawal.status === "sent" ? "Just now" : "",
    },
    {
      id: 4,
      title: "Arrives in account",
      status: withdrawal.status === "completed" ? "completed" : "pending",
      time: withdrawal.estimatedArrival,
    },
  ]

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleDone = () => {
    console.log("Done with withdrawal status")
  }

  const handleContactSupport = () => {
    console.log("Contact support")
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Withdrawal Status</h1>
        </div>

        {/* Amount */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.8 }}>Withdrawing</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>${withdrawal.total.toLocaleString()}</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "13px", opacity: 0.8 }}>To {withdrawal.account}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Status Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 20px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Transfer Progress
          </h3>

          <div style={{ position: "relative" }}>
            {steps.map((step, idx) => (
              <div
                key={step.id}
                style={{ display: "flex", gap: "16px", marginBottom: idx < steps.length - 1 ? "24px" : 0 }}
              >
                {/* Line and Dot */}
                <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background:
                        step.status === "completed" ? "#00C6AE" : step.status === "current" ? "#0A2342" : "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 1,
                    }}
                  >
                    {step.status === "completed" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: step.status === "current" ? "#00C6AE" : "#9CA3AF",
                        }}
                      />
                    )}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "32px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "2px",
                        height: "24px",
                        background:
                          steps[idx + 1].status === "completed" || steps[idx + 1].status === "current"
                            ? "#00C6AE"
                            : "#E5E7EB",
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: "4px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: "600",
                      color: step.status === "pending" ? "#9CA3AF" : "#0A2342",
                    }}
                  >
                    {step.title}
                  </p>
                  {step.time && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{step.time}</p>}
                </div>
              </div>
            ))}
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
            Transfer Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Amount</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                ${withdrawal.amount.toFixed(2)}
              </span>
            </div>
            {withdrawal.fee > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Fee</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#D97706" }}>
                  -${withdrawal.fee.toFixed(2)}
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Speed</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342", textTransform: "capitalize" }}>
                {withdrawal.speed}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Transaction ID</span>
              <span style={{ fontSize: "11px", fontWeight: "500", color: "#6B7280", fontFamily: "monospace" }}>
                {withdrawal.id}
              </span>
            </div>
          </div>
        </div>

        {/* Help */}
        <button
          onClick={handleContactSupport}
          style={{
            width: "100%",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Need help? Contact support</span>
        </button>
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
