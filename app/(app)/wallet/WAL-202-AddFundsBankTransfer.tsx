"use client"

import { useState } from "react"

export default function AddFundsBankTransferScreen() {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const amount = 200
  const bankDetails = {
    bankName: "TandaXn Trust",
    accountName: "TandaXn Holdings LLC",
    routingNumber: "026009593",
    accountNumber: "4829173650",
    reference: "TXN-FRANCK-2025",
  }

  const handleCopy = (field: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const bankFields = [
    { id: "bankName", label: "Bank Name", value: bankDetails.bankName, important: false },
    { id: "accountName", label: "Account Name", value: bankDetails.accountName, important: false },
    { id: "routingNumber", label: "Routing Number", value: bankDetails.routingNumber, important: false },
    { id: "accountNumber", label: "Account Number", value: bankDetails.accountNumber, important: false },
    { id: "reference", label: "Reference (Required)", value: bankDetails.reference, important: true },
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
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Bank Transfer</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Adding ${amount.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Instructions Card */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#065F46" }}>Transfer from your bank</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#047857", lineHeight: 1.5 }}>
              Use the details below to transfer funds from your bank account. Transfers typically arrive within 1-3
              business days.
            </p>
          </div>
        </div>

        {/* Bank Details */}
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
            Transfer Details
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bankFields.map((field) => (
              <div
                key={field.id}
                style={{
                  padding: "14px",
                  background: field.important ? "#FEF3C7" : "#F5F7FA",
                  borderRadius: "10px",
                  border: field.important ? "1px solid #D97706" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "11px",
                        color: field.important ? "#92400E" : "#6B7280",
                        fontWeight: field.important ? "600" : "400",
                      }}
                    >
                      {field.label}
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#0A2342",
                        fontFamily: field.id.includes("Number") || field.id === "reference" ? "monospace" : "inherit",
                      }}
                    >
                      {field.value}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(field.id, field.value)}
                    style={{
                      padding: "8px 12px",
                      background: copiedField === field.id ? "#00C6AE" : "#FFFFFF",
                      border: copiedField === field.id ? "none" : "1px solid #E5E7EB",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "500",
                      color: copiedField === field.id ? "#FFFFFF" : "#6B7280",
                    }}
                  >
                    {copiedField === field.id ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Important Warning */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
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
            stroke="#D97706"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400E", lineHeight: 1.5 }}>
            <strong>Important:</strong> Always include the reference code in your transfer. Without it, we cannot match
            your deposit to your account and it may take longer to process.
          </p>
        </div>

        {/* Timeline */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            What Happens Next
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { step: 1, title: "You initiate the transfer", desc: "From your bank app or website" },
              { step: 2, title: "We receive your transfer", desc: "Usually 1-3 business days" },
              { step: 3, title: "Funds added to wallet", desc: "You'll get a notification" },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "12px",
                    color: "#0A2342",
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{item.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Done Button */}
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
          onClick={() => console.log("Continue")}
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
          I've Initiated the Transfer
        </button>
      </div>
    </div>
  )
}
