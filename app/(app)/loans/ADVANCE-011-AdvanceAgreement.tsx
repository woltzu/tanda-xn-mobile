"use client"

export default function AdvanceAgreementScreen() {
  const advance = {
    id: "ADV-2025-0120-001",
    amount: 300,
    fee: 15,
    total: 315,
    rate: 9.5,
    circleName: "Family Circle",
    payoutAmount: 500,
    withholdingDate: "Feb 15, 2025",
  }

  const agreementDate = "Jan 20, 2025"
  const userName = "Franck"

  const sections = [
    {
      title: "1. NATURE OF ADVANCE",
      content: `This Advance Payout Agreement ("Agreement") is NOT a traditional loan. You are receiving early access to your own future circle payout from "${advance.circleName}". TandaXn is advancing you funds that you have already earned through your circle participation.`,
    },
    {
      title: "2. ADVANCE TERMS",
      content: `Advance Amount: $${advance.amount}\nAdvance Fee (${advance.rate}%): $${advance.fee}\nTotal to Repay: $${advance.total}\n\nThis advance is secured by your upcoming payout of $${advance.payoutAmount} scheduled for ${advance.withholdingDate}.`,
    },
    {
      title: "3. AUTO-WITHHOLDING AUTHORIZATION",
      content: `By accepting this advance, you authorize TandaXn to automatically withhold $${advance.total} from your circle payout on ${advance.withholdingDate}. No additional action is required from you. After withholding, the remaining balance of $${advance.payoutAmount - advance.total} will be credited to your wallet.`,
    },
    {
      title: "4. EARLY REPAYMENT",
      content: `You may repay this advance early at any time without penalty. Early repayment will result in a reduced advance fee calculated on a pro-rata basis. Early repayment positively impacts your XnScore.`,
    },
    {
      title: "5. MISSED WITHHOLDING (DEFAULT)",
      content: `If your payout is insufficient to cover the advance:\n\n• Your XnScore will decrease by 20 points\n• You may be restricted from joining new circles\n• You may be ineligible for future advances\n• The outstanding balance will be deducted from future payouts\n\nTandaXn does NOT use external collection agencies. All collection occurs within the TandaXn ecosystem.`,
    },
    {
      title: "6. XNSCORE IMPACT",
      content: `Your XnScore (Trust Score) is affected as follows:\n\n• On-time repayment: +1 to +5 points (based on advance size)\n• Early repayment: Additional +2 points\n• Missed withholding: -20 points\n\nYour current XnScore determines your eligibility for future advances and rates offered.`,
    },
    {
      title: "7. NO TRADITIONAL CREDIT REPORTING",
      content: `TandaXn does not report to traditional credit bureaus. This advance will not appear on your credit report. However, your TandaXn XnScore is maintained internally and affects your standing within the TandaXn community.`,
    },
    {
      title: "8. DISPUTE RESOLUTION",
      content: `Any disputes regarding this advance will be resolved through TandaXn's internal dispute resolution process. You may contact support at any time to discuss hardship options or payment arrangements.`,
    },
    {
      title: "9. ACKNOWLEDGMENT",
      content: `By accepting this advance, you acknowledge that:\n\n• You understand this is an advance on your future payout, not a loan\n• You authorize auto-withholding from your payout\n• You understand the XnScore consequences of non-payment\n• You have read and agree to these terms`,
    },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
      }}
    >
      {/* Header - Navy */}
      <div
        style={{
          background: "#0A2342",
          padding: "20px",
          color: "#FFFFFF",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Advance Payout Agreement</h1>
              <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.8 }}>{advance.id}</p>
            </div>
          </div>
          <button
            onClick={() => console.log("Download PDF")}
            style={{
              padding: "8px 14px",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
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
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Header Info */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
              ADVANCE PAYOUT AGREEMENT
            </h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
              TandaXn Inc. • Effective Date: {agreementDate}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Borrower</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{userName}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Advance Amount</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#00C6AE" }}>
                ${advance.amount}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Circle</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                {advance.circleName}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>Total Due</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                ${advance.total}
              </p>
            </div>
          </div>
        </div>

        {/* Key Terms Highlight */}
        <div
          style={{
            background: "#FEF3C7",
            borderRadius: "14px",
            padding: "14px",
            marginBottom: "16px",
            border: "1px solid #D97706",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#D97706"
              strokeWidth="2"
              style={{ marginTop: "2px", flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400E" }}>Key Terms Summary</p>
              <ul
                style={{
                  margin: "8px 0 0 0",
                  paddingLeft: "16px",
                  fontSize: "12px",
                  color: "#B45309",
                  lineHeight: 1.6,
                }}
              >
                <li>
                  ${advance.total} will be auto-withheld from your ${advance.payoutAmount} payout
                </li>
                <li>Withholding date: {advance.withholdingDate}</li>
                <li>Missed withholding = -20 XnScore points</li>
                <li>No external collection agencies</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Agreement Sections */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid #E5E7EB",
          }}
        >
          {sections.map((section, idx) => (
            <div key={idx} style={{ marginBottom: idx < sections.length - 1 ? "20px" : 0 }}>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0A2342",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {section.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#4B5563",
                  lineHeight: 1.7,
                  whiteSpace: "pre-line",
                }}
              >
                {section.content}
              </p>
              {idx < sections.length - 1 && <div style={{ height: "1px", background: "#E5E7EB", marginTop: "20px" }} />}
            </div>
          ))}
        </div>

        {/* Acceptance */}
        <div
          style={{
            marginTop: "16px",
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            border: "1px solid #00C6AE",
            textAlign: "center",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00C6AE"
            strokeWidth="2"
            style={{ marginBottom: "8px" }}
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#065F46" }}>
            Agreement Accepted
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#047857" }}>
            {userName} • {agreementDate}
          </p>
        </div>
      </div>
    </div>
  )
}
