"use client"

export default function ManageRecipientsScreen() {
  const recipients = [
    {
      id: "r1",
      name: "Mama Françoise",
      country: "CM",
      flag: "🇨🇲",
      method: "mobile_money",
      provider: "MTN MoMo",
      phone: "+237 6XX XXX XX45",
      totalSent: 450,
    },
    {
      id: "r2",
      name: "Papa Jean",
      country: "CM",
      flag: "🇨🇲",
      method: "mobile_money",
      provider: "Orange Money",
      phone: "+237 6XX XXX XX12",
      totalSent: 150,
    },
    {
      id: "r3",
      name: "Auntie Marie",
      country: "SN",
      flag: "🇸🇳",
      method: "mobile_money",
      provider: "Wave",
      phone: "+221 7X XXX XX89",
      totalSent: 100,
    },
    {
      id: "r4",
      name: "Uncle Paul",
      country: "NG",
      flag: "🇳🇬",
      method: "bank",
      bank: "First Bank",
      accountEnding: "4521",
      totalSent: 200,
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Manage Recipients</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>{recipients.length} saved</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Recipients List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          {recipients.map((recipient, idx) => (
            <div
              key={recipient.id}
              style={{
                padding: "14px 16px",
                borderBottom: idx < recipients.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#0A2342",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  color: "#FFFFFF",
                  fontWeight: "600",
                  position: "relative",
                }}
              >
                {recipient.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
                <span style={{ position: "absolute", bottom: "-2px", right: "-2px", fontSize: "16px" }}>
                  {recipient.flag}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{recipient.name}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  {recipient.method === "mobile_money" ? `📱 ${recipient.provider}` : `🏦 ${recipient.bank}`}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                  Total sent: ${recipient.totalSent}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "1px solid #FEE2E2",
                    background: "#FEF2F2",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add New */}
        <button
          style={{
            width: "100%",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "2px dashed #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#00C6AE" }}>Add New Recipient</span>
        </button>
      </div>
    </div>
  )
}
