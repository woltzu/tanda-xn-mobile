"use client"

import { useState } from "react"
import { ArrowLeft, Copy, Share2, QrCode, Link2, Check } from "lucide-react"

export default function ReceiveMoneyScreen() {
  const [selectedCurrency, setSelectedCurrency] = useState("USD")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [copied, setCopied] = useState(false)

  const user = {
    name: "Fatou Diallo",
    username: "@fatou.diallo",
    qrCode: "QR_CODE_DATA",
  }

  const currencies = [
    { code: "USD", flag: "🇺🇸", symbol: "$" },
    { code: "EUR", flag: "🇪🇺", symbol: "€" },
    { code: "XOF", flag: "🇸🇳", symbol: "CFA" },
    { code: "GBP", flag: "🇬🇧", symbol: "£" },
  ]

  const paymentLink = `https://tandaxn.com/pay/${user.username}${
    amount ? `?amount=${amount}&currency=${selectedCurrency}` : ""
  }`

  const handleCopy = () => {
    navigator.clipboard?.writeText(paymentLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Receive Money</h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* QR Code Card */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          {/* QR Code Placeholder */}
          <div
            style={{
              width: "180px",
              height: "180px",
              background: "#F5F7FA",
              borderRadius: "12px",
              margin: "0 auto 16px auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px dashed #E5E7EB",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <QrCode size={60} color="#9CA3AF" />
              <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>Your QR Code</p>
            </div>
          </div>

          <p style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>{user.name}</p>
          <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>{user.username}</p>
        </div>

        {/* Request Amount */}
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
            Request Specific Amount (Optional)
          </h3>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              style={{
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0A2342",
                cursor: "pointer",
              }}
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                background: "#F5F7FA",
                fontSize: "18px",
                fontWeight: "600",
                color: "#0A2342",
                outline: "none",
              }}
            />
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#F5F7FA",
              fontSize: "14px",
              color: "#0A2342",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Payment Link */}
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
            Your Payment Link
          </h3>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px",
              background: "#F5F7FA",
              borderRadius: "10px",
              marginBottom: "12px",
            }}
          >
            <Link2 size={18} color="#6B7280" />
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#0A2342",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {paymentLink}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                padding: "14px",
                background: copied ? "#00C6AE" : "#F5F7FA",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {copied ? <Check size={18} color="#FFFFFF" /> : <Copy size={18} color="#0A2342" />}
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: copied ? "#FFFFFF" : "#0A2342",
                }}
              >
                {copied ? "Copied!" : "Copy Link"}
              </span>
            </button>
            <button
              onClick={() => console.log("Share:", paymentLink)}
              style={{
                flex: 1,
                padding: "14px",
                background: "#00C6AE",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Share2 size={18} color="#FFFFFF" />
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Share</span>
            </button>
          </div>
        </div>

        {/* Info */}
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
          <QrCode size={18} color="#00897B" style={{ marginTop: "2px", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
            <strong>Tip:</strong> Share your QR code or payment link with anyone who wants to send you money. They can
            pay directly without needing your bank details.
          </p>
        </div>
      </div>
    </div>
  )
}
