"use client"
import { ChevronLeft, Check, Clock, Lock, Info } from "lucide-react"

export default function WalletDetailsScreen() {
  const wallet = {
    totalBalance: 1250.0,
    availableBalance: 850.0,
    pendingBalance: 200.0,
    lockedBalance: 200.0,
    currency: "USD",
  }

  const pendingItems = [
    { id: 1, description: "Card deposit processing", amount: 150, expectedDate: "Dec 30, 2025" },
    { id: 2, description: "Bank transfer incoming", amount: 50, expectedDate: "Dec 31, 2025" },
  ]

  const lockedItems = [
    {
      id: 1,
      description: "Family Savings - Cycle 4 commitment",
      amount: 200,
      releaseDate: "After payout",
      circleName: "Family Savings",
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
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
            <ChevronLeft size={24} color="#FFFFFF" />
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Balance Details</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Total Balance Card */}
        <div
          style={{
            background: "#0A2342",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            color: "#FFFFFF",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: "12px", opacity: 0.7 }}>Total Balance</p>
          <p style={{ margin: 0, fontSize: "36px", fontWeight: "700" }}>
            ${wallet.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Available Balance */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
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
              <Check size={22} color="#00C6AE" strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Available Balance</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Ready to use or withdraw</p>
            </div>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#00C6AE" }}>
              ${wallet.availableBalance.toFixed(2)}
            </p>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            This amount can be used immediately for contributions, transfers, or withdrawals to your linked accounts.
          </p>
        </div>

        {/* Pending Balance */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={22} color="#D97706" strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Pending Balance</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Processing deposits</p>
            </div>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#D97706" }}>
              ${wallet.pendingBalance.toFixed(2)}
            </p>
          </div>

          {pendingItems.length > 0 && (
            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: "12px", marginTop: "4px" }}>
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px",
                    background: "#FEF3C7",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#92400E" }}>
                      {item.description}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#B45309" }}>
                      Expected: {item.expectedDate}
                    </p>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#92400E" }}>
                    +${item.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Locked Balance */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock size={22} color="#0A2342" strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Locked Balance</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Reserved for commitments</p>
            </div>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
              ${wallet.lockedBalance.toFixed(2)}
            </p>
          </div>

          {lockedItems.length > 0 && (
            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: "12px", marginTop: "4px" }}>
              {lockedItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px",
                    background: "#F5F7FA",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                      {item.description}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>
                      Release: {item.releaseDate}
                    </p>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                    ${item.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p style={{ margin: "12px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.5 }}>
            Locked funds are reserved for your active circle commitments. They'll be released after your payout or if
            you leave the circle.
          </p>
        </div>

        {/* Info Card */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <Info size={18} color="#00897B" strokeWidth={2} style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Why lock funds?</strong> Locking ensures you can always meet your circle commitments, building trust
            with your fellow members and improving your XnScore.
          </p>
        </div>
      </div>
    </div>
  )
}
