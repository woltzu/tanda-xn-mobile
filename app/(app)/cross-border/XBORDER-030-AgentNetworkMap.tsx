"use client"

import { useState } from "react"

export default function AgentNetworkMapScreen() {
  const destination = { country: "Cameroon", city: "Douala", flag: "🇨🇲" }
  const agents = [
    {
      id: "a1",
      name: "Express Money Akwa",
      address: "123 Rue de la Joie, Akwa",
      distance: "0.3 km",
      hours: "8AM - 6PM",
      rating: 4.8,
      cashLimit: 500000,
    },
    {
      id: "a2",
      name: "TandaXn Partner - Bonanjo",
      address: "45 Avenue de Gaulle, Bonanjo",
      distance: "1.2 km",
      hours: "9AM - 5PM",
      rating: 4.9,
      cashLimit: 1000000,
    },
    {
      id: "a3",
      name: "Quick Cash Deido",
      address: "78 Carrefour Deido",
      distance: "2.5 km",
      hours: "7AM - 8PM",
      rating: 4.5,
      cashLimit: 300000,
    },
    {
      id: "a4",
      name: "Money Express Bonapriso",
      address: "12 Rue Foch, Bonapriso",
      distance: "3.1 km",
      hours: "8AM - 7PM",
      rating: 4.7,
      cashLimit: 750000,
    },
  ]

  const [viewMode, setViewMode] = useState("list")

  const handleBack = () => console.log("Back")
  const handleSelectAgent = (agent: (typeof agents)[0]) => console.log("Select Agent:", agent)
  const handleGetDirections = (agent: (typeof agents)[0]) => console.log("Get Directions:", agent)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Cash Pickup Agents</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
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
              color: viewMode === "list" ? "#0A2342" : "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode("map")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: viewMode === "map" ? "#FFFFFF" : "transparent",
              color: viewMode === "map" ? "#0A2342" : "#FFFFFF",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Map View
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {viewMode === "map" ? (
          <div
            style={{
              background: "#E5E7EB",
              borderRadius: "16px",
              height: "300px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "40px" }}>🗺️</span>
              <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#6B7280" }}>Map view coming soon</p>
            </div>
          </div>
        ) : null}

        {/* Agents List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "16px",
                border: "1px solid #E5E7EB",
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
                <div>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{agent.name}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{agent.address}</p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    background: "#FEF3C7",
                    borderRadius: "6px",
                  }}
                >
                  <span style={{ fontSize: "12px" }}>⭐</span>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#92400E" }}>{agent.rating}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{agent.distance}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{agent.hours}</span>
                </div>
              </div>

              <div
                style={{
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "11px", color: "#6B7280" }}>Cash available up to:</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  {agent.cashLimit.toLocaleString()} XAF
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => handleSelectAgent(agent)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#00C6AE",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  Select Agent
                </button>
                <button
                  onClick={() => handleGetDirections(agent)}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
