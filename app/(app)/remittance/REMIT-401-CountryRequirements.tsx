"use client"

export default function CountryRequirementsScreen() {
  const country = {
    code: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    currency: "NGN",
  }

  const requirements = [
    {
      id: "bvn",
      title: "Bank Verification Number (BVN)",
      description: "Required by Nigerian Central Bank for all inbound transfers",
      status: "pending",
      required: true,
      screen: "REMIT-402",
    },
    {
      id: "recipient_name",
      title: "Recipient Full Name",
      description: "Must match the name on their bank account or mobile money",
      status: "completed",
      required: true,
    },
    {
      id: "phone",
      title: "Recipient Phone Number",
      description: "Nigerian phone number for mobile money or notifications",
      status: "completed",
      required: true,
    },
  ]

  const transferAmount = 200

  const completedCount = requirements.filter((r) => r.status === "completed").length
  const totalRequired = requirements.filter((r) => r.required).length
  const allComplete = completedCount === totalRequired
  const nextRequirement = requirements.find((r) => r.required && r.status !== "completed")

  const handleBack = () => console.log("Navigate back to recipient details")
  const handleStartRequirement = (req: (typeof requirements)[0]) => console.log("Start requirement:", req.id)
  const handleContinue = () => console.log("Continue to review transfer")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{country.name} Requirements</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Regulatory requirements for this transfer
            </p>
          </div>
          <span style={{ fontSize: "32px" }}>{country.flag}</span>
        </div>

        {/* Progress */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px" }}>Requirements completed</span>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>
              {completedCount}/{totalRequired}
            </span>
          </div>
          <div
            style={{
              height: "8px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(completedCount / totalRequired) * 100}%`,
                height: "100%",
                background: "#00C6AE",
                borderRadius: "4px",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Transfer Summary */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "14px 16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
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
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            💸
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Sending ${transferAmount} to {country.name}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Complete the requirements below to continue
            </p>
          </div>
        </div>

        {/* Requirements List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Required Information
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {requirements.map((req, idx) => {
              const isCompleted = req.status === "completed"
              const isNext = nextRequirement?.id === req.id

              return (
                <div
                  key={req.id}
                  style={{
                    padding: "14px",
                    background: isCompleted ? "#F0FDFB" : isNext ? "#FEF3C7" : "#F5F7FA",
                    borderRadius: "12px",
                    border: isNext ? "2px solid #F59E0B" : isCompleted ? "1px solid #00C6AE" : "1px solid transparent",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  {/* Status Icon */}
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: isCompleted ? "#00C6AE" : "#FFFFFF",
                      border: isCompleted ? "none" : "2px solid #E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {isCompleted ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#6B7280" }}>{idx + 1}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: "600",
                          color: isCompleted ? "#00897B" : "#0A2342",
                        }}
                      >
                        {req.title}
                      </p>
                      {req.required && (
                        <span
                          style={{
                            padding: "2px 6px",
                            background: isCompleted ? "#D1FAE5" : "#FEF3C7",
                            color: isCompleted ? "#059669" : "#D97706",
                            fontSize: "9px",
                            fontWeight: "700",
                            borderRadius: "4px",
                          }}
                        >
                          {isCompleted ? "DONE" : "REQUIRED"}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.4 }}>{req.description}</p>
                  </div>

                  {/* Action */}
                  {!isCompleted && req.screen && (
                    <button
                      onClick={() => handleStartRequirement(req)}
                      style={{
                        padding: "8px 14px",
                        background: isNext ? "#F59E0B" : "#00C6AE",
                        border: "none",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isNext ? "Start" : "Add"}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Why These Requirements */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
              Why are these required?
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            {country.name}'s central bank requires this information for all international transfers to protect against
            fraud and comply with anti-money laundering regulations. Your data is encrypted and only shared with
            authorized financial institutions.
          </p>
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
        {allComplete ? (
          <button
            onClick={handleContinue}
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
            Continue to Review
          </button>
        ) : (
          <button
            onClick={() => handleStartRequirement(nextRequirement!)}
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
            Complete: {nextRequirement?.title}
          </button>
        )}
      </div>
    </div>
  )
}
