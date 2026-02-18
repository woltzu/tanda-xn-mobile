"use client"

import { useState } from "react"

export default function ElderEndorsementWallScreen() {
  const [filterTier, setFilterTier] = useState("all")
  const [filterCircleType, setFilterCircleType] = useState("all")
  const [showShareModal, setShowShareModal] = useState(false)

  const member = {
    name: "Alex Okonkwo",
    avatar: "A",
    xnScore: 720,
    memberSince: "March 2024",
    totalVouchPoints: 85,
  }

  const endorsements = [
    {
      id: "end1",
      elderName: "Elder Amara Osei",
      elderAvatar: "A",
      elderTier: "Senior",
      elderHonorScore: 820,
      pointsGiven: 25,
      dateGiven: "Dec 15, 2024",
      circleContext: "Ghana Monthly Tanda",
      testimonial:
        "Alex has been an exemplary member in every circle we've shared. Always on time with payments, communicative, and supportive of other members.",
      circleType: "Rotating",
    },
    {
      id: "end2",
      elderName: "Elder Kofi Mensah",
      elderAvatar: "K",
      elderTier: "Grand",
      elderHonorScore: 945,
      pointsGiven: 50,
      dateGiven: "Nov 28, 2024",
      circleContext: "Business Owners Fund",
      testimonial:
        "I've known Alex for over a year. Their financial discipline and integrity make them a valuable addition to any circle. Highly recommend.",
      circleType: "Goal",
    },
    {
      id: "end3",
      elderName: "Elder Priya Sharma",
      elderAvatar: "P",
      elderTier: "Junior",
      elderHonorScore: 680,
      pointsGiven: 10,
      dateGiven: "Oct 10, 2024",
      circleContext: "Tech Savers Circle",
      testimonial: "Solid member with good communication skills. Completed our circle without any issues.",
      circleType: "Emergency",
    },
  ]

  const tierFilters = [
    { id: "all", label: "All Elders" },
    { id: "Grand", label: "Grand" },
    { id: "Senior", label: "Senior" },
    { id: "Junior", label: "Junior" },
  ]

  const circleTypeFilters = [
    { id: "all", label: "All Circles" },
    { id: "Rotating", label: "Rotating" },
    { id: "Goal", label: "Goal" },
    { id: "Emergency", label: "Emergency" },
  ]

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case "Grand":
        return { bg: "#7C3AED", icon: "🌳" }
      case "Senior":
        return { bg: "#00C6AE", icon: "🌿" }
      case "Junior":
        return { bg: "#6B7280", icon: "🌱" }
      default:
        return { bg: "#6B7280", icon: "👤" }
    }
  }

  const filteredEndorsements = endorsements.filter(
    (e) =>
      (filterTier === "all" || e.elderTier === filterTier) &&
      (filterCircleType === "all" || e.circleType === filterCircleType),
  )

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
          paddingBottom: "80px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Endorsement Wall</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Elders who trust {member.name}
            </p>
          </div>
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>

        {/* Member Summary */}
        <div
          style={{
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
              fontSize: "22px",
              fontWeight: "700",
              color: "#FFFFFF",
            }}
          >
            {member.avatar}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>{member.name}</h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              XnScore: {member.xnScore} • Member since {member.memberSince}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Card - Overlapping */}
      <div
        style={{
          margin: "-60px 20px 20px 20px",
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 4px 20px rgba(10, 35, 66, 0.1)",
        }}
      >
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#0A2342" }}>{endorsements.length}</p>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Endorsements</p>
          </div>
          <div style={{ width: "1px", background: "#E5E7EB" }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
              +{member.totalVouchPoints}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Vouch Points</p>
          </div>
          <div style={{ width: "1px", background: "#E5E7EB" }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "#7C3AED" }}>
              {endorsements.filter((e) => e.elderTier === "Grand").length}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Grand Elders</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px" }}>
        {/* Filters */}
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "10px",
              overflowX: "auto",
              paddingBottom: "4px",
            }}
          >
            {tierFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterTier(filter.id)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "20px",
                  border: "none",
                  background: filterTier === filter.id ? "#0A2342" : "#FFFFFF",
                  color: filterTier === filter.id ? "#FFFFFF" : "#0A2342",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "4px",
            }}
          >
            {circleTypeFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterCircleType(filter.id)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "20px",
                  border: filterCircleType === filter.id ? "none" : "1px solid #E5E7EB",
                  background: filterCircleType === filter.id ? "#00C6AE" : "#FFFFFF",
                  color: filterCircleType === filter.id ? "#FFFFFF" : "#6B7280",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Endorsements List */}
        {filteredEndorsements.map((endorsement) => {
          const tierStyle = getTierStyle(endorsement.elderTier)

          return (
            <div
              key={endorsement.id}
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "12px",
                border: "1px solid #E5E7EB",
              }}
            >
              {/* Elder Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: tierStyle.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: "700",
                    color: "#FFFFFF",
                    position: "relative",
                  }}
                >
                  {endorsement.elderAvatar}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      fontSize: "12px",
                    }}
                  >
                    {tierStyle.icon}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                      {endorsement.elderName}
                    </h4>
                    <span
                      style={{
                        background: tierStyle.bg,
                        color: "#FFFFFF",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                      }}
                    >
                      {endorsement.elderTier}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                    Honor Score: {endorsement.elderHonorScore}
                  </p>
                </div>
                <div
                  style={{
                    background: "#F0FDFB",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#00C6AE" }}>
                    +{endorsement.pointsGiven}
                  </p>
                  <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>points</p>
                </div>
              </div>

              {/* Testimonial */}
              <div
                style={{
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "12px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#0A2342", lineHeight: 1.5, fontStyle: "italic" }}>
                  "{endorsement.testimonial}"
                </p>
              </div>

              {/* Context */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      background: "#F5F7FA",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#0A2342",
                    }}
                  >
                    {endorsement.circleContext}
                  </span>
                  <span
                    style={{
                      background: "#DBEAFE",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#1D4ED8",
                    }}
                  >
                    {endorsement.circleType}
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{endorsement.dateGiven}</span>
              </div>
            </div>
          )
        })}

        {filteredEndorsements.length === 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "40px" }}>📭</span>
            <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>
              No endorsements match your filters
            </p>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "20px",
              width: "100%",
              maxWidth: "400px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>Share Endorsements</h3>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Share your endorsement wall when applying to new circles
            </p>

            {[
              { method: "Copy Link", icon: "🔗", desc: "Get shareable URL" },
              { method: "Download PDF", icon: "📄", desc: "Save as document" },
              { method: "WhatsApp", icon: "📱", desc: "Share via message" },
            ].map((opt) => (
              <button
                key={opt.method}
                onClick={() => {
                  console.log("Share via", opt.method)
                  setShowShareModal(false)
                }}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "24px" }}>{opt.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{opt.method}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
