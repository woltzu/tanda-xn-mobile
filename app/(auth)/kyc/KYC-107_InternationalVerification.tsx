"use client"

import { useState } from "react"

export default function InternationalVerification() {
  const interestAmount = 47.83
  const [selectedCountry, setSelectedCountry] = useState("")
  const [idType, setIdType] = useState("")
  const [hasTaxId, setHasTaxId] = useState<boolean | null>(null)

  const countries = [
    { code: "SN", name: "Senegal", flag: "🇸🇳" },
    { code: "GH", name: "Ghana", flag: "🇬🇭" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬" },
    { code: "CM", name: "Cameroon", flag: "🇨🇲" },
    { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
    { code: "KE", name: "Kenya", flag: "🇰🇪" },
    { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦" },
    { code: "MA", name: "Morocco", flag: "🇲🇦" },
    { code: "EG", name: "Egypt", flag: "🇪🇬" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
    { code: "FR", name: "France", flag: "🇫🇷" },
    { code: "CA", name: "Canada", flag: "🇨🇦" },
    { code: "OTHER", name: "Other country", flag: "🌍" },
  ]

  const idTypes = [
    { id: "passport", icon: "🛂", name: "Passport", desc: "Any country" },
    { id: "national_id", icon: "🪪", name: "National ID Card", desc: "Government-issued" },
    { id: "drivers", icon: "🚗", name: "Driver's License", desc: "With photo" },
  ]

  const isValid = selectedCountry && idType && hasTaxId !== null

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* HEADER */}
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>International Verification</h1>
        </div>

        {/* Context */}
        <div
          style={{
            background: "rgba(0,198,174,0.15)",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "18px" }}>💰</span>
          <span style={{ fontSize: "13px" }}>
            Unlocking <strong>${interestAmount.toFixed(2)}</strong> in interest
          </span>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px" }}>
        {/* Country Selection */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "10px",
            }}
          >
            What country are you in?
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              fontSize: "15px",
              color: selectedCountry ? "#0A2342" : "#9CA3AF",
              background: "#FFFFFF",
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' strokeWidth='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
            }}
          >
            <option value="">Select your country</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </div>

        {/* ID Type Selection */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "10px",
            }}
          >
            What ID will you use?
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {idTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setIdType(type.id)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: idType === type.id ? "#F0FDFB" : "#F5F7FA",
                  border: idType === type.id ? "2px solid #00C6AE" : "1px solid transparent",
                  borderRadius: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "22px" }}>{type.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{type.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{type.desc}</p>
                </div>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: idType === type.id ? "6px solid #00C6AE" : "2px solid #D1D5DB",
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Tax ID Question */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#0A2342",
              marginBottom: "6px",
            }}
          >
            Do you have a tax ID in your country?
          </label>
          <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
            This is optional but helps with tax reporting
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setHasTaxId(true)}
              style={{
                flex: 1,
                padding: "12px",
                background: hasTaxId === true ? "#F0FDFB" : "#F5F7FA",
                border: hasTaxId === true ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              Yes, I do
            </button>
            <button
              onClick={() => setHasTaxId(false)}
              style={{
                flex: 1,
                padding: "12px",
                background: hasTaxId === false ? "#F0FDFB" : "#F5F7FA",
                border: hasTaxId === false ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
              }}
            >
              No, I don't
            </button>
          </div>
        </div>

        {/* Info Note */}
        <div
          style={{
            background: "#EFF6FF",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "16px" }}>🌍</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>
              We accept IDs from any country
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#3B82F6", lineHeight: 1.5 }}>
              Your passport or national ID is all you need. We'll verify it in the next step.
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION */}
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
          onClick={() => console.log("Submit", { country: selectedCountry, idType, hasTaxId })}
          disabled={!isValid}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: isValid ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: isValid ? "#FFFFFF" : "#9CA3AF",
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          Continue to ID Verification
        </button>
      </div>
    </div>
  )
}
