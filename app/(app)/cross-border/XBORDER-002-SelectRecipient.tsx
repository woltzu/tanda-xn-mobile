"use client"

import { useState } from "react"

export default function SelectRecipientScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState("all")

  const savedRecipients = [
    {
      id: "r1",
      name: "Mama Françoise",
      country: "Cameroon",
      flag: "🇨🇲",
      method: "MTN MoMo",
      phone: "+237 6XX XXX XX45",
      lastSent: "Dec 20",
    },
    {
      id: "r2",
      name: "Papa Jean",
      country: "Cameroon",
      flag: "🇨🇲",
      method: "Orange Money",
      phone: "+237 6XX XXX XX12",
      lastSent: "Dec 5",
    },
    {
      id: "r3",
      name: "Auntie Marie",
      country: "Senegal",
      flag: "🇸🇳",
      method: "Wave",
      phone: "+221 7X XXX XX89",
      lastSent: "Nov 28",
    },
    {
      id: "r4",
      name: "Uncle Paul",
      country: "Nigeria",
      flag: "🇳🇬",
      method: "Bank Transfer",
      phone: "+234 8XX XXX XXXX",
      lastSent: "Nov 15",
    },
  ]

  const countries = ["all", ...new Set(savedRecipients.map((r) => r.country))]

  const filteredRecipients = savedRecipients.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone.includes(searchQuery)
    const matchesCountry = selectedCountry === "all" || r.country === selectedCountry
    return matchesSearch && matchesCountry
  })

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Select Recipient</h1>
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              fontSize: "15px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Country Filter */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            marginBottom: "16px",
            paddingBottom: "4px",
          }}
        >
          {countries.map((country) => (
            <button
              key={country}
              onClick={() => setSelectedCountry(country)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: selectedCountry === country ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                background: selectedCountry === country ? "#F0FDFB" : "#FFFFFF",
                fontSize: "12px",
                fontWeight: "600",
                color: selectedCountry === country ? "#00897B" : "#6B7280",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {country === "all" ? "All Countries" : country}
            </button>
          ))}
        </div>

        {/* Recipients List */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {filteredRecipients.length > 0 ? (
            filteredRecipients.map((recipient, idx) => (
              <button
                key={recipient.id}
                onClick={() => console.log("Selected recipient:", recipient.name)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "#FFFFFF",
                  border: "none",
                  borderBottom: idx < filteredRecipients.length - 1 ? "1px solid #F5F7FA" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "#0A2342",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: "16px", color: "#FFFFFF", fontWeight: "600" }}>
                    {recipient.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      fontSize: "16px",
                    }}
                  >
                    {recipient.flag}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{recipient.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>📱 {recipient.method}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                    Last sent: {recipient.lastSent}
                  </p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
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
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                No Recipients Found
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                {searchQuery ? "Try a different search" : "Add your first recipient to get started"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add New Button */}
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
          onClick={() => console.log("Add new recipient")}
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add New Recipient
        </button>
      </div>
    </div>
  )
}
