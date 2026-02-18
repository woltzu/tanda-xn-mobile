"use client"

export default function ITINEducation() {
  const interestAmount = 47.83

  const benefits = [
    { icon: "✅", text: "Available to anyone, regardless of immigration status" },
    { icon: "🔒", text: "IRS is legally prohibited from sharing with immigration" },
    { icon: "📈", text: "Build a financial history in the United States" },
    { icon: "💳", text: "Open bank accounts, get credit cards" },
    { icon: "🏠", text: "Buy property, start a business" },
  ]

  const steps = [
    { num: 1, title: "Fill out Form W-7", desc: "Simple IRS form" },
    { num: 2, title: "Gather your documents", desc: "Passport or national ID" },
    { num: 3, title: "Submit application", desc: "By mail or through an agent" },
    { num: 4, title: "Receive your ITIN", desc: "Usually 7-11 weeks" },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
      }}
    >
      {/* HEADER */}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>What is an ITIN?</h1>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px" }}>
        {/* Hero Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "16px",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              fontSize: "32px",
            }}
          >
            📋
          </div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700" }}>
            Individual Taxpayer Identification Number
          </h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.95, lineHeight: 1.6 }}>
            An ITIN is a tax ID number issued by the IRS. It lets you pay taxes and access financial services —{" "}
            <strong>regardless of immigration status</strong>.
          </p>
        </div>

        {/* Benefits */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Why get an ITIN?
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {benefits.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                <span style={{ fontSize: "13px", color: "#4B5563", lineHeight: 1.5 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Protection */}
        <div
          style={{
            background: "#EFF6FF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #BFDBFE",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#3B82F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#1E40AF" }}>
                Your privacy is protected by law
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#3B82F6", lineHeight: 1.6 }}>
                The IRS is <strong>legally prohibited</strong> from sharing your ITIN information with immigration
                agencies (Section 6103 of the Internal Revenue Code).
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#3B82F6", lineHeight: 1.6 }}>
                Getting an ITIN <strong>does not affect</strong> your immigration status in any way.
              </p>
            </div>
          </div>
        </div>

        {/* How to Get ITIN */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            How to get an ITIN
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {steps.map((step) => (
              <div key={step.num} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "#0A2342",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "700",
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{step.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Already Have ITIN */}
        <button
          onClick={() => console.log("Already have ITIN")}
          style={{
            width: "100%",
            padding: "14px",
            background: "#F5F7FA",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
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
          I already have an ITIN
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* BOTTOM ACTIONS */}
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
          onClick={() => console.log("Get help")}
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
            marginBottom: "10px",
          }}
        >
          Help Me Get an ITIN
        </button>
        <button
          onClick={() => console.log("Continue later")}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "14px",
            border: "none",
            background: "transparent",
            fontSize: "14px",
            fontWeight: "500",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          I'll do this later — continue with limited features
        </button>
      </div>
    </div>
  )
}
