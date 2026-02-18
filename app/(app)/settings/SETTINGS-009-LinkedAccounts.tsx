"use client"

export default function LinkedAccountsScreen() {
  const linkedAccounts = [
    { id: "b1", type: "bank", name: "Chase Checking", last4: "4589", status: "verified", isDefault: true, icon: "🏦" },
    {
      id: "b2",
      type: "bank",
      name: "Bank of America Savings",
      last4: "7823",
      status: "verified",
      isDefault: false,
      icon: "🏦",
    },
    {
      id: "c1",
      type: "card",
      name: "Visa",
      last4: "1234",
      status: "verified",
      isDefault: false,
      icon: "💳",
      brand: "visa",
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return { label: "Verified", color: "#00897B", bg: "#F0FDFB" }
      case "pending":
        return { label: "Pending", color: "#D97706", bg: "#FEF3C7" }
      case "failed":
        return { label: "Action Needed", color: "#DC2626", bg: "#FEE2E2" }
      default:
        return { label: "Unknown", color: "#6B7280", bg: "#F5F7FA" }
    }
  }

  const bankAccounts = linkedAccounts.filter((a) => a.type === "bank")
  const cards = linkedAccounts.filter((a) => a.type === "card")

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleAddAccount = (type: string) => {
    console.log("Add account:", type)
  }

  const handleViewAccount = (account: any) => {
    console.log("View account:", account)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Linked Accounts</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Manage payment methods</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Bank Accounts */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Bank Accounts</h3>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>{bankAccounts.length} linked</span>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            {bankAccounts.map((account, idx) => {
              const status = getStatusBadge(account.status)
              return (
                <button
                  key={account.id}
                  onClick={() => handleViewAccount(account)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: "#FFFFFF",
                    border: "none",
                    borderBottom: idx < bankAccounts.length - 1 ? "1px solid #F5F7FA" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    {account.icon}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{account.name}</p>
                      {account.isDefault && (
                        <span
                          style={{
                            padding: "2px 6px",
                            background: "#00C6AE",
                            color: "#FFFFFF",
                            fontSize: "9px",
                            fontWeight: "700",
                            borderRadius: "4px",
                          }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>•••• {account.last4}</p>
                  </div>
                  <span
                    style={{
                      padding: "4px 8px",
                      background: status.bg,
                      color: status.color,
                      fontSize: "10px",
                      fontWeight: "600",
                      borderRadius: "6px",
                    }}
                  >
                    {status.label}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )
            })}

            {/* Add Bank */}
            <button
              onClick={() => handleAddAccount("bank")}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#F5F7FA",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#FFFFFF",
                  border: "2px dashed #00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>Link Bank Account</span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Debit/Credit Cards</h3>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>{cards.length} linked</span>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            {cards.map((card, idx) => {
              const status = getStatusBadge(card.status)
              return (
                <button
                  key={card.id}
                  onClick={() => handleViewAccount(card)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    background: "#FFFFFF",
                    border: "none",
                    borderBottom: idx < cards.length - 1 ? "1px solid #F5F7FA" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "#0A2342",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {card.name} •••• {card.last4}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>For payments only</p>
                  </div>
                  <span
                    style={{
                      padding: "4px 8px",
                      background: status.bg,
                      color: status.color,
                      fontSize: "10px",
                      fontWeight: "600",
                      borderRadius: "6px",
                    }}
                  >
                    {status.label}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )
            })}

            {/* Add Card */}
            <button
              onClick={() => handleAddAccount("card")}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#F5F7FA",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#FFFFFF",
                  border: "2px dashed #00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>Add Card</span>
            </button>
          </div>
        </div>

        {/* Security Note */}
        <div
          style={{
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Your bank details are encrypted and secured. We use Plaid for secure bank connections and never store your
            login credentials.
          </p>
        </div>
      </div>
    </div>
  )
}
