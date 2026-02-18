"use client"

export default function PaymentFailedScreen() {
  const failureDetails = {
    advanceId: "ADV-2025-0120-001",
    attemptedAmount: 315,
    paymentMethod: "TandaXn Wallet",
    failureReason: "insufficient_funds", // insufficient_funds, card_declined, bank_error, network_error
    failedAt: "Feb 15, 2025 at 9:00 AM",
    walletBalance: 180,
    shortfall: 135,
  }

  const gracePeriod = {
    daysRemaining: 3,
    deadline: "Feb 18, 2025",
    penaltyIfMissed: 20, // XnScore points
  }

  const getFailureMessage = (reason: string) => {
    switch (reason) {
      case "insufficient_funds":
        return {
          title: "Insufficient Wallet Balance",
          description: `Your wallet has $${failureDetails.walletBalance}, but $${failureDetails.attemptedAmount} is needed. You're short $${failureDetails.shortfall}.`,
        }
      case "card_declined":
        return {
          title: "Card Declined",
          description:
            "Your bank declined the transaction. This could be due to insufficient funds or security restrictions.",
        }
      case "bank_error":
        return {
          title: "Bank Connection Error",
          description: "We couldn't connect to your bank. This may be a temporary issue.",
        }
      case "network_error":
        return {
          title: "Network Error",
          description: "The payment couldn't be processed due to a connection issue. Please try again.",
        }
      default:
        return {
          title: "Payment Failed",
          description: "There was an issue processing your payment.",
        }
    }
  }

  const failure = getFailureMessage(failureDetails.failureReason)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Error Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
          padding: "40px 20px 80px 20px",
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700" }}>{failure.title}</h1>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            opacity: 0.9,
            maxWidth: "280px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {failure.description}
        </p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Grace Period Warning */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "2px solid #D97706",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#92400E" }}>
                {gracePeriod.daysRemaining} Days Grace Period
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#B45309" }}>
                Resolve by {gracePeriod.deadline} to avoid penalties
              </p>
            </div>
          </div>

          <div
            style={{
              background: "rgba(217,119,6,0.1)",
              borderRadius: "8px",
              padding: "10px",
            }}
          >
            <p style={{ margin: 0, fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
              ⚠️ If not resolved: Your XnScore will drop by <strong>{gracePeriod.penaltyIfMissed} points</strong> and you
              may be restricted from future advances and circles.
            </p>
          </div>
        </div>

        {/* Payment Details */}
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
            Payment Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Advance ID</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{failureDetails.advanceId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Amount due</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#DC2626" }}>
                ${failureDetails.attemptedAmount}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Payment method</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {failureDetails.paymentMethod}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Failed at</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{failureDetails.failedAt}</span>
            </div>
            {failureDetails.failureReason === "insufficient_funds" && (
              <>
                <div style={{ height: "1px", background: "#E5E7EB" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Wallet balance</span>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#D97706" }}>
                    ${failureDetails.walletBalance}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#6B7280" }}>Shortfall</span>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#DC2626" }}>
                    ${failureDetails.shortfall}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recovery Options */}
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
            How to Fix This
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {failureDetails.failureReason === "insufficient_funds" && (
              <button
                onClick={() => console.log("Add Funds")}
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add ${failureDetails.shortfall} to Wallet
              </button>
            )}

            <button
              onClick={() => console.log("Change Method")}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Try Different Payment Method
            </button>

            <button
              onClick={() => console.log("Retry")}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Retry Payment
            </button>
          </div>
        </div>

        {/* Need Help */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Need help?</p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => console.log("Hardship")}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "12px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              Request Hardship
            </button>
            <button
              onClick={() => console.log("Support")}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                fontSize: "12px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              Contact Support
            </button>
          </div>
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
          onClick={() =>
            console.log(failureDetails.failureReason === "insufficient_funds" ? "Add Funds & Pay" : "Retry Payment")
          }
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
          {failureDetails.failureReason === "insufficient_funds"
            ? `Add $${failureDetails.shortfall} & Pay Now`
            : "Retry Payment"}
        </button>
      </div>
    </div>
  )
}
