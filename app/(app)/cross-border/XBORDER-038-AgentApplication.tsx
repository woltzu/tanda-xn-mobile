"use client"

import { useState } from "react"

export default function AgentApplicationScreen() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    country: "",
    city: "",
    address: "",
    dailyCapacity: "",
    hasLicense: false,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  })

  const businessTypes = [
    { id: "money_transfer", label: "Money Transfer Shop" },
    { id: "retail", label: "Retail Store" },
    { id: "bank", label: "Bank/Microfinance" },
    { id: "mobile", label: "Mobile Money Agent" },
    { id: "other", label: "Other" },
  ]

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else {
      console.log("Navigate back")
    }
  }

  const handleSubmit = () => {
    console.log("Submit application", formData)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Become an Agent</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>Join our global payout network</p>
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: "4px" }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: step >= s ? "#00C6AE" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
        <p style={{ margin: "8px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
          Step {step} of 3: {step === 1 ? "Business Info" : step === 2 ? "Location" : "Contact"}
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {step === 1 && (
          <>
            {/* Benefits Banner */}
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "20px",
                border: "1px solid #00C6AE",
              }}
            >
              <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Why Partner with TandaXn?
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  "Earn commission on every payout",
                  "No upfront costs or fees",
                  "Real-time transaction support",
                  "Join 500+ agents across Africa",
                ].map((benefit, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: "12px", color: "#065F46" }}>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Name */}
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
                style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
              >
                Business Name
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessName: e.target.value }))}
                placeholder="Your registered business name"
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Business Type */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                Type of Business
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {businessTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setFormData((prev) => ({ ...prev, businessType: type.id }))}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: formData.businessType === type.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                      background: formData.businessType === type.id ? "#F0FDFB" : "#FFFFFF",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#0A2342",
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Business Location
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Country
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    background: "#FFFFFF",
                  }}
                >
                  <option value="">Select country</option>
                  <option value="CM">Cameroon 🇨🇲</option>
                  <option value="SN">Senegal 🇸🇳</option>
                  <option value="NG">Nigeria 🇳🇬</option>
                  <option value="KE">Kenya 🇰🇪</option>
                  <option value="GH">Ghana 🇬🇭</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="e.g., Douala"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Full Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Street address, neighborhood, landmarks"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Estimated Daily Cash Capacity (in local currency)
                </label>
                <input
                  type="text"
                  value={formData.dailyCapacity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dailyCapacity: e.target.value }))}
                  placeholder="e.g., 500,000 XAF"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Contact Information
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
                  placeholder="Full name"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder="+237 6XX XXX XXX"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#6B7280",
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                  placeholder="business@email.com"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "15px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Continue Button */}
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
          onClick={() => (step < 3 ? setStep(step + 1) : handleSubmit())}
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
          {step === 3 ? "Submit Application" : "Continue"}
        </button>
      </div>
    </div>
  )
}
