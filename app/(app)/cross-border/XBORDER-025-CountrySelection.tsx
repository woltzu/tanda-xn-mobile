"use client"

import { useState } from "react"

export default function CountrySelectionScreen() {
  const [searchQuery, setSearchQuery] = useState("")

  const countries = [
    { code: "CM", name: "Cameroon", flag: "🇨🇲", currency: "XAF", rate: 605.5, popular: true },
    { code: "SN", name: "Senegal", flag: "🇸🇳", currency: "XOF", rate: 605.5, popular: true },
    { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", rate: 1550.2, popular: true },
    { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF", rate: 605.5, popular: true },
    { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", rate: 153.8, popular: false },
    { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", rate: 12.45, popular: false },
    { code: "ET", name: "Ethiopia", flag: "🇪🇹", currency: "ETB", rate: 56.8, popular: false },
    { code: "TZ", name: "Tanzania", flag: "🇹🇿", currency: "TZS", rate: 2520, popular: false },
    { code: "UG", name: "Uganda", flag: "🇺🇬", currency: "UGX", rate: 3750, popular: false },
    { code: "RW", name: "Rwanda", flag: "🇷🇼", currency: "RWF", rate: 1280, popular: false },
    { code: "ML", name: "Mali", flag: "🇲🇱", currency: "XOF", rate: 605.5, popular: false },
    { code: "BF", name: "Burkina Faso", flag: "🇧🇫", currency: "XOF", rate: 605.5, popular: false },
  ]

  const popularCountries = countries.filter((c) => c.popular)
  const filteredCountries = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleBack = () => console.log("Back")
  const handleSelectCountry = (country: any) => console.log("Selected:", country)

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Where to?</h1>
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
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search countries..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: "15px",
              color: "#FFFFFF",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {!searchQuery && (
          <>
            {/* Popular Countries */}
            <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>
              POPULAR DESTINATIONS
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
              {popularCountries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => handleSelectCountry(country)}
                  style={{
                    padding: "16px",
                    background: "#FFFFFF",
                    borderRadius: "14px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>{country.flag}</span>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{country.name}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                    1 USD = {country.rate} {country.currency}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* All Countries */}
        <h3 style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>
          {searchQuery ? "SEARCH RESULTS" : "ALL COUNTRIES"}
        </h3>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {filteredCountries.length > 0 ? (
            filteredCountries.map((country, idx) => (
              <button
                key={country.code}
                onClick={() => handleSelectCountry(country)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  background: "#FFFFFF",
                  border: "none",
                  borderBottom: idx < filteredCountries.length - 1 ? "1px solid #F5F7FA" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "28px" }}>{country.flag}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{country.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{country.currency}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>{country.rate}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#9CA3AF" }}>per USD</p>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No countries found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Coming Soon Note */}
        <p style={{ margin: "16px 0 0 0", fontSize: "11px", color: "#9CA3AF", textAlign: "center" }}>
          More countries coming soon! Request a corridor at support@tandaxn.com
        </p>
      </div>
    </div>
  )
}
