"use client"

import { useState } from "react"

export default function EditPaymentMethodScreen() {
  const account = {
    id: "bank1",
    type: "bank",
    name: "Chase Bank",
    last4: "4532",
    accountType: "Checking",
    nickname: "Main Checking",
    verified: true,
    primary: true,
    addedAt: "2024-01-15",
    lastUsed: "2024-01-20",
  }

  const [nickname, setNickname] = useState(account.nickname || "")
  const [hasChanges, setHasChanges] = useState(false)

  const handleNicknameChange = (value: string) => {
    setNickname(value)
    setHasChanges(value !== (account.nickname || ""))
  }

  const getIcon = () => {
    switch (account.type) {
      case "bank":
        return "🏦"
      case "card":
        return "💳"
      case "mobilemoney":
        return "📱"
      default:
        return "💰"
    }
  }

  const getTypeLabel = () => {
    switch (account.type) {
      case "bank":
        return "Bank Account"
      case "card":
        return "Debit/Credit Card"
      case "mobilemoney":
        return "Mobile Money"
      default:
        return "Payment Method"
    }
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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Manage Account</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Account Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
              }}
            >
              {getIcon()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>{account.name}</h2>
                {account.primary && (
                  <span
                    style={{
                      background: "#F0FDFB",
                      color: "#00897B",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      fontWeight: "700",
                    }}
                  >
                    PRIMARY
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6B7280" }}>
                {account.accountType} •••• {account.last4}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              background: account.verified ? "#F0FDFB" : "#FEF3C7",
              borderRadius: "10px",
            }}
          >
            {account.verified ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#00897B" }}>Verified</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#92400E" }}>Pending Verification</span>
                <button
                  onClick={() => console.log("Verify")}
                  style={{
                    marginLeft: "auto",
                    padding: "6px 12px",
                    background: "#D97706",
                    border: "none",
                    borderRadius: "6px",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Verify Now
                </button>
              </>
            )}
          </div>
        </div>

        {/* Edit Nickname */}
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
            Nickname (Optional)
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => handleNicknameChange(e.target.value)}
            placeholder="e.g., Main Checking, Savings"
            maxLength={30}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
            Give this account a name to easily identify it
          </p>
        </div>

        {/* Set as Primary */}
        {!account.primary && (
          <button
            onClick={() => console.log("Set as primary")}
            style={{
              width: "100%",
              padding: "16px",
              background: "#FFFFFF",
              borderRadius: "14px",
              border: "1px solid #E5E7EB",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#F0FDFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Set as Primary</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                Use this account by default for deposits
              </p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Account Details */}
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
            Account Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Type</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{getTypeLabel()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Account ending</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>•••• {account.last4}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#6B7280" }}>Added on</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {new Date(account.addedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            {account.lastUsed && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>Last used</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  {new Date(account.lastUsed).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Remove Account */}
        <button
          onClick={() => console.log("Remove account")}
          style={{
            width: "100%",
            padding: "16px",
            background: "#FEF2F2",
            borderRadius: "14px",
            border: "1px solid #FECACA",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#FEE2E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#DC2626" }}>Remove Account</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#991B1B" }}>Unlink this payment method</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Save Button */}
      {hasChanges && (
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
            onClick={() => console.log("Save changes", { nickname })}
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
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}
