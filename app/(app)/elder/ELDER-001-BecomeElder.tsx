"use client"

export default function BecomeElderScreen() {
  const currentUser = {
    name: "Franck Kengne",
    xnScore: 75,
    honorScore: 68,
    circlesCompleted: 8,
    memberSince: "Oct 2024",
    disputesResolved: 0,
  }

  const requirements = [
    { id: "xnscore", label: "XnScore 70+", current: 75, required: 70, met: true },
    { id: "honor", label: "Honor Score 65+", current: 68, required: 65, met: true },
    { id: "circles", label: "5+ circles completed", current: 8, required: 5, met: true },
    { id: "tenure", label: "6+ months member", current: "3 months", required: "6 months", met: false },
    { id: "standing", label: "No active disputes", current: "0 disputes", required: "0", met: true },
  ]

  const benefits = [
    { icon: "⚖️", title: "Mediate Disputes", description: "Help resolve conflicts fairly" },
    { icon: "🏅", title: "Earn Honor Points", description: "Build your reputation" },
    { icon: "💵", title: "Earn Rewards", description: "$25 per resolved case" },
    { icon: "🌟", title: "Elder Badge", description: "Visible community status" },
  ]

  const requirementsMet = requirements.filter((r) => r.met).length
  const allRequirementsMet = requirementsMet === requirements.length

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
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Become an Elder</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Guide our community with wisdom</p>
          </div>
        </div>

        {/* Elder Icon + Current Scores */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              border: "3px solid #00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
              fontSize: "40px",
            }}
          >
            👴
          </div>

          {/* Current Scores */}
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "16px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Your XnScore</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                {currentUser.xnScore}/100
              </p>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.3)" }} />
            <div>
              <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Honor Score</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "20px", fontWeight: "700" }}>{currentUser.honorScore}/100</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Requirements Check */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Requirements</h3>
            <span
              style={{
                padding: "4px 10px",
                background: allRequirementsMet ? "#F0FDFB" : "#FEF3C7",
                color: allRequirementsMet ? "#00897B" : "#D97706",
                fontSize: "11px",
                fontWeight: "600",
                borderRadius: "6px",
              }}
            >
              {requirementsMet}/{requirements.length} met
            </span>
          </div>

          {requirements.map((req, idx) => (
            <div
              key={req.id}
              style={{
                padding: "12px 0",
                borderBottom: idx < requirements.length - 1 ? "1px solid #F5F7FA" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: req.met ? "#00C6AE" : "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {req.met ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: "14px", color: req.met ? "#0A2342" : "#6B7280" }}>{req.label}</span>
              </div>
              <span style={{ fontSize: "12px", color: req.met ? "#00897B" : "#D97706", fontWeight: "500" }}>
                {typeof req.current === "number" ? req.current : req.current}
              </span>
            </div>
          ))}
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
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Elder Benefits
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>{benefit.icon}</span>
                <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  {benefit.title}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Commitment */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#FFFFFF" }}>
            ⚠️ Elder Commitment
          </h4>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
            As an Elder, you commit to respond to disputes within 48 hours, remain impartial in all cases, and uphold
            the highest ethical standards. Failure to meet these obligations may result in removal.
          </p>
        </div>

        {/* Learn More */}
        <button
          onClick={() => console.log("Learn more")}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "14px",
            background: "transparent",
            border: "none",
            fontSize: "14px",
            color: "#00C6AE",
            fontWeight: "600",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Learn more about Elder responsibilities →
        </button>
      </div>

      {/* Apply Button */}
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
          onClick={() => console.log("Apply")}
          disabled={!allRequirementsMet}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: allRequirementsMet ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: allRequirementsMet ? "#FFFFFF" : "#9CA3AF",
            cursor: allRequirementsMet ? "pointer" : "not-allowed",
          }}
        >
          {allRequirementsMet ? "Apply to Become Elder" : "Requirements Not Met"}
        </button>
        {!allRequirementsMet && (
          <p style={{ margin: "8px 0 0 0", textAlign: "center", fontSize: "12px", color: "#6B7280" }}>
            Complete all requirements to apply
          </p>
        )}
      </div>
    </div>
  )
}
