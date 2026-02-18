"use client"

import { useState } from "react"

export default function AddBankAccountScreen() {
  const [accountType, setAccountType] = useState("checking")
  const [accountHolder, setAccountHolder] = useState("")
  const [routingNumber, setRoutingNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [confirmAccount, setConfirmAccount] = useState("")
  const [nickname, setNickname] = useState("")
  const [showAccountNumber, setShowAccountNumber] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  const validateRouting = (num: string) => /^\d{9}$/.test(num)
  const validateAccount = (num: string) => /^\d{4,17}$/.test(num)

  const validate = () => {
    const newErrors: Record<string, string | null> = {}
    if (!accountHolder.trim()) newErrors.accountHolder = "Account holder name is required"
    if (!validateRouting(routingNumber)) newErrors.routingNumber = "Enter a valid 9-digit routing number"
    if (!validateAccount(accountNumber)) newErrors.accountNumber = "Enter a valid account number"
    if (accountNumber !== confirmAccount) newErrors.confirmAccount = "Account numbers don't match"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      console.log("Adding bank account:", {
        type: accountType,
        holderName: accountHolder,
        routingNumber,
        accountNumber,
        nickname: nickname || `${accountType.charAt(0).toUpperCase() + accountType.slice(1)} Account`,
      })
    }
  }

  const isValid =
    accountHolder &&
    validateRouting(routingNumber) &&
    validateAccount(accountNumber) &&
    accountNumber === confirmAccount

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Add Bank Account</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Quick Connect Option */}
        <button
          onClick={() => console.log("Connect with Plaid")}
          style={{
            width: "100%",
            padding: "16px",
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "2px solid #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#F0FDFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>Connect Instantly</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Securely link your bank in seconds
            </p>
          </div>
          <span
            style={{
              background: "#00C6AE",
              color: "#FFFFFF",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "10px",
              fontWeight: "600",
            }}
          >
            Recommended
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
          <span style={{ fontSize: "12px", color: "#9CA3AF" }}>or enter manually</span>
          <div style={{ flex: 1, height: "1px", background: "#E5E7EB" }} />
        </div>

        {/* Account Type */}
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
            style={{ display: "block", marginBottom: "10px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Account Type
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            {["checking", "savings"].map((type) => (
              <button
                key={type}
                onClick={() => setAccountType(type)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "12px",
                  border: accountType === type ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: accountType === type ? "#F0FDFB" : "#F5F7FA",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: accountType === type ? "#00C6AE" : "#6B7280",
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Account Holder Name */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: errors.accountHolder ? "1px solid #EF4444" : "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Account Holder Name
          </label>
          <input
            type="text"
            value={accountHolder}
            onChange={(e) => {
              setAccountHolder(e.target.value)
              setErrors({ ...errors, accountHolder: null })
            }}
            placeholder="As it appears on your bank account"
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
          {errors.accountHolder && (
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.accountHolder}</p>
          )}
        </div>

        {/* Routing Number */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: errors.routingNumber ? "1px solid #EF4444" : "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Routing Number
          </label>
          <input
            type="text"
            value={routingNumber}
            onChange={(e) => {
              setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))
              setErrors({ ...errors, routingNumber: null })
            }}
            placeholder="9-digit routing number"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              fontSize: "15px",
              fontFamily: "monospace",
              letterSpacing: "2px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {errors.routingNumber && (
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.routingNumber}</p>
          )}
          <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
            Find this on the bottom left of your checks
          </p>
        </div>

        {/* Account Number */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: errors.accountNumber ? "1px solid #EF4444" : "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Account Number
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showAccountNumber ? "text" : "password"}
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))
                setErrors({ ...errors, accountNumber: null })
              }}
              placeholder="Your account number"
              style={{
                width: "100%",
                padding: "14px",
                paddingRight: "50px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "15px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => setShowAccountNumber(!showAccountNumber)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                {showAccountNumber ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
          {errors.accountNumber && (
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.accountNumber}</p>
          )}
        </div>

        {/* Confirm Account Number */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: errors.confirmAccount
              ? "1px solid #EF4444"
              : accountNumber && confirmAccount && accountNumber === confirmAccount
                ? "1px solid #059669"
                : "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Confirm Account Number
          </label>
          <input
            type={showAccountNumber ? "text" : "password"}
            value={confirmAccount}
            onChange={(e) => {
              setConfirmAccount(e.target.value.replace(/\D/g, "").slice(0, 17))
              setErrors({ ...errors, confirmAccount: null })
            }}
            placeholder="Re-enter account number"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              fontSize: "15px",
              fontFamily: "monospace",
              letterSpacing: "2px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {errors.confirmAccount && (
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.confirmAccount}</p>
          )}
          {accountNumber && confirmAccount && accountNumber === confirmAccount && (
            <p
              style={{
                margin: "6px 0 0 0",
                fontSize: "12px",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Account numbers match
            </p>
          )}
        </div>

        {/* Nickname (Optional) */}
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
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g., My Chase Checking"
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

        {/* Security Note */}
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
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#1E40AF" }}>Bank-level security</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#3B82F6", lineHeight: 1.5 }}>
              Your banking info is encrypted with 256-bit AES and never stored in plain text.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
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
          Add Bank Account
        </button>
      </div>
    </div>
  )
}
