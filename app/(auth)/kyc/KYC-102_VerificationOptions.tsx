"use client"

export default function VerificationOptions() {
  const interestAmount = 47.83

  const options = [
    {
      id: "ssn",
      icon: "🇺🇸",
      title: "I have a Social Security Number",
      subtitle: "US citizens and permanent residents",
      badge: null,
    },
    {
      id: "itin",
      icon: "📋",
      title: "I have an ITIN",
      subtitle: "Individual Taxpayer Identification Number",
      badge: null,
    },
    {
      id: "no-itin",
      icon: "🤝",
      title: "I don't have SSN or ITIN yet",
      subtitle: "That's OK! We'll help you get one",
      badge: "We'll help",
    },
    {
      id: "international",
      icon: "🌍",
      title: "I'm outside the United States",
      subtitle: "Use your passport or national ID",
      badge: null,
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 30px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Verify Your Identity</h1>
        </div>

        {/* Context */}
        <div
          style={{
            background: "rgba(0,198,174,0.15)",
            borderRadius: "12px",
            padding: "14px",
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
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            💰
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
              ${interestAmount.toFixed(2)} waiting for you
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.8 }}>Complete verification to unlock</p>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px" }}>
        {/* Instructions */}
        <p
          style={{
            margin: "0 0 20px 0",
            fontSize: "15px",
            color: "#4B5563",
            lineHeight: 1.6,
          }}
        >
          Choose the option that applies to you. All options lead to full access — there's no wrong choice.
        </p>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => console.log(`Selected: ${option.id}`)}
              style={{
                width: "100%",
                padding: "16px",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "14px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                transition: "all 0.2s ease",
              }}
            >
              {/* Icon */}
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
                  flexShrink: 0,
                }}
              >
                {option.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{option.title}</p>
                  {option.badge && (
                    <span
                      style={{
                        background: "#00C6AE",
                        color: "#FFFFFF",
                        fontSize: "10px",
                        fontWeight: "600",
                        padding: "3px 8px",
                        borderRadius: "10px",
                      }}
                    >
                      {option.badge}
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>{option.subtitle}</p>
              </div>

              {/* Arrow */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>

        {/* Info Note */}
        <div
          style={{
            marginTop: "24px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "16px" }}>💡</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#065F46" }}>Why do we need this?</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#047857", lineHeight: 1.5 }}>
              U.S. law requires us to report interest payments over $10/year to the IRS. Your tax ID lets us file the
              required 1099-INT form.
            </p>
          </div>
        </div>

        {/* Privacy Reminder */}
        <div
          style={{
            marginTop: "12px",
            padding: "14px",
            background: "#EFF6FF",
            borderRadius: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>
              ITIN privacy is protected by law
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#3B82F6", lineHeight: 1.5 }}>
              The IRS cannot share your ITIN information with immigration authorities (Section 6103 of the Internal
              Revenue Code).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
