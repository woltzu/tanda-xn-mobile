"use client"

export default function RemoveAccountConfirmationScreen() {
  const account = {
    id: "bank1",
    type: "bank",
    name: "Chase Bank",
    last4: "4532",
    accountType: "Checking",
    primary: false,
  }

  const getIcon = () => {
    switch (account.type) {
      case "bank":
        return "🏦"
      case "card":
        return "💳"
      case "mobilemoney":
        return "📱"
      default:
        return "💰"
    }
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
            onClick={() => console.log("Cancel")}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Remove Account</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Warning Icon */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "24px",
            paddingTop: "20px",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        </div>

        {/* Account Being Removed */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "2px solid #FECACA",
          }}
        >
          <p
            style={{
              margin: "0 0 12px 0",
              fontSize: "12px",
              fontWeight: "600",
              color: "#DC2626",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Account to Remove
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "12px",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
              }}
            >
              {getIcon()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>{account.name}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6B7280" }}>
                {account.accountType} •••• {account.last4}
              </p>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div
          style={{
            background: "#FEF2F2",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: "2px" }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#991B1B" }}>Are you sure?</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#B91C1C", lineHeight: 1.5 }}>
                This action cannot be undone. You'll need to add this account again if you want to use it in the future.
              </p>
            </div>
          </div>
        </div>

        {/* What Will Happen */}
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
            What happens when you remove this account:
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              "You won't be able to deposit or withdraw using this account",
              "Any pending transactions will still be processed",
              "Your transaction history will be preserved",
              account.primary ? "Another account will become your primary" : null,
            ]
              .filter(Boolean)
              .map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6B7280" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: 1.4 }}>{item}</p>
                </div>
              ))}
          </div>
        </div>

        {/* Primary Warning */}
        {account.primary && (
          <div
            style={{
              background: "#FEF3C7",
              borderRadius: "14px",
              padding: "14px",
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
              stroke="#D97706"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: "2px" }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <p style={{ margin: 0, fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
              <strong>Note:</strong> This is your primary payment method. If you remove it, you'll need to set a new
              primary account.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
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
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => console.log("Cancel")}
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
            Cancel
          </button>
          <button
            onClick={() => console.log("Confirm remove", account.id)}
            style={{
              flex: 1,
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: "#DC2626",
              fontSize: "16px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Remove Account
          </button>
        </div>
      </div>
    </div>
  )
}
