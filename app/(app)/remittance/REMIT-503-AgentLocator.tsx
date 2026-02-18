"use client"

import { useState } from "react"

export default function AgentLocatorScreen() {
  const destination = {
    country: "Cameroon",
    city: "Douala",
    flag: "🇨🇲",
  }

  const agents = [
    {
      id: "a1",
      name: "Express Union - Akwa Center",
      type: "Express Union",
      address: "123 Boulevard de la Liberté, Akwa",
      distance: "0.8 km",
      rating: 4.8,
      reviews: 124,
      hours: "8:00 AM - 6:00 PM",
      isOpen: true,
      services: ["Cash Pickup", "Mobile Money"],
      lat: 4.0511,
      lng: 9.7679,
    },
    {
      id: "a2",
      name: "MTN Mobile Money Agent",
      type: "MTN",
      address: "45 Rue Joss, Bonanjo",
      distance: "1.2 km",
      rating: 4.5,
      reviews: 89,
      hours: "7:00 AM - 8:00 PM",
      isOpen: true,
      services: ["Mobile Money", "Airtime"],
      lat: 4.0483,
      lng: 9.7044,
    },
    {
      id: "a3",
      name: "Western Union - Carrefour",
      type: "Western Union",
      address: "Carrefour Shopping Mall, Bonapriso",
      distance: "2.1 km",
      rating: 4.2,
      reviews: 56,
      hours: "9:00 AM - 5:00 PM",
      isOpen: false,
      services: ["Cash Pickup"],
      lat: 4.0228,
      lng: 9.6987,
    },
    {
      id: "a4",
      name: "Orange Money Kiosk",
      type: "Orange",
      address: "Near Marché Central",
      distance: "1.5 km",
      rating: 4.6,
      reviews: 201,
      hours: "6:00 AM - 9:00 PM",
      isOpen: true,
      services: ["Mobile Money", "Bill Pay"],
      lat: 4.0345,
      lng: 9.7123,
    },
  ]

  const [viewMode, setViewMode] = useState("list")
  const [selectedAgent, setSelectedAgent] = useState<(typeof agents)[0] | null>(null)
  const [filter, setFilter] = useState("all")

  const filteredAgents = agents
    .filter((agent) => {
      if (filter === "open") return agent.isOpen
      return true
    })
    .sort((a, b) => {
      if (filter === "nearest") {
        return Number.parseFloat(a.distance) - Number.parseFloat(b.distance)
      }
      return 0
    })

  const renderRatingStars = (rating: number) => {
    return "⭐".repeat(Math.floor(rating))
  }

  const handleBack = () => console.log("Navigate back")
  const handleGetDirections = (agent: (typeof agents)[0]) => {
    console.log("Get directions to", agent.name)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: viewMode === "list" ? "40px" : "0",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Find Agent</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {destination.city}, {destination.country} {destination.flag}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "10px",
            padding: "4px",
          }}
        >
          <button
            onClick={() => setViewMode("list")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: viewMode === "list" ? "#FFFFFF" : "transparent",
              fontSize: "13px",
              fontWeight: "500",
              color: viewMode === "list" ? "#0A2342" : "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            List
          </button>
          <button
            onClick={() => setViewMode("map")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: viewMode === "map" ? "#FFFFFF" : "transparent",
              fontSize: "13px",
              fontWeight: "500",
              color: viewMode === "map" ? "#0A2342" : "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Map
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div
        style={{
          padding: "12px 20px",
          display: "flex",
          gap: "8px",
          overflowX: "auto",
        }}
      >
        {[
          { value: "all", label: "All" },
          { value: "open", label: "Open Now" },
          { value: "nearest", label: "Nearest" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: filter === f.value ? "none" : "1px solid #E5E7EB",
              background: filter === f.value ? "#0A2342" : "#FFFFFF",
              fontSize: "12px",
              fontWeight: "500",
              color: filter === f.value ? "#FFFFFF" : "#6B7280",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <div style={{ padding: "0 20px" }}>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            {filteredAgents.length} agents found
          </p>

          {filteredAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              style={{
                width: "100%",
                padding: "16px",
                background: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E5E7EB",
                marginBottom: "12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "10px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{agent.name}</p>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: agent.isOpen ? "#D1FAE5" : "#FEE2E2",
                        color: agent.isOpen ? "#059669" : "#DC2626",
                        fontSize: "10px",
                        fontWeight: "600",
                        borderRadius: "4px",
                      }}
                    >
                      {agent.isOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{agent.address}</p>
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    background: "#F0FDFB",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#00C6AE" }}>{agent.distance}</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px" }}>{renderRatingStars(agent.rating)}</span>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>
                    {agent.rating} ({agent.reviews})
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>🕐 {agent.hours}</span>
              </div>

              {/* Services */}
              <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                {agent.services.map((service) => (
                  <span
                    key={service}
                    style={{
                      padding: "4px 8px",
                      background: "#F5F7FA",
                      borderRadius: "4px",
                      fontSize: "10px",
                      color: "#6B7280",
                    }}
                  >
                    {service}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Map View Placeholder */
        <div
          style={{
            height: "calc(100vh - 180px)",
            background: "#E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
            }}
          >
            🗺️
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>Map view coming soon</p>
          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>Use list view to find agents</p>
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,35,66,0.8)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 100,
          }}
          onClick={() => setSelectedAgent(null)}
        >
          <div
            style={{
              width: "100%",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "20px 20px 40px 20px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "40px",
                height: "4px",
                background: "#E5E7EB",
                borderRadius: "2px",
                margin: "0 auto 20px auto",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                  {selectedAgent.name}
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{selectedAgent.type}</p>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  background: selectedAgent.isOpen ? "#D1FAE5" : "#FEE2E2",
                  color: selectedAgent.isOpen ? "#059669" : "#DC2626",
                  fontSize: "11px",
                  fontWeight: "600",
                  borderRadius: "6px",
                }}
              >
                {selectedAgent.isOpen ? "OPEN" : "CLOSED"}
              </span>
            </div>

            {/* Info Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              <div style={{ padding: "14px", background: "#F5F7FA", borderRadius: "12px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>Distance</p>
                <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                  {selectedAgent.distance}
                </p>
              </div>
              <div style={{ padding: "14px", background: "#F5F7FA", borderRadius: "12px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#6B7280" }}>Rating</p>
                <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                  ⭐ {selectedAgent.rating}
                </p>
              </div>
            </div>

            {/* Address */}
            <div
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <div>
                  <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                    {selectedAgent.address}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>🕐 {selectedAgent.hours}</p>
                </div>
              </div>
            </div>

            {/* Services */}
            <div style={{ marginBottom: "20px" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>
                Services Available
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {selectedAgent.services.map((service) => (
                  <span
                    key={service}
                    style={{
                      padding: "8px 14px",
                      background: "#F0FDFB",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "#00897B",
                    }}
                  >
                    ✓ {service}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={() => handleGetDirections(selectedAgent)}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Get Directions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
