"use client"

import { useState } from "react"

export default function AddRecipientScreen() {
  const [step, setStep] = useState("country") // country, details
  const [selectedCountry, setSelectedCountry] = useState<any>(null)
  const [deliveryMethod, setDeliveryMethod] = useState("mobile")
  const [provider, setProvider] = useState("")
  const [fullName, setFullName] = useState("")
  const [nickname, setNickname] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [markFavorite, setMarkFavorite] = useState(false)

  const countries = [
    { code: "CM", name: "Cameroon", flag: "🇨🇲", currency: "XAF", dialCode: "+237" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", dialCode: "+234" },
    { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", dialCode: "+254" },
    { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", dialCode: "+233" },
    { code: "SN", name: "Senegal", flag: "🇸🇳", currency: "XOF", dialCode: "+221" },
    { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", dialCode: "+91" },
    { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", dialCode: "+63" },
  ]

  const deliveryMethods = [
    { id: "mobile", label: "Mobile Money", icon: "📱", providers: ["MTN", "Orange Money", "M-Pesa"] },
    { id: "bank", label: "Bank Transfer", icon: "🏦", providers: [] },
    { id: "cash", label: "Cash Pickup", icon: "💵", providers: [] },
  ]

  const isValid = fullName.length > 2 && phone.length >= 8

  const handleBack = () => {
    if (step === "details") {
      setStep("country")
    } else {
      console.log("Navigate back to previous screen")
    }
  }

  const handleSave = () => {
    console.log("Save recipient for later")
  }

  const handleSaveAndSend = () => {
    console.log("Save recipient and start transfer")
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Add Recipient</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {step === "country" ? "Select destination country" : `Sending to ${selectedCountry?.name}`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Step: Country Selection */}
        {step === "country" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              Where does this person live?
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {countries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => {
                    setSelectedCountry(country)
                    setStep("details")
                  }}
                  style={{
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "12px",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "32px" }}>{country.flag}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{country.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      {country.currency} • {country.dialCode}
                    </p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Recipient Details */}
        {step === "details" && (
          <>
            {/* Selected Country */}
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "28px" }}>{selectedCountry?.flag}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  {selectedCountry?.name}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#065F46" }}>{selectedCountry?.currency}</p>
              </div>
              <button
                onClick={() => setStep("country")}
                style={{
                  padding: "6px 12px",
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "6px",
                  fontSize: "11px",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
              >
                Change
              </button>
            </div>

            {/* Delivery Method */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Delivery Method
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                {deliveryMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setDeliveryMethod(method.id)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: deliveryMethod === method.id ? "#F0FDFB" : "#F5F7FA",
                      borderRadius: "10px",
                      border: deliveryMethod === method.id ? "2px solid #00C6AE" : "1px solid transparent",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "22px" }}>{method.icon}</span>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "11px",
                        fontWeight: deliveryMethod === method.id ? "600" : "400",
                        color: deliveryMethod === method.id ? "#00897B" : "#6B7280",
                      }}
                    >
                      {method.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Info */}
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
                Recipient Information
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Full Name */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                    Full Name (as registered) *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter recipient's full name"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "14px",
                      color: "#0A2342",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Nickname */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                    Nickname (optional)
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g., Mama, Uncle John"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "14px",
                      color: "#0A2342",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                    Phone Number *
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div
                      style={{
                        padding: "14px",
                        background: "#F5F7FA",
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: "#0A2342",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{selectedCountry?.flag}</span>
                      <span>{selectedCountry?.dialCode}</span>
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                      style={{
                        flex: 1,
                        padding: "14px",
                        borderRadius: "10px",
                        border: "1px solid #E5E7EB",
                        fontSize: "14px",
                        color: "#0A2342",
                      }}
                    />
                  </div>
                </div>

                {/* Email (Optional) */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="For email notifications"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "14px",
                      color: "#0A2342",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Mark as Favorite */}
            <button
              onClick={() => setMarkFavorite(!markFavorite)}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E5E7EB",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  border: markFavorite ? "none" : "2px solid #E5E7EB",
                  background: markFavorite ? "#F59E0B" : "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {markFavorite && <span style={{ fontSize: "12px" }}>⭐</span>}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>Add to Favorites</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                  Quick access when sending money
                </p>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Bottom CTAs */}
      {step === "details" && (
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
            onClick={handleSaveAndSend}
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
              marginBottom: "10px",
            }}
          >
            Save & Send Money
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: "transparent",
              fontSize: "14px",
              fontWeight: "500",
              color: isValid ? "#6B7280" : "#9CA3AF",
              cursor: isValid ? "pointer" : "not-allowed",
            }}
          >
            Save for Later
          </button>
        </div>
      )}
    </div>
  )
}
