"use client"

import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"

export default function FamilyCircleHubScreen() {
  const { myCircles, isLoading } = useCircles()
  const { user } = useAuth()

  // Filter to family-type circles
  const familyCircles = myCircles.filter(
    (c) => c.type === "beneficiary" || c.type === "family-support" || c.type === "traditional"
  )

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back()
    }
  }

  const handleCircleClick = (circleId: string) => {
    if (typeof window !== "undefined") {
      window.location.href = `/circles/CIRC-301 Dashboard?circleId=${circleId}`
    }
  }

  const handleCreateCircle = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/circles/CIRC-201 Create Circle Start"
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#666", fontSize: "16px" }}>Loading family circles...</p>
      </div>
    )
  }

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
          padding: "20px 20px 100px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Family Support Circles</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              Pool money with siblings, save on fees
            </p>
          </div>
        </div>

        {/* Savings Banner */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            {String.fromCodePoint(0x1f4b0)}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>{familyCircles.length}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.9 }}>Active Family Circle{familyCircles.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* How It Works */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            How Family Circles Work
          </h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px auto",
                  fontSize: "18px",
                }}
              >
                {String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467, 0x200d, 0x1f466)}
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>Invite siblings to join</p>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px auto",
                  fontSize: "18px",
                }}
              >
                {String.fromCodePoint(0x1f4b5)}
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>
                Each contributes their share
              </p>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#F0FDFB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 8px auto",
                  fontSize: "18px",
                }}
              >
                {String.fromCodePoint(0x2708, 0xfe0f)}
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280", lineHeight: 1.4 }}>One transfer, one fee!</p>
            </div>
          </div>
        </div>

        {/* Active Circles */}
        {familyCircles.length > 0 ? (
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>
              YOUR CIRCLES
            </h3>
            {familyCircles.map((circle) => {
              const progress = circle.progress
              const spotsInfo = `${circle.currentMembers}/${circle.memberCount}`

              return (
                <button
                  key={circle.id}
                  onClick={() => handleCircleClick(circle.id)}
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "16px",
                    marginBottom: "12px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                        {circle.emoji} {circle.name}
                      </p>
                      {circle.beneficiaryName && (
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                          To: {circle.beneficiaryName} {circle.beneficiaryCountry ? `(${circle.beneficiaryCountry})` : ""}
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        background: circle.status === "active" ? "#F0FDFB" : "#FEF3C7",
                        color: circle.status === "active" ? "#00897B" : "#D97706",
                        fontSize: "11px",
                        fontWeight: "600",
                        borderRadius: "6px",
                        textTransform: "capitalize",
                      }}
                    >
                      {circle.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>
                        ${circle.amount} x {circle.currentMembers} members
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div style={{ height: "8px", background: "#E5E7EB", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${progress}%`,
                          background: "linear-gradient(90deg, #00C6AE 0%, #00A896 100%)",
                          borderRadius: "4px",
                        }}
                      />
                    </div>
                  </div>

                  {/* Members & Details */}
                  <div
                    style={{
                      padding: "10px",
                      background: "#F5F7FA",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      Members: {spotsInfo} {circle.currentCycle ? `| Cycle ${circle.currentCycle}` : ""}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#0A2342", textTransform: "capitalize" }}>
                      {circle.frequency}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "28px",
              }}
            >
              {String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467, 0x200d, 0x1f466)}
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              No Family Circles Yet
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Start one to save 75%+ on transfer fees</p>
          </div>
        )}
      </div>

      {/* Create Circle Button */}
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
          onClick={handleCreateCircle}
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
          Create New Family Circle
        </button>
      </div>
    </div>
  )
}
