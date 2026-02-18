"use client"

import { useState } from "react"

export default function ScheduleRecurringScreen() {
  const recipient = {
    name: "Mama Françoise",
    flag: "🇨🇲",
    provider: "MTN MoMo",
    phone: "+237 6XX XXX XX45",
  }

  const [amount, setAmount] = useState("100")
  const [frequency, setFrequency] = useState("monthly")
  const [startDate, setStartDate] = useState("first")

  const frequencies = [
    { id: "weekly", label: "Weekly" },
    { id: "biweekly", label: "Every 2 weeks" },
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Every 3 months" },
  ]

  const startDates = [
    { id: "first", label: "1st of the month" },
    { id: "15th", label: "15th of the month" },
    { id: "last", label: "Last day of month" },
  ]

  const parsedAmount = Number.parseFloat(amount) || 0
  const canSave = parsedAmount >= 10

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
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Schedule Recurring</h1>
        </div>

        {/* Recipient */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "#FFFFFF",
              fontWeight: "600",
            }}
          >
            {recipient.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
              {recipient.name} {recipient.flag}
            </p>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", opacity: 0.8 }}>{recipient.provider}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Amount */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <label
            style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            Amount to Send Each Time
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px",
              background: "#F5F7FA",
              borderRadius: "12px",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "600", color: "#0A2342" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
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
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {[50, 100, 150, 200].map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
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
        </div>

        {/* Frequency */}
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
            style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            How Often?
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {frequencies.map((f) => (
              <button
                key={f.id}
                onClick={() => setFrequency(f.id)}
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: frequency === f.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: frequency === f.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start Date */}
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
            style={{ display: "block", marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}
          >
            When to Send?
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {startDates.map((date) => (
              <button
                key={date.id}
                onClick={() => setStartDate(date.id)}
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: startDate === date.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: startDate === date.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#0A2342",
                }}
              >
                {date.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {parsedAmount > 0 && (
          <div
            style={{
              background: "#0A2342",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Summary</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.9)", lineHeight: 1.6 }}>
              You'll automatically send <span style={{ color: "#00C6AE", fontWeight: "600" }}>${parsedAmount}</span> to{" "}
              <span style={{ fontWeight: "600" }}>{recipient.name}</span>{" "}
              <span style={{ textTransform: "lowercase" }}>{frequencies.find((f) => f.id === frequency)?.label}</span>{" "}
              on the{" "}
              {startDates
                .find((d) => d.id === startDate)
                ?.label.replace("of the month", "")
                .trim()}
              .
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
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
          disabled={!canSave}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canSave ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: canSave ? "#FFFFFF" : "#9CA3AF",
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          Schedule Recurring Transfer
        </button>
      </div>
    </div>
  )
}
