"use client"

export default function PayoutDetailsScreen() {
  const payout = {
    id: "payout_123",
    circleName: "Family Savings",
    cycle: 2,
    member: "Kwame Mensah",
    memberAvatar: "K",
    amount: 1200,
    status: "completed",
    scheduledDate: "Dec 15, 2024",
    completedDate: "Dec 15, 2024",
    completedTime: "3:45 PM",
    transactionId: "PAY-2024-1215-54321",
    contributions: [
      { member: "Franck (You)", avatar: "F", amount: 200, date: "Dec 5" },
      { member: "Amara O.", avatar: "A", amount: 200, date: "Dec 3" },
      { member: "Kwame M.", avatar: "K", amount: 200, date: "Dec 4" },
      { member: "Marie C.", avatar: "M", amount: 200, date: "Dec 2" },
      { member: "David N.", avatar: "D", amount: 200, date: "Dec 6" },
      { member: "Samuel O.", avatar: "S", amount: 200, date: "Dec 5" },
    ],
  }

  const isMyPayout = false

  const getStatusStyle = () => {
    switch (payout.status) {
      case "completed":
        return { bg: "#F0FDFB", color: "#00897B", label: "Completed" }
      case "upcoming":
        return { bg: "#FEF3C7", color: "#D97706", label: "Next Payout" }
      case "scheduled":
        return { bg: "#F5F7FA", color: "#6B7280", label: "Scheduled" }
      default:
        return { bg: "#F5F7FA", color: "#6B7280", label: payout.status }
    }
  }

  const statusStyle = getStatusStyle()

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payout Details</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {payout.circleName} • Cycle {payout.cycle}
            </p>
          </div>
          <span
            style={{
              background: statusStyle.bg,
              color: statusStyle.color,
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            {statusStyle.label}
          </span>
        </div>

        {/* Recipient Card */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: isMyPayout ? "#00C6AE" : "#FFFFFF",
              color: isMyPayout ? "#FFFFFF" : "#0A2342",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontWeight: "700",
              fontSize: "28px",
            }}
          >
            {payout.memberAvatar}
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700" }}>
            {payout.member}
            {isMyPayout && <span style={{ color: "#00C6AE" }}> (You)</span>}
          </h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", opacity: 0.8 }}>Payout Recipient</p>
          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Payout Amount</p>
            <p style={{ margin: 0, fontSize: "36px", fontWeight: "700", color: "#00C6AE" }}>
              ${payout.amount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-20px", padding: "0 20px" }}>
        {/* Transaction Details */}
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
            {payout.status === "completed" ? "Transaction Details" : "Schedule Details"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {payout.status === "completed" ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Completed</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                    {payout.completedDate} at {payout.completedTime}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Transaction ID</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#6B7280",
                      fontFamily: "monospace",
                    }}
                  >
                    {payout.transactionId}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Scheduled Date</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{payout.scheduledDate}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Circle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{payout.circleName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Cycle</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{payout.cycle}</span>
            </div>
          </div>
        </div>

        {/* Contributions Breakdown */}
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
            Contributions ({payout.contributions.length})
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {payout.contributions.map((contrib, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  background: contrib.member.includes("You") ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: contrib.member.includes("You") ? "#00C6AE" : "#0A2342",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  {contrib.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{contrib.member}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{contrib.date}</p>
                </div>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>${contrib.amount}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total Pot</span>
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
              ${payout.amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Contact Option */}
        {!isMyPayout && (
          <button
            onClick={() => console.log("Contact member")}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Message {payout.member.split(" ")[0]}
            </span>
          </button>
        )}

        {/* How Payouts Work */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
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
            Each cycle, all {payout.contributions.length} members contribute equally. The full pot goes to the scheduled
            recipient. Everyone receives exactly what they contributed over the full cycle.
          </p>
        </div>
      </div>
    </div>
  )
}
