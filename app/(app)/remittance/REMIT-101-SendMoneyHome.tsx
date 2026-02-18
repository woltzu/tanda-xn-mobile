"use client"

import { useState } from "react"
import { TabBarInline } from "../../../components/TabBar"

export default function SendMoneyHome() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  const userBalance = 2450.0
  const recentRecipients = [
    { id: "r1", name: "Mama", country: "Cameroon", flag: "🇨🇲", lastSent: "Dec 15" },
    { id: "r2", name: "Papa", country: "Cameroon", flag: "🇨🇲", lastSent: "Nov 28" },
    { id: "r3", name: "Auntie Grace", country: "Kenya", flag: "🇰🇪", lastSent: "Dec 1" },
  ]
  const popularCountries = [
    { code: "CM", name: "Cameroon", flag: "🇨🇲" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬" },
    { code: "KE", name: "Kenya", flag: "🇰🇪" },
    { code: "GH", name: "Ghana", flag: "🇬🇭" },
    { code: "SN", name: "Senegal", flag: "🇸🇳" },
    { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px", // Space for tab bar
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Send Money Home</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Support your family back home</p>
          </div>
        </div>

        {/* Balance Display */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "12px", opacity: 0.8 }}>Available Balance</p>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>${userBalance.toLocaleString()}</p>
          </div>
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            🌍
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Search */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "4px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ padding: "10px 12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search recipient or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 12px 12px 0",
              border: "none",
              fontSize: "14px",
              color: "#0A2342",
              background: "transparent",
              outline: "none",
            }}
          />
        </div>

        {/* Recent Recipients */}
        {recentRecipients.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Recent Recipients
            </h3>
            <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "4px" }}>
              {recentRecipients.map((recipient) => (
                <button
                  key={recipient.id}
                  onClick={() => console.log("Select recipient:", recipient)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    minWidth: "70px",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "#F0FDFB",
                      border: "2px solid #00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      position: "relative",
                    }}
                  >
                    {recipient.flag}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "-2px",
                        right: "-2px",
                        background: "#00C6AE",
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>{recipient.name}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>{recipient.lastSent}</p>
                  </div>
                </button>
              ))}

              {/* Add New */}
              <button
                onClick={() => console.log("Add new recipient")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  minWidth: "70px",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    border: "2px dashed #E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: "500", color: "#6B7280" }}>Add New</p>
              </button>
            </div>
          </div>
        )}

        {/* Popular Countries */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Send to Country
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {popularCountries.map((country) => (
              <button
                key={country.code}
                onClick={() => console.log("Select country:", country)}
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "28px" }}>{country.flag}</span>
                <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{country.name}</span>
              </button>
            ))}
          </div>

          <button
            style={{
              width: "100%",
              marginTop: "12px",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              fontSize: "13px",
              fontWeight: "500",
              color: "#0A2342",
              cursor: "pointer",
            }}
          >
            View All Countries →
          </button>
        </div>

        {/* Savings Highlight */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "28px" }}>💰</span>
          <div>
            <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Save up to 70% on fees
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#065F46" }}>Compared to traditional remittance services</p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="wallet" />
    </div>
  )
}
