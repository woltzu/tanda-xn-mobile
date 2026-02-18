"use client"

import { useState } from "react"

export default function ExportDataScreen() {
  const [selectedData, setSelectedData] = useState({
    profile: true,
    transactions: true,
    circles: true,
    transfers: true,
  })
  const [exporting, setExporting] = useState(false)

  const toggleData = (key: string) => {
    setSelectedData((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
  }

  const handleExport = () => {
    setExporting(true)
    console.log("Exporting data:", selectedData)
    setTimeout(() => setExporting(false), 2000)
  }

  const handleBack = () => {
    console.log("Navigating back...")
  }

  const dataOptions = [
    { key: "profile", label: "Profile Information", description: "Name, email, phone, address" },
    { key: "transactions", label: "Transaction History", description: "All payments and deposits" },
    { key: "circles", label: "Circle Data", description: "Circle memberships and contributions" },
    { key: "transfers", label: "International Transfers", description: "Remittance history" },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
      }}
    >
      {/* Header - Navy */}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Export Your Data</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Download a copy of your data</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            {
              "📁 Your data will be exported as a ZIP file containing JSON and CSV formats. This may take a few minutes to prepare."
            }
          </p>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F5F7FA" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Select Data to Export</h3>
          </div>

          {dataOptions.map((option, idx) => (
            <button
              key={option.key}
              onClick={() => toggleData(option.key)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderBottom: idx < dataOptions.length - 1 ? "1px solid #F5F7FA" : "none",
                background: "#FFFFFF",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "left",
              }}
            >
              <div>
                <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                  {option.label}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{option.description}</p>
              </div>
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  border: selectedData[option.key as keyof typeof selectedData] ? "none" : "2px solid #E5E7EB",
                  background: selectedData[option.key as keyof typeof selectedData] ? "#00C6AE" : "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selectedData[option.key as keyof typeof selectedData] && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Export Button */}
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
          onClick={handleExport}
          disabled={exporting || !Object.values(selectedData).some((v) => v)}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: exporting ? "#E5E7EB" : "#00C6AE",
            fontSize: "16px",
            fontWeight: "600",
            color: exporting ? "#9CA3AF" : "#FFFFFF",
            cursor: exporting ? "not-allowed" : "pointer",
          }}
        >
          {exporting ? "Preparing Export..." : "Export Data"}
        </button>
      </div>
    </div>
  )
}
