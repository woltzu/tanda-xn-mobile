"use client"

export default function ITINPending() {
  const applicationDate = "January 10, 2026"
  const estimatedArrival = "March 2026"
  const weeksRemaining = 9
  const interestAccrued = 47.83

  const timeline = [
    { step: 1, title: "Application submitted", status: "complete", date: applicationDate },
    { step: 2, title: "IRS processing", status: "active", date: "In progress" },
    { step: 3, title: "ITIN issued", status: "pending", date: estimatedArrival },
    { step: 4, title: "Unlock your interest", status: "pending", date: "Then!" },
  ]

  const whatYouCanDo = [
    { icon: "🔄", title: "Join and participate in circles", available: true },
    { icon: "💰", title: "Contribute to circles", available: true },
    { icon: "🎯", title: "Save to goals", available: true },
    { icon: "📈", title: "Watch interest grow", available: true },
    { icon: "💸", title: "Receive payouts up to $600/year", available: true },
    { icon: "🔓", title: "Unlimited withdrawals", available: false, note: "After ITIN" },
    { icon: "💰", title: "Access your interest", available: false, note: "After ITIN" },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>ITIN Application Status</h1>
        </div>

        {/* Status Badge */}
        <div
          style={{
            background: "rgba(245,158,11,0.2)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "12px",
              background: "#F59E0B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            ⏳
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
              Processing — ~{weeksRemaining} weeks remaining
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.9 }}>Expected by {estimatedArrival}</p>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px" }}>
        {/* Timeline */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
            Your application progress
          </h3>

          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: "15px",
                top: "20px",
                bottom: "20px",
                width: "2px",
                background: "#E5E7EB",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {timeline.map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background:
                        item.status === "complete" ? "#059669" : item.status === "active" ? "#F59E0B" : "#E5E7EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      zIndex: 1,
                    }}
                  >
                    {item.status === "complete" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : item.status === "active" ? (
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: "#FFFFFF",
                        }}
                      />
                    ) : (
                      <span style={{ color: "#9CA3AF", fontSize: "12px", fontWeight: "600" }}>{item.step}</span>
                    )}
                  </div>
                  <div style={{ paddingTop: "4px" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: "600",
                        color: item.status === "pending" ? "#9CA3AF" : "#0A2342",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        fontSize: "12px",
                        color: item.status === "active" ? "#F59E0B" : "#6B7280",
                      }}
                    >
                      {item.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Interest Growing */}
        <div
          style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
            borderRadius: "16px",
            padding: "18px",
            marginBottom: "16px",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.9 }}>
            While you wait, your interest is growing!
          </p>
          <p style={{ margin: "0 0 8px 0", fontSize: "32px", fontWeight: "700" }}>${interestAccrued.toFixed(2)}</p>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>
            This will be waiting for you when your ITIN arrives 🎉
          </p>
        </div>

        {/* What You Can Do Now */}
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
            What you can do now
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {whatYouCanDo.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px",
                  background: item.available ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                  opacity: item.available ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{item.icon}</span>
                  <span style={{ fontSize: "13px", color: "#0A2342" }}>{item.title}</span>
                </div>
                {item.available ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{item.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Already Received ITIN */}
        <button
          onClick={() => console.log("Received ITIN")}
          style={{
            width: "100%",
            padding: "14px",
            background: "#F0FDFB",
            border: "1px solid #00C6AE",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: "600",
            color: "#00C6AE",
            cursor: "pointer",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          🎉 I received my ITIN!
        </button>

        {/* Need Help */}
        <button
          onClick={() => console.log("Get help")}
          style={{
            width: "100%",
            padding: "12px",
            background: "transparent",
            border: "none",
            fontSize: "13px",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          Need help with your application?
        </button>
      </div>

      {/* BOTTOM ACTION */}
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
          onClick={() => console.log("Continue to app")}
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
          Continue to TandaXn
        </button>
      </div>
    </div>
  )
}
