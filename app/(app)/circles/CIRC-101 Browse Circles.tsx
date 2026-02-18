"use client"
import { useState } from "react"

export default function BrowseCirclesScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")

  // Mock data
  const circles = [
    {
      id: "c1",
      name: "Diaspora Family Fund",
      type: "family",
      members: 8,
      maxMembers: 12,
      contribution: 200,
      frequency: "monthly",
      totalPool: 2400,
      minScore: 50,
      featured: true,
      verified: true,
      description: "Supporting families back home together",
      location: "USA → Kenya",
      nextPayout: "Jan 15",
    },
    {
      id: "c2",
      name: "Tech Workers Savings",
      type: "work",
      members: 6,
      maxMembers: 8,
      contribution: 500,
      frequency: "biweekly",
      totalPool: 3000,
      minScore: 65,
      featured: true,
      verified: true,
      description: "Bay Area tech professionals",
      location: "San Francisco",
      nextPayout: "Jan 8",
    },
    {
      id: "c3",
      name: "Brooklyn Community Circle",
      type: "community",
      members: 10,
      maxMembers: 12,
      contribution: 100,
      frequency: "weekly",
      totalPool: 1000,
      minScore: 40,
      featured: false,
      verified: true,
      description: "Local savings for local dreams",
      location: "Brooklyn, NY",
      nextPayout: "Dec 30",
    },
    {
      id: "c4",
      name: "New Parents Support",
      type: "family",
      members: 5,
      maxMembers: 8,
      contribution: 150,
      frequency: "monthly",
      totalPool: 750,
      minScore: 45,
      featured: false,
      verified: false,
      description: "Saving for our children's future",
      location: "Nationwide",
      nextPayout: "Jan 20",
    },
    {
      id: "c5",
      name: "Nurses United Fund",
      type: "work",
      members: 11,
      maxMembers: 12,
      contribution: 250,
      frequency: "monthly",
      totalPool: 2750,
      minScore: 55,
      featured: false,
      verified: true,
      description: "Healthcare workers saving together",
      location: "Houston, TX",
      nextPayout: "Jan 5",
    },
  ]

  const userXnScore = 72

  const categories = [
    { id: "all", label: "All", icon: "✨" },
    { id: "family", label: "Family", icon: "👥" },
    { id: "work", label: "Work", icon: "📈" },
    { id: "community", label: "Community", icon: "📍" },
    { id: "friends", label: "Friends", icon: "⭐" },
  ]

  const getTypeColor = (type: string) => {
    switch (type) {
      case "family":
        return { bg: "#F0FDFB", text: "#00897B" }
      case "work":
        return { bg: "#F0FDFB", text: "#00897B" }
      case "community":
        return { bg: "#FEF3C7", text: "#D97706" }
      case "friends":
        return { bg: "#F5F7FA", text: "#0A2342" }
      default:
        return { bg: "#F3F4F6", text: "#6B7280" }
    }
  }

  const filteredCircles = circles.filter((circle) => {
    const matchesSearch =
      circle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      circle.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "all" || circle.type === activeCategory
    return matchesSearch && matchesCategory
  })

  const featuredCircles = filteredCircles.filter((c) => c.featured)
  const regularCircles = filteredCircles.filter((c) => !c.featured)

  const CircleCard = ({ circle, featured = false }: { circle: any; featured?: boolean }) => {
    const typeColor = getTypeColor(circle.type)
    const spotsLeft = circle.maxMembers - circle.members
    const canJoin = userXnScore >= circle.minScore

    return (
      <button
        onClick={() => console.log("Circle clicked:", circle.id)}
        style={{
          width: featured ? "280px" : "100%",
          flexShrink: featured ? 0 : 1,
          background: "#FFFFFF",
          border: "1px solid #E0E0E0",
          borderRadius: "16px",
          padding: "16px",
          cursor: "pointer",
          textAlign: "left",
          position: "relative",
          transition: "all 0.2s ease",
        }}
      >
        {/* Verified Badge */}
        {circle.verified && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "#F0FDFB",
              borderRadius: "6px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#00897B" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span style={{ fontSize: "10px", color: "#00897B", fontWeight: "600" }}>Verified</span>
          </div>
        )}

        {/* Type Badge */}
        <span
          style={{
            display: "inline-block",
            background: typeColor.bg,
            color: typeColor.text,
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: "600",
            textTransform: "capitalize",
            marginBottom: "12px",
          }}
        >
          {circle.type}
        </span>

        {/* Circle Name */}
        <h3
          style={{
            margin: "0 0 6px 0",
            fontSize: "17px",
            fontWeight: "700",
            color: "#0A2342",
            paddingRight: circle.verified ? "70px" : "0",
          }}
        >
          {circle.name}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: "0 0 12px 0",
            fontSize: "13px",
            color: "#666",
            lineHeight: "1.4",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {circle.description}
        </p>

        {/* Stats Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span style={{ fontSize: "13px", color: "#666" }}>
              {circle.members}/{circle.maxMembers}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ fontSize: "13px", color: "#666" }}>{circle.location}</span>
          </div>
        </div>

        {/* Contribution & Pool */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>Contribution</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#0A2342" }}>
              ${circle.contribution}/
              {circle.frequency === "monthly" ? "mo" : circle.frequency === "biweekly" ? "2wk" : "wk"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>Pool Size</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>
              ${circle.totalPool.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            {spotsLeft > 0 ? (
              <span
                style={{
                  fontSize: "12px",
                  color: spotsLeft <= 2 ? "#DC2626" : "#00897B",
                  fontWeight: "600",
                }}
              >
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </span>
            ) : (
              <span style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600" }}>Full</span>
            )}
          </div>

          {!canJoin && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "#F59E0B",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span style={{ fontSize: "11px", fontWeight: "600" }}>Min Score: {circle.minScore}</span>
            </div>
          )}

          {canJoin && spotsLeft > 0 && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </div>
      </button>
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
      {/* Header - Navy Gradient */}
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
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>Browse Circles</h1>
          </div>

          <button
            onClick={() => console.log("Filter")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search circles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px 12px 44px",
              borderRadius: "12px",
              border: "none",
              background: "#FFFFFF",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "#E0E0E0",
                border: "none",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Categories */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  background: isActive ? "#0A2342" : "#F5F7FA",
                  color: isActive ? "#FFFFFF" : "#666",
                  border: "none",
                  borderRadius: "20px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Featured Circles */}
        {featuredCircles.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#0A2342",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✨</span>
                Featured
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                paddingBottom: "8px",
                margin: "0 -20px",
                padding: "0 20px 8px 20px",
              }}
            >
              {featuredCircles.map((circle) => (
                <CircleCard key={circle.id} circle={circle} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Circles */}
        <div>
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "18px",
              fontWeight: "700",
              color: "#0A2342",
            }}
          >
            {activeCategory === "all"
              ? "All Circles"
              : `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Circles`}
            <span
              style={{
                fontSize: "14px",
                fontWeight: "400",
                color: "#666",
                marginLeft: "8px",
              }}
            >
              ({regularCircles.length})
            </span>
          </h2>

          {regularCircles.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                background: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E0E0E0",
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#999"
                strokeWidth="2"
                style={{ marginBottom: "12px" }}
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#0A2342" }}>No circles found</h3>
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Try adjusting your search or filters</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {regularCircles.map((circle) => (
                <CircleCard key={circle.id} circle={circle} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Circle FAB */}
      <button
        onClick={() => console.log("Create circle")}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0, 198, 174, 0.4)",
          zIndex: 20,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
