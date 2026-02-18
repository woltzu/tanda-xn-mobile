"use client"

import { useState } from "react"
import { ArrowLeft, Search, ChevronRight, Plus, Globe, Clock, User, Phone, Building2, CreditCard, Smartphone, X, Users } from "lucide-react"
import { TabBarInline } from "../../../components/TabBar"

export default function SendMoneyScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [amount, setAmount] = useState("")
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [showConversionPreview, setShowConversionPreview] = useState(false)

  // Current user's info
  const currentUser = {
    currency: "USD",
    currencySymbol: "$",
    flag: "🇺🇸",
    balance: 2450.0,
  }

  // TandaXn Members (P2P transfers)
  const members = [
    { id: 1, name: "Amadou Diallo", username: "@amadou_d", avatar: "AD", currency: "EUR", flag: "🇫🇷", rate: 0.92, recent: true, xnScore: 85 },
    { id: 2, name: "Fatou Ndiaye", username: "@fatou_n", avatar: "FN", currency: "XOF", flag: "🇸🇳", rate: 605.5, recent: true, xnScore: 78 },
    { id: 3, name: "Kofi Mensah", username: "@kofi_m", avatar: "KM", currency: "GHS", flag: "🇬🇭", rate: 12.45, recent: true, xnScore: 92 },
    { id: 4, name: "Ngozi Okafor", username: "@ngozi_o", avatar: "NO", currency: "NGN", flag: "🇳🇬", rate: 1550.2, recent: false, xnScore: 70 },
    { id: 5, name: "Marie Kamara", username: "@marie_k", avatar: "MK", currency: "USD", flag: "🇺🇸", rate: 1, recent: false, xnScore: 88 },
    { id: 6, name: "Ibrahim Hassan", username: "@ibrahim_h", avatar: "IH", currency: "KES", flag: "🇰🇪", rate: 153.8, recent: false, xnScore: 75 },
  ]

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const recentMembers = filteredMembers.filter((m) => m.recent)
  const allMembers = filteredMembers.filter((m) => !m.recent)

  // Calculate conversion
  const parsedAmount = Number.parseFloat(amount) || 0
  const calculateConversion = (member: any) => {
    if (member.currency === currentUser.currency) {
      return { converted: parsedAmount, fee: 0, total: parsedAmount, needsConversion: false }
    }
    const fee = parsedAmount * 0.005 // 0.5% conversion fee
    const converted = parsedAmount * member.rate
    return { converted: Math.round(converted * 100) / 100, fee, total: parsedAmount + fee, needsConversion: true }
  }

  const handleSelectMember = (member: any) => {
    setSelectedMember(member)
    if (parsedAmount > 0) {
      setShowConversionPreview(true)
    }
  }

  const formatCurrency = (value: number, currency: string) => {
    if (currency === "XOF" || currency === "XAF") {
      return `CFA ${value.toLocaleString()}`
    } else if (currency === "NGN") {
      return `₦${value.toLocaleString()}`
    } else if (currency === "KES") {
      return `KSh ${value.toLocaleString()}`
    } else if (currency === "GHS") {
      return `GH₵${value.toFixed(2)}`
    } else if (currency === "EUR") {
      return `€${value.toFixed(2)}`
    }
    return `$${value.toFixed(2)}`
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px", // Space for tab bar
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
            marginBottom: "20px",
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
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Send to Member</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>P2P transfer with auto-conversion</p>
          </div>
        </div>

        {/* Amount Input */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.2)",
                borderRadius: "8px",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "16px" }}>{currentUser.flag}</span>
              <span style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: "600" }}>{currentUser.currency}</span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                fontSize: "32px",
                fontWeight: "700",
                color: "#FFFFFF",
                outline: "none",
                textAlign: "right",
              }}
            />
          </div>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.7, textAlign: "right" }}>
            Available: {formatCurrency(currentUser.balance, currentUser.currency)}
          </p>
        </div>

        {/* Info Banner */}
        <div
          style={{
            marginTop: "12px",
            padding: "10px 14px",
            background: "rgba(0,198,174,0.2)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Users size={16} color="#00C6AE" />
          <p style={{ margin: 0, fontSize: "12px", color: "#00C6AE" }}>
            Send to any TandaXn member • Auto-converts to their local currency
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            marginBottom: "20px",
          }}
        >
          <Search size={18} color="#9CA3AF" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members by name or @username..."
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: "14px",
              color: "#0A2342",
              outline: "none",
            }}
          />
        </div>

        {/* Recent Members */}
        {recentMembers.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <Clock size={14} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>RECENT TRANSFERS</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentMembers.map((member) => {
                const conversion = calculateConversion(member)
                return (
                  <button
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        background: "#0A2342",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        position: "relative",
                      }}
                    >
                      {member.avatar}
                      <span
                        style={{
                          position: "absolute",
                          bottom: "-2px",
                          right: "-2px",
                          fontSize: "14px",
                        }}
                      >
                        {member.flag}
                      </span>
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                        {member.username} • {member.currency}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {parsedAmount > 0 && conversion.needsConversion && (
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>
                          {formatCurrency(conversion.converted, member.currency)}
                        </p>
                      )}
                      <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#9CA3AF" }}>
                        XnScore: {member.xnScore}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* All Members */}
        {allMembers.length > 0 && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <Users size={14} color="#6B7280" />
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>ALL MEMBERS</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {allMembers.map((member) => {
                const conversion = calculateConversion(member)
                return (
                  <button
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      background: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        background: "#0A2342",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        position: "relative",
                      }}
                    >
                      {member.avatar}
                      <span
                        style={{
                          position: "absolute",
                          bottom: "-2px",
                          right: "-2px",
                          fontSize: "14px",
                        }}
                      >
                        {member.flag}
                      </span>
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>{member.name}</p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                        {member.username} • {member.currency}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {parsedAmount > 0 && conversion.needsConversion && (
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#00C6AE" }}>
                          {formatCurrency(conversion.converted, member.currency)}
                        </p>
                      )}
                      <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#9CA3AF" }}>
                        XnScore: {member.xnScore}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* No Results */}
        {filteredMembers.length === 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <Search size={40} color="#9CA3AF" style={{ marginBottom: "12px" }} />
            <p style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>No members found</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#9CA3AF" }}>Try searching by name or @username</p>
          </div>
        )}
      </div>

      {/* Conversion Preview Modal */}
      {showConversionPreview && selectedMember && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 200,
          }}
          onClick={() => setShowConversionPreview(false)}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "90vh",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 40px 20px",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div
              style={{
                width: "40px",
                height: "4px",
                background: "#E5E7EB",
                borderRadius: "2px",
                margin: "0 auto 20px auto",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
                Confirm Transfer
              </h2>
              <button
                onClick={() => setShowConversionPreview(false)}
                style={{
                  background: "#F5F7FA",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} color="#6B7280" />
              </button>
            </div>

            {/* Recipient Card */}
            <div
              style={{
                padding: "16px",
                background: "#F5F7FA",
                borderRadius: "14px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "#0A2342",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#FFFFFF",
                  position: "relative",
                }}
              >
                {selectedMember.avatar}
                <span style={{ position: "absolute", bottom: "-2px", right: "-2px", fontSize: "16px" }}>
                  {selectedMember.flag}
                </span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>{selectedMember.name}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
                  {selectedMember.username} • {selectedMember.currency}
                </p>
              </div>
            </div>

            {/* Conversion Details */}
            {(() => {
              const conversion = calculateConversion(selectedMember)
              return (
                <div
                  style={{
                    background: "#0A2342",
                    borderRadius: "14px",
                    padding: "20px",
                    marginBottom: "20px",
                  }}
                >
                  {/* You Send */}
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>You send</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px" }}>{currentUser.flag}</span>
                      <span style={{ fontSize: "28px", fontWeight: "700", color: "#FFFFFF" }}>
                        {formatCurrency(parsedAmount, currentUser.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Conversion Arrow */}
                  {conversion.needsConversion && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.2)" }} />
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "#00C6AE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.2)" }} />
                    </div>
                  )}

                  {/* They Receive */}
                  <div>
                    <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
                      {selectedMember.name.split(" ")[0]} receives
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px" }}>{selectedMember.flag}</span>
                      <span style={{ fontSize: "28px", fontWeight: "700", color: "#00C6AE" }}>
                        {formatCurrency(conversion.converted, selectedMember.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Fee Info */}
                  {conversion.needsConversion && (
                    <div
                      style={{
                        marginTop: "16px",
                        paddingTop: "16px",
                        borderTop: "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Exchange rate</span>
                        <span style={{ fontSize: "12px", color: "#FFFFFF" }}>
                          1 {currentUser.currency} = {selectedMember.rate} {selectedMember.currency}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Conversion fee (0.5%)</span>
                        <span style={{ fontSize: "12px", color: "#FFFFFF" }}>
                          {formatCurrency(conversion.fee, currentUser.currency)}
                        </span>
                      </div>
                    </div>
                  )}

                  {!conversion.needsConversion && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "10px",
                        background: "rgba(0,198,174,0.2)",
                        borderRadius: "8px",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "12px", color: "#00C6AE", textAlign: "center" }}>
                        Same currency - No conversion fee!
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Send Button */}
            <button
              onClick={() => {
                const conversion = calculateConversion(selectedMember)
                console.log("Send transfer:", {
                  to: selectedMember,
                  amount: parsedAmount,
                  fromCurrency: currentUser.currency,
                  toCurrency: selectedMember.currency,
                  converted: conversion.converted,
                  fee: conversion.fee,
                })
                setShowConversionPreview(false)
                setSelectedMember(null)
              }}
              disabled={parsedAmount <= 0 || parsedAmount > currentUser.balance}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "none",
                background: parsedAmount > 0 && parsedAmount <= currentUser.balance ? "#00C6AE" : "#E5E7EB",
                fontSize: "16px",
                fontWeight: "600",
                color: parsedAmount > 0 && parsedAmount <= currentUser.balance ? "#FFFFFF" : "#9CA3AF",
                cursor: parsedAmount > 0 && parsedAmount <= currentUser.balance ? "pointer" : "not-allowed",
              }}
            >
              Send Now
            </button>

            {parsedAmount > currentUser.balance && (
              <p style={{ margin: "10px 0 0 0", fontSize: "12px", color: "#DC2626", textAlign: "center" }}>
                Insufficient balance. You have {formatCurrency(currentUser.balance, currentUser.currency)} available.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <TabBarInline activeTab="wallet" />
    </div>
  )
}
