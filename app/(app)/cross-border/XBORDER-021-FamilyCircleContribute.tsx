"use client"

import { useState } from "react"

export default function FamilyCircleContributeScreen() {
  const circle = {
    name: "Mama & Papa Support",
    beneficiary: "Mama Françoise",
    beneficiaryFlag: "🇨🇲",
    goal: 400,
    collected: 200,
    yourShare: 100,
    dueDate: "Feb 1, 2025",
    members: [
      { id: "m1", name: "You", contributed: false, amount: 0 },
      { id: "m2", name: "Marcel", contributed: true, amount: 100 },
      { id: "m3", name: "Claire", contributed: true, amount: 100 },
      { id: "m4", name: "Pierre", contributed: false, amount: 0 },
    ],
  }

  const walletBalance = 2500

  const [amount, setAmount] = useState(circle.yourShare.toString())
  const parsedAmount = Number.parseFloat(amount) || 0
  const canContribute = parsedAmount >= 10 && parsedAmount <= walletBalance

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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Contribute</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>{circle.name}</p>
          </div>
        </div>

        {/* Circle Progress */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px" }}>
              To: {circle.beneficiary} {circle.beneficiaryFlag}
            </span>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>
              ${circle.collected}/${circle.goal}
            </span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.2)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(circle.collected / circle.goal) * 100}%`,
                background: "#00C6AE",
                borderRadius: "3px",
              }}
            />
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: "11px", opacity: 0.8 }}>Sends on {circle.dueDate}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Your Contribution */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "2px solid #00C6AE",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Your Contribution
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "600", color: "#0A2342" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "32px",
                fontWeight: "700",
                color: "#0A2342",
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[50, 100, 150].map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: amount === amt.toString() ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: amount === amt.toString() ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                  cursor: "pointer",
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
          <p style={{ margin: "12px 0 0 0", fontSize: "12px", color: "#6B7280", textAlign: "center" }}>
            Suggested: ${circle.yourShare} (equal split)
          </p>
        </div>

        {/* Members Status */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Circle Members
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {circle.members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: member.contributed ? "#00C6AE" : "#E5E7EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
                  {member.contributed ? "✓" : member.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>
                    {member.name} {member.id === "m1" ? "(You)" : ""}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    background: member.contributed ? "#F0FDFB" : "#FEF3C7",
                    color: member.contributed ? "#00897B" : "#D97706",
                    fontSize: "11px",
                    fontWeight: "600",
                    borderRadius: "6px",
                  }}
                >
                  {member.contributed ? `$${member.amount}` : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px",
            background: "#F0FDFB",
            borderRadius: "12px",
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
            stroke="#00897B"
            strokeWidth="2"
            style={{ marginTop: "2px", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            Your contribution will be held until all members contribute or the send date arrives. You can withdraw if
            the circle doesn't complete.
          </p>
        </div>
      </div>

      {/* Contribute Button */}
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
        <div style={{ marginBottom: "8px", textAlign: "center" }}>
          <span style={{ fontSize: "11px", color: "#6B7280" }}>Wallet balance: ${walletBalance.toLocaleString()}</span>
        </div>
        <button
          disabled={!canContribute}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canContribute ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canContribute ? "#FFFFFF" : "#9CA3AF",
            cursor: canContribute ? "pointer" : "not-allowed",
          }}
        >
          Contribute ${parsedAmount.toFixed(2)}
        </button>
      </div>
    </div>
  )
}
