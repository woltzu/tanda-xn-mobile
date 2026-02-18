"use client"

import { useState } from "react"

export default function CommunityIntelligence() {
  const [activeTab, setActiveTab] = useState("insights")

  const user = {
    name: "Franck",
    originCountry: "IN",
    originCity: "Mumbai",
    language: "Hindi",
  }

  const communityData = {
    IN: {
      city: "Mumbai",
      flag: "🇮🇳",
      avgSend: 350,
      popularDays: ["1st", "15th", "Last Friday"],
      topPurposes: [
        { name: "Family Support", percent: 45, icon: "👨‍👩‍👧‍👦" },
        { name: "School Fees", percent: 25, icon: "🎓" },
        { name: "Medical Bills", percent: 15, icon: "🏥" },
        { name: "Festivals", percent: 15, icon: "🎉" },
      ],
      upcomingFestivals: [
        {
          name: "Makar Sankranti",
          date: "Jan 14",
          daysLeft: 13,
          avgSend: 200,
          message: "Send blessings to your family",
        },
        {
          name: "Republic Day",
          date: "Jan 26",
          daysLeft: 25,
          avgSend: 100,
          message: "Celebrate with loved ones",
        },
        {
          name: "Holi",
          date: "Mar 14",
          daysLeft: 72,
          avgSend: 300,
          message: "Colors of joy for family",
        },
      ],
      trending: ["School fees season starting", "Weddings peak season Feb-May", "Summer travel bookings"],
    },
    NG: {
      city: "Lagos",
      flag: "🇳🇬",
      avgSend: 250,
      popularDays: ["Last week of month", "1st of month"],
      topPurposes: [
        { name: "Rent/Housing", percent: 35, icon: "🏠" },
        { name: "Business", percent: 30, icon: "💼" },
        { name: "Education", percent: 20, icon: "🎓" },
        { name: "Healthcare", percent: 15, icon: "🏥" },
      ],
      upcomingFestivals: [
        {
          name: "Easter",
          date: "Mar 31",
          daysLeft: 89,
          avgSend: 400,
          message: "Support family celebrations",
        },
      ],
      trending: ["Rent payment season", "University fees due", "New term school supplies"],
    },
  }

  const data = communityData[user.originCountry as keyof typeof communityData] || communityData.IN

  const tabs = [
    { id: "insights", label: "Insights", icon: "📊" },
    { id: "festivals", label: "Festivals", icon: "🎉" },
    { id: "circles", label: "Send to Circle", icon: "👥" },
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>
              {data.flag} {data.city} Community
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Insights from {data.city}kars in NYC
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === tab.id ? "rgba(0,198,174,0.2)" : "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ fontSize: "16px" }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* ============ INSIGHTS TAB ============ */}
        {activeTab === "insights" && (
          <>
            {/* Community Average Card */}
            <div
              style={{
                background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                color: "#FFFFFF",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "20px" }}>{data.flag}</span>
                <span style={{ fontSize: "14px", fontWeight: "600" }}>{data.city}kars in NYC send</span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "36px", fontWeight: "700" }}>
                ${data.avgSend}
                <span style={{ fontSize: "16px", fontWeight: "400", opacity: 0.7 }}>/month avg</span>
              </p>
              <p style={{ margin: 0, fontSize: "13px", opacity: 0.8 }}>Popular days: {data.popularDays.join(", ")}</p>
            </div>

            {/* What People Send For */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                What people send for
              </h3>

              {data.topPurposes.map((purpose, idx) => (
                <div key={idx} style={{ marginBottom: idx < data.topPurposes.length - 1 ? "16px" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>{purpose.icon}</span>
                      <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{purpose.name}</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>{purpose.percent}%</span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      borderRadius: "4px",
                      background: "#F5F7FA",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${purpose.percent}%`,
                        borderRadius: "4px",
                        background: "linear-gradient(90deg, #00C6AE 0%, #00A896 100%)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Trending */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                📈 What's happening now
              </h3>
              {data.trending.map((trend, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: idx < data.trending.length - 1 ? "1px solid #F5F7FA" : "none",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                    }}
                  />
                  <span style={{ fontSize: "14px", color: "#6B7280" }}>{trend}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ FESTIVALS TAB ============ */}
        {activeTab === "festivals" && (
          <>
            {/* Festival Reminder Banner */}
            <div
              style={{
                background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "20px",
                border: "1px solid #F59E0B",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "24px" }}>🔔</span>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#92400E" }}>
                  Festival Reminders On
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#92400E" }}>
                We'll remind you 3 days before festivals so you can send love to family on time.
              </p>
            </div>

            {/* Upcoming Festivals */}
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
              Upcoming Festivals
            </h3>

            {data.upcomingFestivals.map((festival, idx) => (
              <div
                key={idx}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "12px",
                  border: festival.daysLeft <= 14 ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "14px",
                      background: festival.daysLeft <= 14 ? "#F0FDFB" : "#F5F7FA",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>{festival.date.split(" ")[0]}</span>
                    <span style={{ fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                      {festival.date.split(" ")[1]}
                    </span>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                        {festival.name}
                      </h4>
                      {festival.daysLeft <= 14 && (
                        <span
                          style={{
                            background: "#00C6AE",
                            color: "#FFFFFF",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "10px",
                            fontWeight: "600",
                          }}
                        >
                          {festival.daysLeft} days
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 10px 0", fontSize: "13px", color: "#6B7280" }}>{festival.message}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>
                        Community avg: <strong>${festival.avgSend}</strong>
                      </span>
                      <button
                        onClick={() => console.log("Send now for", festival.name)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#00C6AE",
                          color: "#FFFFFF",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        Send Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Custom Reminder */}
            <button
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "2px dashed #E5E7EB",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#6B7280" }}>Add custom reminder</span>
            </button>
          </>
        )}

        {/* ============ CIRCLES TAB ============ */}
        {activeTab === "circles" && (
          <>
            {/* Send to Circle CTA */}
            <div
              style={{
                background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "20px",
                color: "#FFFFFF",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "rgba(0,198,174,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px auto",
                }}
              >
                <span style={{ fontSize: "32px" }}>👥</span>
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: "700" }}>Send to Your ROSCA Circle</h3>
              <p style={{ margin: "0 0 20px 0", fontSize: "14px", opacity: 0.8 }}>
                Direct transfer to your family's savings circle back home
              </p>
              <button
                onClick={() => console.log("Link a Circle")}
                style={{
                  padding: "14px 32px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#00C6AE",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Link a Circle
              </button>
            </div>

            {/* Group Send Feature */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                💡 Group Send
              </h3>
              <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#6B7280" }}>
                Split your transfer among multiple family members in one go.
              </p>

              {/* Example Split */}
              <div
                style={{
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  padding: "14px",
                }}
              >
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                  Example: Send $300 split as:
                </p>
                {[
                  { name: "Mom", amount: 150 },
                  { name: "Brother", amount: 100 },
                  { name: "Sister", amount: 50 },
                ].map((split, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: idx < 2 ? "1px solid #E5E7EB" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "#E5E7EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                        }}
                      >
                        {split.name[0]}
                      </div>
                      <span style={{ fontSize: "14px", color: "#0A2342" }}>{split.name}</span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#00C6AE" }}>${split.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Circles */}
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Your linked circles
            </h4>
            <div
              style={{
                background: "#F5F7FA",
                borderRadius: "14px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "32px" }}>🔗</span>
              <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No circles linked yet</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Link a ROSCA circle to send directly to members
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
