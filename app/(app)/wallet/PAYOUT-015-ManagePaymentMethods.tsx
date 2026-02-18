"use client"

import { useState } from "react"

export default function ManagePaymentMethodsScreen() {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null)

  const paymentMethods = [
    {
      id: "bank1",
      type: "bank",
      name: "Chase Bank",
      last4: "4532",
      accountType: "Checking",
      primary: true,
      verified: true,
      addedDate: "Oct 15, 2024",
    },
    {
      id: "bank2",
      type: "bank",
      name: "Bank of America",
      last4: "7890",
      accountType: "Savings",
      primary: false,
      verified: true,
      addedDate: "Nov 2, 2024",
    },
    {
      id: "mobile1",
      type: "mobile",
      name: "M-Pesa",
      phone: "+254 7XX XXX 890",
      primary: false,
      verified: true,
      addedDate: "Dec 10, 2024",
    },
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Payment Methods</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>Manage your linked accounts</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Bank Accounts Section */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Bank Accounts</h3>
            <button
              onClick={() => console.log("Add bank")}
              style={{
                padding: "6px 12px",
                background: "#F0FDFB",
                borderRadius: "8px",
                border: "1px solid #00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                color: "#00C6AE",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {paymentMethods
              .filter((m) => m.type === "bank")
              .map((method) => (
                <div
                  key={method.id}
                  style={{
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "12px",
                    border: method.primary ? "2px solid #00C6AE" : "1px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "#0A2342",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                      }}
                    >
                      🏦
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                          {method.name}
                        </p>
                        {method.primary && (
                          <span
                            style={{
                              background: "#00C6AE",
                              color: "#FFFFFF",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "9px",
                              fontWeight: "600",
                            }}
                          >
                            PRIMARY
                          </span>
                        )}
                        {method.verified && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#00C6AE">
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.997-6l7.07-7.071-1.414-1.414-5.656 5.657-2.829-2.829-1.414 1.414L11.003 16z" />
                          </svg>
                        )}
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                        {method.accountType} ••••{method.last4}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #E5E7EB",
                    }}
                  >
                    {!method.primary && (
                      <button
                        onClick={() => console.log("Set primary", method.id)}
                        style={{
                          flex: 1,
                          padding: "8px",
                          background: "#F0FDFB",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#00897B",
                          cursor: "pointer",
                        }}
                      >
                        Set as Primary
                      </button>
                    )}
                    <button
                      onClick={() => setShowRemoveConfirm(method.id)}
                      style={{
                        padding: "8px 16px",
                        background: "#FEE2E2",
                        borderRadius: "8px",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#DC2626",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

            {paymentMethods.filter((m) => m.type === "bank").length === 0 && (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <span style={{ fontSize: "32px" }}>🏦</span>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#6B7280" }}>No bank accounts linked yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Money Section */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Mobile Money</h3>
            <button
              onClick={() => console.log("Add mobile money")}
              style={{
                padding: "6px 12px",
                background: "#F0FDFB",
                borderRadius: "8px",
                border: "1px solid #00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                color: "#00C6AE",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {paymentMethods
              .filter((m) => m.type === "mobile")
              .map((method) => (
                <div
                  key={method.id}
                  style={{
                    padding: "14px",
                    background: "#F5F7FA",
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                      }}
                    >
                      📱
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                          {method.name}
                        </p>
                        {method.verified && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#00C6AE">
                            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.997-6l7.07-7.071-1.414-1.414-5.656 5.657-2.829-2.829-1.414 1.414L11.003 16z" />
                          </svg>
                        )}
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{method.phone}</p>
                    </div>
                    <button
                      onClick={() => setShowRemoveConfirm(method.id)}
                      style={{
                        padding: "8px",
                        background: "#FEE2E2",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

            {paymentMethods.filter((m) => m.type === "mobile").length === 0 && (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <span style={{ fontSize: "32px" }}>📱</span>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                  No mobile money accounts linked
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Security Info */}
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
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>Your accounts are secure</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#3B82F6", lineHeight: 1.5 }}>
              We use bank-level encryption and never store your full account numbers.
            </p>
          </div>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              padding: "24px",
              width: "100%",
              maxWidth: "340px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#FEE2E2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "18px",
                fontWeight: "700",
                color: "#0A2342",
                textAlign: "center",
              }}
            >
              Remove Account?
            </h3>
            <p
              style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", textAlign: "center", lineHeight: 1.5 }}
            >
              You won't be able to withdraw to this account anymore. You can add it back anytime.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowRemoveConfirm(null)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log("Remove", showRemoveConfirm)
                  setShowRemoveConfirm(null)
                }}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#DC2626",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
