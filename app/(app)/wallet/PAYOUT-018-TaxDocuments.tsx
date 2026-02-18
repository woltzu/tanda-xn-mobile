"use client"

import { useState } from "react"

export default function TaxDocumentsScreen() {
  const taxYear = 2024
  const taxSummary = {
    interestEarned: 47.83,
    bonusesReceived: 190.0,
    totalReportable: 237.83,
    threshold: 10,
    form1099Required: true,
  }
  const documents = [
    {
      id: "doc1",
      type: "1099-INT",
      year: 2024,
      status: "available",
      generatedDate: "Jan 31, 2025",
      amount: 47.83,
    },
    {
      id: "doc2",
      type: "1099-MISC",
      year: 2024,
      status: "available",
      generatedDate: "Jan 31, 2025",
      amount: 190.0,
    },
    {
      id: "doc3",
      type: "1099-INT",
      year: 2023,
      status: "available",
      generatedDate: "Jan 31, 2024",
      amount: 12.5,
    },
  ]
  const yearOptions = [2024, 2023]

  const [selectedYear, setSelectedYear] = useState(taxYear)

  const currentYearDocs = documents.filter((d) => d.year === selectedYear)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Tax Documents</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>1099 forms for interest & earnings</p>
          </div>
        </div>

        {/* Year Selector */}
        <div style={{ display: "flex", gap: "10px" }}>
          {yearOptions.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: selectedYear === year ? "#00C6AE" : "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Tax Summary Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            {selectedYear} Tax Summary
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Interest Earned</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                ${taxSummary.interestEarned.toFixed(2)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#F0FDFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Bonuses & Rewards</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                ${taxSummary.bonusesReceived.toFixed(2)}
              </span>
            </div>

            <div style={{ height: "1px", background: "#E5E7EB" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total Reportable</span>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
                ${taxSummary.totalReportable.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 1099 Status */}
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: taxSummary.form1099Required ? "#FEF3C7" : "#F0FDFB",
              borderRadius: "10px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={taxSummary.form1099Required ? "#D97706" : "#00897B"}
              strokeWidth="2"
              style={{ marginTop: "2px", flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: taxSummary.form1099Required ? "#92400E" : "#065F46",
                }}
              >
                {taxSummary.form1099Required ? "1099 forms are required" : "No 1099 required"}
              </p>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "12px",
                  color: taxSummary.form1099Required ? "#B45309" : "#059669",
                }}
              >
                {taxSummary.form1099Required
                  ? `Earnings exceed $${taxSummary.threshold} threshold`
                  : `Earnings below $${taxSummary.threshold} threshold`}
              </p>
            </div>
          </div>
        </div>

        {/* Available Documents */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Available Documents
          </h3>

          {currentYearDocs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {currentYearDocs.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "12px",
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
                      background: "#0A2342",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                        Form {doc.type}
                      </p>
                      <span
                        style={{
                          background: doc.status === "available" ? "#F0FDFB" : "#FEF3C7",
                          color: doc.status === "available" ? "#00897B" : "#D97706",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "9px",
                          fontWeight: "600",
                        }}
                      >
                        {doc.status === "available" ? "Ready" : "Pending"}
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      ${doc.amount.toFixed(2)} • Generated {doc.generatedDate}
                    </p>
                  </div>
                  <button
                    onClick={() => console.log("Download", doc)}
                    disabled={doc.status !== "available"}
                    style={{
                      padding: "10px 14px",
                      background: doc.status === "available" ? "#00C6AE" : "#E5E7EB",
                      borderRadius: "10px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: doc.status === "available" ? "#FFFFFF" : "#9CA3AF",
                      cursor: doc.status === "available" ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    PDF
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <span style={{ fontSize: "40px" }}>📄</span>
              <p style={{ margin: "12px 0 0 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                No documents for {selectedYear}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Documents become available after January 31st
              </p>
            </div>
          )}
        </div>

        {/* Tax Tips */}
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
            📚 Tax Information
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>1099-INT</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
                Reports interest earned on your savings goals. This is taxable income.
              </p>
            </div>
            <div style={{ padding: "12px", background: "#F5F7FA", borderRadius: "10px" }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>1099-MISC</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
                Reports bonuses and rewards earned through referrals and early payments.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <p style={{ margin: 0, fontSize: "11px", color: "#6B7280", lineHeight: 1.6 }}>
            <strong>Disclaimer:</strong> TandaXn provides tax documents for informational purposes. Please consult a
            qualified tax professional for advice specific to your situation. We are not responsible for how you report
            this income.
          </p>
        </div>

        {/* Need Help */}
        <button
          onClick={() => console.log("Contact support")}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Questions about taxes?</span>
        </button>
      </div>
    </div>
  )
}
