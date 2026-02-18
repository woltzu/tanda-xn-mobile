"use client"

export default function PaymentReminderScreen() {
  const reminder = {
    advanceId: "ADV-2025-0120-001",
    amountDue: 315,
    withholdingDate: "Feb 15, 2025",
    circleName: "Family Circle",
    payoutAmount: 500,
    remainingAfter: 185,
    daysUntil: 3,
    urgency: "upcoming" as const, // overdue, due_today, upcoming
  }

  const walletBalance = 450

  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case "overdue":
        return {
          bg: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
          icon: "🚨",
          label: "OVERDUE",
          labelBg: "#FEE2E2",
          labelColor: "#DC2626",
        }
      case "due_today":
        return {
          bg: "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
          icon: "⏰",
          label: "DUE TODAY",
          labelBg: "#FEF3C7",
          labelColor: "#D97706",
        }
      default:
        return {
          bg: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          icon: "📅",
          label: "UPCOMING",
          labelBg: "#F0FDFB",
          labelColor: "#00C6AE",
        }
    }
  }

  const style = getUrgencyStyle(reminder.urgency)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: style.bg,
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
          <button
            onClick={() => console.log("Dismiss")}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: "50%",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "48px" }}>{style.icon}</span>
          <span
            style={{
              display: "inline-block",
              marginLeft: "12px",
              background: style.labelBg,
              color: style.labelColor,
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "700",
              verticalAlign: "middle",
            }}
          >
            {style.label}
          </span>

          <h1 style={{ margin: "16px 0 8px 0", fontSize: "22px", fontWeight: "700" }}>
            Withholding{" "}
            {reminder.urgency === "due_today"
              ? "Today"
              : reminder.urgency === "overdue"
                ? "Overdue"
                : `in ${reminder.daysUntil} Days`}
          </h1>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>${reminder.amountDue}</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "13px", opacity: 0.9 }}>
            will be withheld from your {reminder.circleName} payout
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Wallet Status */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: walletBalance >= reminder.amountDue ? "#F0FDFB" : "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {walletBalance >= reminder.amountDue ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                )}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Your Payout</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                  ${reminder.payoutAmount}
                </p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: walletBalance >= reminder.amountDue ? "#00897B" : "#D97706",
                  fontWeight: "600",
                }}
              >
                {walletBalance >= reminder.amountDue ? "✓ Sufficient" : "⚠️ Check payout"}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
            What happens on {reminder.withholdingDate}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                Payout from {reminder.circleName}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>${reminder.payoutAmount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                Advance repayment (auto-withheld)
              </span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#D97706" }}>-${reminder.amountDue}</span>
            </div>
            <div style={{ height: "1px", background: "rgba(255,255,255,0.2)" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>You'll receive</span>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>${reminder.remainingAfter}</span>
            </div>
          </div>
        </div>

        {/* XnScore Warning (if urgent) */}
        {(reminder.urgency === "overdue" || reminder.urgency === "due_today") && (
          <div
            style={{
              background: "#FEE2E2",
              borderRadius: "14px",
              padding: "14px",
              marginBottom: "16px",
              border: "1px solid #DC2626",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                style={{ marginTop: "2px", flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#991B1B" }}>XnScore at Risk</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#DC2626", lineHeight: 1.5 }}>
                  If this withholding fails, your XnScore will drop 20 points and you may be restricted from future
                  advances and circles.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Want to pay early?
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Paying early saves you fees and earns bonus XnScore points. Your full payout will then be available on{" "}
            {reminder.withholdingDate}.
          </p>

          <button
            onClick={() => console.log("Pay early")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "none",
              background: "#00C6AE",
              fontSize: "14px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
              marginBottom: "10px",
            }}
          >
            Pay Early & Save
          </button>

          <button
            onClick={() => console.log("View details")}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            View Advance Details
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
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => console.log("Remind later")}
            style={{
              flex: 1,
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Remind Me Later
          </button>
          <button
            onClick={() => console.log("Got it")}
            style={{
              flex: 1,
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: "#0A2342",
              fontSize: "14px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}
