"use client"

export default function PaymentMethodsScreen() {
  const bankAccounts = [
    { id: "bank1", name: "Chase Bank", last4: "4532", type: "Checking", verified: true, primary: true },
    { id: "bank2", name: "Bank of America", last4: "7890", type: "Savings", verified: true, primary: false },
  ]

  const cards = [
    { id: "card1", brand: "Visa", last4: "8821", expiry: "12/27", type: "Debit" },
    { id: "card2", brand: "Mastercard", last4: "4532", expiry: "08/26", type: "Credit" },
  ]

  const mobileMoneyAccounts = [{ id: "mm1", provider: "Wave", phone: "+221 77 ***-**89", verified: true }]

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
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payment Methods</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Bank Accounts */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Bank Accounts</h3>
            <button
              onClick={() => console.log("Add bank")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              + Add
            </button>
          </div>
          {bankAccounts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {bankAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => console.log("Edit account", account.id)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#F5F7FA",
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
                      borderRadius: "10px",
                      background: "#0A2342",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{account.name}</p>
                      {account.primary && (
                        <span
                          style={{
                            background: "#F0FDFB",
                            color: "#00897B",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "9px",
                            fontWeight: "600",
                          }}
                        >
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      {account.type} •••• {account.last4}
                    </p>
                  </div>
                  {account.verified && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "20px" }}>
              No bank accounts linked
            </p>
          )}
        </div>

        {/* Cards */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Cards</h3>
            <button
              onClick={() => console.log("Add card")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              + Add
            </button>
          </div>
          {cards.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => console.log("Edit card", card.id)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#F5F7FA",
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
                      borderRadius: "10px",
                      background: card.brand === "Visa" ? "#1A1F71" : "#EB001B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      fontWeight: "700",
                      fontSize: "10px",
                    }}
                  >
                    {card.brand.substring(0, 4).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {card.brand} •••• {card.last4}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      {card.type} • Expires {card.expiry}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "20px" }}>
              No cards linked
            </p>
          )}
        </div>

        {/* Mobile Money */}
        <div
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
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Mobile Money</h3>
            <button
              onClick={() => console.log("Add mobile money")}
              style={{
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              + Add
            </button>
          </div>
          {mobileMoneyAccounts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {mobileMoneyAccounts.map((mm) => (
                <button
                  key={mm.id}
                  onClick={() => console.log("Edit mobile money", mm.id)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#F5F7FA",
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
                      borderRadius: "10px",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    🌊
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{mm.provider}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{mm.phone}</p>
                  </div>
                  {mm.verified && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "20px" }}>
              No mobile money accounts linked
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
