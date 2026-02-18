"use client"

import { useState, useRef, useMemo, useCallback } from "react"
import {
  SUPPORTED_COUNTRIES,
  DELIVERY_OPTIONS,
  MOCK_RECIPIENTS,
  calculateFees,
  formatCurrency,
  formatUSD,
  getExchangeRate,
  validatePhone,
  type Country,
  type DeliveryOption,
  type SavedRecipient,
} from "../../../lib/transferConfig"

// ─── Types ────────────────────────────────────────────────────────────

type RecipientMode = "saved" | "new"

// ─── Main Component ───────────────────────────────────────────────────

export default function SendMoneyScreen() {
  // ── Recipient State ──────────────────────────────────
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    SUPPORTED_COUNTRIES.find((c) => c.code === "SN")!
  )
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("saved")
  const [selectedRecipient, setSelectedRecipient] = useState<SavedRecipient | null>(null)
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")

  // ── Amount State ─────────────────────────────────────
  const [sendAmount, setSendAmount] = useState("")
  const [receiveAmount, setReceiveAmount] = useState("")
  const lastEditedField = useRef<"send" | "receive">("send")

  // ── Delivery State ───────────────────────────────────
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>(DELIVERY_OPTIONS[0])

  // ── Derived Values ───────────────────────────────────
  const exchangeRate = getExchangeRate("USD", selectedCountry.currency)
  const walletBalance = 2450.0 // TODO: from WalletContext

  const numSend = parseFloat(sendAmount) || 0
  const numReceive = parseFloat(receiveAmount) || 0

  const effectiveSendAmount = lastEditedField.current === "send"
    ? numSend
    : numReceive > 0 ? numReceive / exchangeRate : 0

  const fees = useMemo(() => {
    return calculateFees(
      Math.max(0, effectiveSendAmount),
      deliveryOption,
      exchangeRate,
      selectedCountry.decimals
    )
  }, [effectiveSendAmount, deliveryOption, exchangeRate, selectedCountry.decimals])

  const hasEnoughBalance = fees.totalToPay <= walletBalance

  // Recipient validation
  const hasRecipient = recipientMode === "saved"
    ? selectedRecipient !== null
    : recipientName.trim().length >= 2 && validatePhone(recipientPhone, selectedCountry).valid

  const phoneValidation = recipientMode === "new" && recipientPhone.length > 0
    ? validatePhone(recipientPhone, selectedCountry)
    : { valid: true, message: "" }

  const canSend = effectiveSendAmount >= 1 && hasEnoughBalance && hasRecipient

  // Country recipients
  const countryRecipients = MOCK_RECIPIENTS.filter(
    (r) => r.countryCode === selectedCountry.code
  )

  // ── Handlers ─────────────────────────────────────────
  const handleSendChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "")
    setSendAmount(cleaned)
    lastEditedField.current = "send"
    const num = parseFloat(cleaned) || 0
    const recv = num * exchangeRate
    setReceiveAmount(
      num > 0
        ? (selectedCountry.decimals === 0 ? Math.round(recv).toString() : recv.toFixed(selectedCountry.decimals))
        : ""
    )
  }, [exchangeRate, selectedCountry.decimals])

  const handleReceiveChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "")
    setReceiveAmount(cleaned)
    lastEditedField.current = "receive"
    const num = parseFloat(cleaned) || 0
    const send = num / exchangeRate
    setSendAmount(num > 0 ? send.toFixed(2) : "")
  }, [exchangeRate])

  const handleCountryChange = (country: Country) => {
    setSelectedCountry(country)
    setCountryPickerOpen(false)
    setSelectedRecipient(null) // Reset recipient when country changes
    setRecipientMode("saved") // Reset to saved view
    // Recalculate with new exchange rate
    const newRate = getExchangeRate("USD", country.currency)
    if (lastEditedField.current === "send") {
      const num = parseFloat(sendAmount) || 0
      const recv = num * newRate
      setReceiveAmount(num > 0 ? (country.decimals === 0 ? Math.round(recv).toString() : recv.toFixed(country.decimals)) : "")
    } else {
      const num = parseFloat(receiveAmount) || 0
      const send = num / newRate
      setSendAmount(num > 0 ? send.toFixed(2) : "")
    }
  }

  const handleSelectRecipient = (r: SavedRecipient) => {
    setSelectedRecipient(r)
    setRecipientMode("saved")
    setRecipientName(r.name)
    setRecipientPhone(r.phone)
  }

  const handleQuickAmount = (amt: number) => {
    handleSendChange(amt.toString())
  }

  // ── Render ───────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* ═══ HEADER ═══ */}
      <div style={{ background: "#0A2342", padding: "20px 20px 20px 20px", color: "#FFFFFF" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <button
            onClick={() => console.log("Back")}
            aria-label="Go back"
            style={{
              background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "10px",
              padding: "8px", cursor: "pointer", display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", flex: 1 }}>Send Money</h1>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>Balance</p>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{formatUSD(walletBalance)}</p>
          </div>
        </div>

        {/* Exchange rate bar */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", background: "rgba(0,198,174,0.15)", borderRadius: "8px",
          }}
        >
          <span style={{ fontSize: "12px", opacity: 0.9 }}>
            1 USD = {formatCurrency(exchangeRate, selectedCountry.currency)} {selectedCountry.currency}
          </span>
          <span style={{ fontSize: "10px", fontWeight: "600", background: "#00C6AE", padding: "2px 6px", borderRadius: "4px" }}>
            LIVE
          </span>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>

        {/* ═══ SECTION 1: RECIPIENT ═══ */}
        <div
          style={{
            background: "#FFFFFF", borderRadius: "16px", padding: "16px",
            marginBottom: "14px", border: "1px solid #E5E7EB",
          }}
        >
          {/* Country selector (inline) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>Sending to</span>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setCountryPickerOpen(!countryPickerOpen)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 10px", background: "#F5F7FA", borderRadius: "8px",
                  border: "1px solid #E5E7EB", cursor: "pointer", fontSize: "13px",
                  fontWeight: "500", color: "#0A2342",
                }}
              >
                <span style={{ fontSize: "16px" }}>{selectedCountry.flag}</span>
                {selectedCountry.name}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <polyline points={countryPickerOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                </svg>
              </button>

              {/* Country dropdown */}
              {countryPickerOpen && (
                <div
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", right: 0,
                    background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E5E7EB",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50,
                    maxHeight: "240px", overflowY: "auto", minWidth: "200px",
                  }}
                >
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleCountryChange(c)}
                      style={{
                        width: "100%", padding: "10px 12px",
                        background: c.code === selectedCountry.code ? "#F0FDFB" : "transparent",
                        border: "none", borderBottom: "1px solid #F5F7FA",
                        cursor: "pointer", display: "flex", alignItems: "center",
                        gap: "8px", textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>{c.flag}</span>
                      <span style={{ flex: 1, fontSize: "13px", color: "#0A2342" }}>{c.name}</span>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>{c.currency}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Saved recipients (horizontal scroll) */}
          {countryRecipients.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                {countryRecipients.map((r) => {
                  const isSelected = selectedRecipient?.id === r.id
                  const country = SUPPORTED_COUNTRIES.find(c => c.code === r.countryCode)
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRecipient(r)}
                      style={{
                        padding: "8px 12px", borderRadius: "10px",
                        border: isSelected ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                        background: isSelected ? "#F0FDFB" : "#FFFFFF",
                        cursor: "pointer", display: "flex", alignItems: "center",
                        gap: "8px", whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "32px", height: "32px", borderRadius: "50%",
                          background: isSelected ? "#00C6AE" : "#0A2342",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "12px", color: "#FFFFFF", fontWeight: "600",
                        }}
                      >
                        {r.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>
                          {r.name}
                          {r.favorite && " \u2B50"}
                        </p>
                        <p style={{ margin: 0, fontSize: "10px", color: "#6B7280" }}>
                          {country?.phoneCode} {r.phone}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* New recipient toggle */}
          {recipientMode === "saved" && !selectedRecipient && (
            <button
              onClick={() => setRecipientMode("new")}
              style={{
                width: "100%", padding: "12px", borderRadius: "10px",
                border: "1px dashed #E5E7EB", background: "#F5F7FA",
                cursor: "pointer", display: "flex", alignItems: "center",
                gap: "10px", justifyContent: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>
                Send to New Recipient
              </span>
            </button>
          )}

          {/* New recipient form */}
          {(recipientMode === "new" || selectedRecipient) && (
            <div>
              {recipientMode === "new" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#6B7280" }}>New Recipient</span>
                  <button
                    onClick={() => { setRecipientMode("saved"); setRecipientName(""); setRecipientPhone(""); }}
                    style={{
                      fontSize: "11px", color: "#00897B", background: "none", border: "none",
                      cursor: "pointer", fontWeight: "500",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <input
                type="text"
                value={recipientName}
                onChange={(e) => { setRecipientName(e.target.value); if (selectedRecipient) setSelectedRecipient(null); setRecipientMode("new"); }}
                placeholder="Recipient's full name"
                style={{
                  width: "100%", padding: "12px", borderRadius: "10px",
                  border: "1px solid #E5E7EB", fontSize: "14px", color: "#0A2342",
                  marginBottom: "8px", boxSizing: "border-box", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: "0" }}>
                <div
                  style={{
                    padding: "12px", background: "#F5F7FA", borderRadius: "10px 0 0 10px",
                    border: "1px solid #E5E7EB", borderRight: "none",
                    fontSize: "14px", fontWeight: "500", color: "#0A2342",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{selectedCountry.flag}</span>
                  {selectedCountry.phoneCode}
                </div>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => { setRecipientPhone(e.target.value); if (selectedRecipient) setSelectedRecipient(null); setRecipientMode("new"); }}
                  placeholder={selectedCountry.phoneFormat}
                  style={{
                    flex: 1, padding: "12px", borderRadius: "0 10px 10px 0",
                    border: "1px solid #E5E7EB", fontSize: "14px", color: "#0A2342",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              {!phoneValidation.valid && recipientPhone.length > 0 && (
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#DC2626" }}>
                  {phoneValidation.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ═══ SECTION 2: AMOUNT (Dual entry, both always editable) ═══ */}
        <div
          style={{
            background: "#FFFFFF", borderRadius: "16px", padding: "16px",
            marginBottom: "14px", border: "1px solid #E5E7EB",
          }}
        >
          {/* You Send */}
          <div
            style={{
              padding: "12px", background: "#F5F7FA", borderRadius: "10px",
              marginBottom: "8px",
            }}
          >
            <label style={{ display: "block", fontSize: "11px", fontWeight: "500", color: "#6B7280", marginBottom: "4px" }}>
              You send
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{"\u{1F1FA}\u{1F1F8}"} USD</span>
              <input
                type="text"
                inputMode="decimal"
                value={sendAmount}
                onChange={(e) => handleSendChange(e.target.value)}
                placeholder="0.00"
                style={{
                  flex: 1, border: "none", background: "transparent",
                  fontSize: "24px", fontWeight: "700", color: "#0A2342",
                  outline: "none", textAlign: "right",
                }}
              />
            </div>
          </div>

          {/* Swap indicator (non-interactive, just visual link) */}
          <div style={{ display: "flex", justifyContent: "center", margin: "-4px 0", position: "relative", zIndex: 2 }}>
            <div
              style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "#0A2342", border: "2px solid #FFFFFF",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
                <polyline points="7 3 3 7 7 11" />
                <path d="M21 7H3" />
                <polyline points="17 21 21 17 17 13" />
                <path d="M3 17h18" />
              </svg>
            </div>
          </div>

          {/* They Receive */}
          <div
            style={{
              padding: "12px", background: "#F5F7FA", borderRadius: "10px",
              marginTop: "8px",
            }}
          >
            <label style={{ display: "block", fontSize: "11px", fontWeight: "500", color: "#6B7280", marginBottom: "4px" }}>
              They receive
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{selectedCountry.flag} {selectedCountry.currency}</span>
              <input
                type="text"
                inputMode="decimal"
                value={receiveAmount}
                onChange={(e) => handleReceiveChange(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1, border: "none", background: "transparent",
                  fontSize: "24px", fontWeight: "700", color: "#00C6AE",
                  outline: "none", textAlign: "right",
                }}
              />
            </div>
          </div>

          {/* Quick amounts */}
          <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
            {[50, 100, 200, 500].map((amt) => (
              <button
                key={amt}
                onClick={() => handleQuickAmount(amt)}
                style={{
                  flex: 1, padding: "8px 4px", borderRadius: "8px",
                  border: numSend === amt ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: numSend === amt ? "#F0FDFB" : "#FFFFFF",
                  fontSize: "12px", fontWeight: "600",
                  color: numSend === amt ? "#00897B" : "#6B7280",
                  cursor: "pointer",
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ SECTION 3: DELIVERY SPEED ═══ */}
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#6B7280", marginBottom: "8px", paddingLeft: "2px" }}>
            Delivery speed
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {DELIVERY_OPTIONS.map((opt) => {
              const active = opt.id === deliveryOption.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setDeliveryOption(opt)}
                  style={{
                    flex: 1, padding: "10px 6px", borderRadius: "12px",
                    border: active ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                    background: active ? "#F0FDFB" : "#FFFFFF",
                    cursor: "pointer", textAlign: "center", position: "relative",
                  }}
                >
                  {active && (
                    <div style={{
                      position: "absolute", top: "5px", right: "5px",
                      width: "16px", height: "16px", borderRadius: "50%", background: "#00C6AE",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  <p style={{ margin: "0 0 1px 0", fontSize: "12px", fontWeight: "600", color: active ? "#00897B" : "#0A2342" }}>
                    {opt.label}
                  </p>
                  <p style={{ margin: "0 0 3px 0", fontSize: "10px", color: "#6B7280" }}>{opt.daysLabel}</p>
                  <p style={{ margin: 0, fontSize: "11px", fontWeight: "600", color: active ? "#00897B" : "#0A2342" }}>
                    {formatUSD(opt.flatFee)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ═══ SECTION 4: TRANSFER SUMMARY ═══ */}
        {effectiveSendAmount > 0 && (
          <div
            style={{
              background: "#FFFFFF", borderRadius: "16px", padding: "14px 16px",
              border: "1px solid #E5E7EB", marginBottom: "14px",
            }}
          >
            {[
              { label: "You send", value: formatUSD(fees.sendAmount) },
              { label: `Fee (${deliveryOption.label})`, value: formatUSD(fees.totalFee) },
              { label: "Exchange rate", value: `1 USD = ${formatCurrency(exchangeRate, selectedCountry.currency)} ${selectedCountry.currency}` },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span style={{ fontSize: "13px", color: "#6B7280" }}>{row.label}</span>
                <span style={{ fontSize: "13px", fontWeight: "500", color: "#0A2342" }}>{row.value}</span>
              </div>
            ))}

            <div style={{ height: "1px", background: "#E5E7EB", margin: "8px 0" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Total to pay</span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                {formatUSD(fees.totalToPay)}
              </span>
            </div>
          </div>
        )}

        {/* Balance warning */}
        {effectiveSendAmount > 0 && !hasEnoughBalance && (
          <div style={{ padding: "10px 12px", background: "#FEF3C7", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <span style={{ fontSize: "14px" }}>{"\u26A0\uFE0F"}</span>
            <span style={{ fontSize: "12px", color: "#92400E" }}>
              Insufficient balance. Need {formatUSD(fees.totalToPay)}, have {formatUSD(walletBalance)}.
            </span>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM BAR ═══ */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#FFFFFF", padding: "12px 20px 28px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>They receive</p>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
              {fees.receiveAmount > 0
                ? `${formatCurrency(fees.receiveAmount, selectedCountry.currency)} ${selectedCountry.currency}`
                : `0 ${selectedCountry.currency}`}
            </p>
          </div>
          <button
            onClick={() =>
              console.log("Send Money:", {
                recipient: recipientMode === "saved" ? selectedRecipient : { name: recipientName, phone: recipientPhone },
                send: fees.sendAmount,
                receive: fees.receiveAmount,
                fee: fees.totalFee,
                total: fees.totalToPay,
                country: selectedCountry.code,
                delivery: deliveryOption.id,
              })
            }
            disabled={!canSend}
            style={{
              padding: "14px 28px", borderRadius: "14px", border: "none",
              background: canSend ? "#00C6AE" : "#E5E7EB",
              fontSize: "15px", fontWeight: "600",
              color: canSend ? "#FFFFFF" : "#9CA3AF",
              cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Send Money
          </button>
        </div>
      </div>
    </div>
  )
}
