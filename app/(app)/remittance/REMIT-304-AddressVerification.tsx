"use client"

import { useState } from "react"

export default function AddressVerificationScreen() {
  const detectedAddress = {
    street: "123 Main Street, Apt 4B",
    city: "Brooklyn",
    state: "NY",
    zip: "11201",
    country: "United States",
  }

  const documentTypes = [
    {
      id: "utility",
      name: "Utility Bill",
      icon: "💡",
      description: "Electric, gas, or water bill",
      maxAge: "3 months",
    },
    { id: "bank", name: "Bank Statement", icon: "🏦", description: "From any US bank", maxAge: "3 months" },
    { id: "lease", name: "Lease Agreement", icon: "🏠", description: "Current rental agreement", maxAge: "12 months" },
    { id: "tax", name: "Tax Document", icon: "📄", description: "W-2, 1099, or tax return", maxAge: "12 months" },
  ]

  const [step, setStep] = useState("address") // address, document, capture, review
  const [address, setAddress] = useState(detectedAddress)
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null)
  const [documentCaptured, setDocumentCaptured] = useState(false)
  const [useManualAddress, setUseManualAddress] = useState(false)

  const handleBack = () => console.log("Navigate back")
  const handleSubmit = () => console.log("Submit verification")

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Confirm Your Address</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Step 2 of 3 • Takes ~2 minutes</p>
          </div>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🏠
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: "8px" }}>
          {["Address", "Document", "Review"].map((label, idx) => {
            const currentIdx = ["address", "document", "capture", "review"].indexOf(step)
            const stepIdx = idx === 2 ? 3 : idx
            const isComplete = stepIdx < currentIdx
            const isCurrent =
              (step === "address" && idx === 0) ||
              ((step === "document" || step === "capture") && idx === 1) ||
              (step === "review" && idx === 2)

            return (
              <div key={label} style={{ flex: 1 }}>
                <div
                  style={{
                    height: "4px",
                    borderRadius: "2px",
                    background: isComplete ? "#00C6AE" : isCurrent ? "rgba(0,198,174,0.5)" : "rgba(255,255,255,0.2)",
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Step: Confirm Address */}
        {step === "address" && (
          <>
            {/* Detected Address */}
            {detectedAddress && !useManualAddress && (
              <div
                style={{
                  background: "#F0FDFB",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "16px",
                  border: "2px solid #00C6AE",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#00897B" }}>
                    Address detected from your ID
                  </span>
                </div>

                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{address.street}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6B7280" }}>
                    {address.city}, {address.state} {address.zip}
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "14px", color: "#6B7280" }}>{address.country}</p>
                </div>

                <button
                  onClick={() => setUseManualAddress(true)}
                  style={{
                    marginTop: "12px",
                    padding: "8px",
                    background: "none",
                    border: "none",
                    color: "#00897B",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Use a different address
                </button>
              </div>
            )}

            {/* Manual Address Entry */}
            {(useManualAddress || !detectedAddress) && (
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
                  Enter Your Address
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={address.street}
                      onChange={(e) => setAddress({ ...address, street: e.target.value })}
                      placeholder="123 Main St, Apt 4B"
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #E5E7EB",
                        fontSize: "14px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 2 }}>
                      <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                        City
                      </label>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          fontSize: "14px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                        State
                      </label>
                      <input
                        type="text"
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        maxLength={2}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          fontSize: "14px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        value={address.zip}
                        onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                        maxLength={10}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          fontSize: "14px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "12px", color: "#6B7280", marginBottom: "6px" }}>
                        Country
                      </label>
                      <input
                        type="text"
                        value={address.country}
                        disabled
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          fontSize: "14px",
                          boxSizing: "border-box",
                          background: "#F5F7FA",
                          color: "#6B7280",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep("document")}
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
              Confirm & Continue
            </button>
          </>
        )}

        {/* Step: Select Document Type */}
        {step === "document" && (
          <>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Proof of Address
              </h3>
              <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#6B7280" }}>
                Select the document you'd like to use
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {documentTypes.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocType(doc.id)
                      setStep("capture")
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
                    <span style={{ fontSize: "28px" }}>{doc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{doc.name}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                        {doc.description} • Within {doc.maxAge}
                      </p>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div
              style={{
                background: "#FEF3C7",
                borderRadius: "14px",
                padding: "14px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#92400E" }}>
                📋 Document Requirements
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  "Document must show your name",
                  "Address must match what you entered",
                  "Document must be dated within the time limit",
                  "All text must be clearly readable",
                ].map((req, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#D97706" }} />
                    <span style={{ fontSize: "12px", color: "#B45309" }}>{req}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step: Capture Document */}
        {step === "capture" && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "1.4",
                background: "#0A2342",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "85%",
                  height: "80%",
                  border: "3px dashed rgba(0,198,174,0.6)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ textAlign: "center", color: "#FFFFFF" }}>
                  <span style={{ fontSize: "48px" }}>{documentTypes.find((d) => d.id === selectedDocType)?.icon}</span>
                  <p style={{ margin: "12px 0 0 0", fontSize: "14px", opacity: 0.8 }}>
                    Position your {documentTypes.find((d) => d.id === selectedDocType)?.name}
                  </p>
                </div>
              </div>
            </div>

            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              Capture Your Document
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#6B7280" }}>
              Make sure your name and address are clearly visible
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setDocumentCaptured(true)
                  setStep("review")
                }}
                style={{
                  flex: 1,
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
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Take Photo
              </button>
            </div>

            <button
              onClick={() => {
                setDocumentCaptured(true)
                setStep("review")
              }}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "12px",
                background: "none",
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                fontSize: "14px",
                color: "#6B7280",
                cursor: "pointer",
              }}
            >
              Upload from Gallery
            </button>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <>
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "#00C6AE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Document Captured!</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>Review your submission below</p>
              </div>
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "16px",
                border: "1px solid #E5E7EB",
                marginBottom: "16px",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Address</h3>
              <div
                style={{
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", color: "#0A2342" }}>{address.street}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                  {address.city}, {address.state} {address.zip}
                </p>
              </div>

              <h3 style={{ margin: "16px 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                Document
              </h3>
              <div
                style={{
                  aspectRatio: "1.6",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #00C6AE",
                  position: "relative",
                }}
              >
                <span style={{ fontSize: "48px" }}>{documentTypes.find((d) => d.id === selectedDocType)?.icon}</span>
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>

              <button
                onClick={() => setStep("document")}
                style={{
                  width: "100%",
                  marginTop: "12px",
                  padding: "10px",
                  background: "none",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
              >
                Choose Different Document
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bottom CTA */}
      {step === "review" && (
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
            onClick={handleSubmit}
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
            Submit Address Verification
          </button>
        </div>
      )}
    </div>
  )
}
