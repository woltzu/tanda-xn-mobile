"use client"

import { useState } from "react"
import { TabBarInline } from "../../../components/TabBar"

export default function ReEngagementScreen() {
  const [user] = useState({
    firstName: "Franck",
    daysAway: 30,
  })
  const [offers] = useState([
    {
      id: "o1",
      type: "bonus",
      icon: String.fromCodePoint(0x1f381),
      title: "$10 Welcome Back Bonus",
      description: "Make a deposit of $50+ to claim",
      expires: "3 days",
    },
    {
      id: "o2",
      type: "fee_waiver",
      icon: String.fromCodePoint(0x2728),
      title: "No Fees for 30 Days",
      description: "All circle contributions fee-free",
      expires: "7 days",
    },
  ])
  const [missedUpdates] = useState({
    newCircles: 3,
    friendsJoined: 2,
    newFeatures: 4,
  })
  const [suggestedAction] = useState({
    title: "Continue Your Emergency Fund Goal",
    progress: 65,
    current: 1950,
    target: 3000,
  })

  const handleClaimOffer = (offer: typeof offers[0]) => {
    console.log("Claiming offer:", offer)
  }

  const handleContinue = () => {
    console.log("Continue to app")
  }

  const handleSkip = () => {
    console.log("Skip re-engagement")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "180px",
        position: "relative",
      }}
    >
      {/* Header - Navy with Welcome */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "24px 20px 100px 20px",
          color: "#FFFFFF",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          onClick={handleSkip}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "8px",
            padding: "8px 12px",
            color: "#FFFFFF",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Skip
        </button>

        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "24px",
            background: "rgba(0,198,174,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
            fontSize: "40px",
          }}
        >
          {String.fromCodePoint(0x1f44b)}
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "26px", fontWeight: "700" }}>We Missed You, {user.firstName}!</h1>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>A lot has happened in {user.daysAway} days</p>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-60px", padding: "0 20px" }}>
        {/* Special Offers */}
        {offers.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "2px solid #00C6AE",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span
                style={{
                  padding: "4px 10px",
                  background: "#00C6AE",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: "700",
                  borderRadius: "4px",
                }}
              >
                SPECIAL OFFER
              </span>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>Just for you</span>
            </div>

            {offers.map((offer, idx) => (
              <button
                key={offer.id}
                onClick={() => handleClaimOffer(offer)}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: "#F0FDFB",
                  borderRadius: "14px",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: idx < offers.length - 1 ? "10px" : 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "14px",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "26px",
                  }}
                >
                  {offer.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>{offer.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{offer.description}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#D97706", fontWeight: "600" }}>
                    Expires in {offer.expires}
                  </p>
                </div>
                <span
                  style={{
                    padding: "6px 12px",
                    background: "#00C6AE",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: "600",
                    borderRadius: "8px",
                  }}
                >
                  Claim
                </span>
              </button>
            ))}
          </div>
        )}

        {/* While You Were Away */}
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
            While You Were Away
          </h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#0A2342" }}>
                {missedUpdates.newCircles}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>New Circles</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#0A2342" }}>
                {missedUpdates.friendsJoined}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>Friends Joined</p>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F0FDFB",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#00C6AE" }}>
                {missedUpdates.newFeatures}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6B7280" }}>New Features</p>
            </div>
          </div>
        </div>

        {/* Continue Goal */}
        {suggestedAction && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "16px",
              padding: "20px",
            }}
          >
            <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
              Pick up where you left off
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#FFFFFF" }}>
              {suggestedAction.title}
            </p>

            {/* Progress Bar */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.2)", borderRadius: "4px" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${suggestedAction.progress}%`,
                    background: "#00C6AE",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                ${suggestedAction.current.toLocaleString()} of ${suggestedAction.target.toLocaleString()}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>{suggestedAction.progress}%</span>
            </div>
          </div>
        )}

        {/* Testimonial */}
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "#F0FDFB",
            borderRadius: "14px",
            border: "1px solid #00C6AE",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>{String.fromCodePoint(0x1f4ac)}</span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#065F46",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                "Coming back to TandaXn was the best decision. I saved $2,400 in just 6 months!"
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                - Marie T., Member since 2023
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
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
          Let's Get Back to Saving!
        </button>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
