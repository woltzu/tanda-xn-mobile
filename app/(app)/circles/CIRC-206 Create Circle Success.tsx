"use client"

export default function CreateCircleSuccessScreen() {
  const circle = {
    id: "circle_123",
    name: "Family Savings",
    amount: 200,
    size: 6,
    startDate: "2025-01-15",
    inviteCode: "FAMILY2025",
  }
  const invitesSent = 3

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
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
      {/* Success Header - Navy gradient */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "60px 20px 100px 20px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        {/* Success Animation */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Circle Created! 🎉</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>{circle.name} is ready to go</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Circle Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              fontSize: "28px",
            }}
          >
            🔄
          </div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{circle.name}</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280" }}>
            Starting {formatDate(circle.startDate)}
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>${circle.amount}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>per cycle</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>{circle.size}+</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>members</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "14px",
                background: "#F0FDFB",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
                ${(circle.amount * circle.size).toLocaleString()}+
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>pot size</p>
            </div>
          </div>

          {/* Invite Code */}
          <div
            style={{
              background: "#0A2342",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Circle Invite Code</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#FFFFFF", letterSpacing: "2px" }}>
              {circle.inviteCode}
            </p>
          </div>
        </div>

        {/* Invites Sent */}
        {invitesSent > 0 && (
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "16px",
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
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                {invitesSent} invite{invitesSent > 1 ? "s" : ""} sent!
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                They'll receive a notification to join
              </p>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>What's Next?</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#00C6AE" }}>1</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Wait for members to join
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Circle activates when members are ready
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#6B7280" }}>2</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Make your first contribution
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Due on {formatDate(circle.startDate)}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#6B7280" }}>3</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Receive your payout</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Based on rotation order</p>
              </div>
            </div>
          </div>
        </div>
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
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          onClick={() => console.log("View Circle")}
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
          View Circle
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => console.log("Invite More")}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Invite More
          </button>
          <button
            onClick={() => console.log("Done")}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
