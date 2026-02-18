"use client"

export default function RecurringListScreen() {
  const recurringTransfers = [
    {
      id: "REC-001",
      recipient: { name: "Mama Françoise", flag: "🇨🇲" },
      amount: 100,
      frequency: "Monthly",
      nextDate: "Feb 1, 2025",
      status: "active",
      totalSent: 300,
      transferCount: 3,
    },
    {
      id: "REC-002",
      recipient: { name: "Papa Jean", flag: "🇨🇲" },
      amount: 50,
      frequency: "Every 2 weeks",
      nextDate: "Jan 15, 2025",
      status: "active",
      totalSent: 100,
      transferCount: 2,
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Recurring Transfers</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {recurringTransfers.filter((r) => r.status === "active").length} active
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {recurringTransfers.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {recurringTransfers.map((recurring) => (
              <div
                key={recurring.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        background: "#0A2342",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        color: "#FFFFFF",
                        fontWeight: "600",
                      }}
                    >
                      {recurring.recipient.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                        {recurring.recipient.name} {recurring.recipient.flag}
                      </p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{recurring.frequency}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                      ${recurring.amount}
                    </p>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: recurring.status === "active" ? "#F0FDFB" : "#FEF3C7",
                        color: recurring.status === "active" ? "#00897B" : "#D97706",
                        fontSize: "10px",
                        fontWeight: "600",
                        borderRadius: "4px",
                      }}
                    >
                      {recurring.status === "active" ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>

                {/* Next & Stats */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                  <div style={{ flex: 1, padding: "10px", background: "#F5F7FA", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>Next transfer</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                      {recurring.nextDate}
                    </p>
                  </div>
                  <div style={{ flex: 1, padding: "10px", background: "#F5F7FA", borderRadius: "8px" }}>
                    <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>Total sent</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                      ${recurring.totalSent} ({recurring.transferCount}x)
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0A2342",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "none",
                      background: recurring.status === "active" ? "#FEF3C7" : "#F0FDFB",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: recurring.status === "active" ? "#D97706" : "#00897B",
                      cursor: "pointer",
                    }}
                  >
                    {recurring.status === "active" ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              No Recurring Transfers
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
              Set up automatic transfers to family back home
            </p>
          </div>
        )}

        {/* Tip */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Never forget to send money home. Recurring transfers ensure your family receives support on time, every
            time.
          </p>
        </div>
      </div>

      {/* Add New Button */}
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
          Set Up New Recurring Transfer
        </button>
      </div>
    </div>
  )
}
