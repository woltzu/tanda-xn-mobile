"use client"

export default function JoinCircleSuccessScreen() {
  const circle = {
    id: "circle_456",
    name: "Diaspora Family Fund",
    emoji: "👨‍👩‍👧‍👦",
    contribution: 200,
    frequency: "monthly",
    firstDueDate: "Jan 25, 2025",
    payoutPosition: 9,
    totalMembers: 12,
    potAmount: 2400,
    estimatedPayoutDate: "Sep 25, 2025",
  }

  const xnScoreBonus = 5

  const getFrequencyLabel = () => {
    switch (circle.frequency) {
      case "daily":
        return "daily"
      case "weekly":
        return "weekly"
      case "biweekly":
        return "bi-weekly"
      case "monthly":
        return "monthly"
      default:
        return circle.frequency
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
      {/* Success Header - Navy with celebration */}
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

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>Welcome to the Circle! 🎉</h1>
        <p style={{ margin: 0, fontSize: "15px", opacity: 0.9 }}>You've joined {circle.name}</p>
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
            {circle.emoji}
          </div>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>{circle.name}</h2>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>${circle.contribution}</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>{getFrequencyLabel()}</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                #{circle.payoutPosition}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>your position</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F0FDFB",
                borderRadius: "10px",
              }}
            >
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                ${circle.potAmount.toLocaleString()}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>payout</p>
            </div>
          </div>

          {/* Payout Date */}
          <div
            style={{
              background: "#0A2342",
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Your estimated payout date</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
              {circle.estimatedPayoutDate}
            </p>
          </div>
        </div>

        {/* XnScore Bonus */}
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
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            ⭐
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>XnScore Bonus!</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Joining a circle earned you +{xnScoreBonus} points
            </p>
          </div>
          <span style={{ fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>+{xnScoreBonus}</span>
        </div>

        {/* Next Steps */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>What's Next?</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#FFFFFF" }}>1</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Make your first contribution
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Due by <strong>{circle.firstDueDate}</strong>
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#6B7280" }}>2</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  Meet your circle members
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  {circle.totalMembers} people saving together with you
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#6B7280" }}>3</span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Wait for your payout</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  You're #{circle.payoutPosition} in line for ${circle.potAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* First Contribution Reminder */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "12px",
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
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
              First payment due: {circle.firstDueDate}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#B45309" }}>
              Set up auto-pay to never miss a contribution!
            </p>
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
            background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
            fontSize: "16px",
            fontWeight: "600",
            color: "#FFFFFF",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0, 198, 174, 0.3)",
          }}
        >
          View Circle
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => console.log("Invite Friends")}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Invite Friends
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
