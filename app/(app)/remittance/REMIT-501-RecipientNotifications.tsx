"use client"

import { useState } from "react"

export default function RecipientNotificationsScreen() {
  const recipient = {
    name: "Mama Kengne",
    phone: "+237 6XX XXX XXX",
    country: "Cameroon",
    flag: "🇨🇲",
  }

  const transfer = {
    amount: 200,
    receiveAmount: 121100,
    currency: "XAF",
    deliveryMethod: "Mobile Money",
  }

  const availableChannels = [
    { id: "sms", name: "SMS", icon: "💬", description: "Text message to their phone", available: true },
    { id: "whatsapp", name: "WhatsApp", icon: "📱", description: "WhatsApp message", available: true },
    { id: "email", name: "Email", icon: "📧", description: "Email notification", available: false },
  ]

  const languages = [
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "sw", name: "Swahili", flag: "🇰🇪" },
  ]

  const [selectedChannels, setSelectedChannels] = useState(["sms"])
  const [language, setLanguage] = useState("en")
  const [customMessage, setCustomMessage] = useState("")
  const [showCustomMessage, setShowCustomMessage] = useState(false)

  const toggleChannel = (channelId: string) => {
    if (selectedChannels.includes(channelId)) {
      setSelectedChannels(selectedChannels.filter((c) => c !== channelId))
    } else {
      setSelectedChannels([...selectedChannels, channelId])
    }
  }

  const previewMessages: Record<string, string> = {
    en: `Hi ${recipient.name}! ${transfer.receiveAmount.toLocaleString()} ${transfer.currency} is on the way from TandaXn. ${transfer.deliveryMethod === "Mobile Money" ? "Check your mobile money account." : "Pick up at any authorized agent."}`,
    fr: `Bonjour ${recipient.name}! ${transfer.receiveAmount.toLocaleString()} ${transfer.currency} est en route via TandaXn. ${transfer.deliveryMethod === "Mobile Money" ? "Vérifiez votre compte mobile money." : "Récupérez chez un agent autorisé."}`,
    sw: `Habari ${recipient.name}! ${transfer.receiveAmount.toLocaleString()} ${transfer.currency} inakuja kutoka TandaXn.`,
  }

  const handleBack = () => console.log("Navigate back")
  const handleContinue = () => {
    console.log("Continue with:", {
      channels: selectedChannels,
      language,
      customMessage: showCustomMessage ? customMessage : null,
    })
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <button
            onClick={handleBack}
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Notify {recipient.name.split(" ")[0]}</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              How should we tell them about the money?
            </p>
          </div>
          <span style={{ fontSize: "28px" }}>{recipient.flag}</span>
        </div>

        {/* Transfer Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Sending</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700" }}>${transfer.amount}</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>They receive</p>
            <p style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>
              {transfer.receiveAmount.toLocaleString()} {transfer.currency}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Notification Channels */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
            Notification Method
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {availableChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => channel.available && toggleChannel(channel.id)}
                disabled={!channel.available}
                style={{
                  padding: "14px",
                  background: selectedChannels.includes(channel.id) ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "12px",
                  border: selectedChannels.includes(channel.id) ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  cursor: channel.available ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                  opacity: channel.available ? 1 : 0.5,
                }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    border: selectedChannels.includes(channel.id) ? "none" : "2px solid #E5E7EB",
                    background: selectedChannels.includes(channel.id) ? "#00C6AE" : "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedChannels.includes(channel.id) && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>

                <span style={{ fontSize: "24px" }}>{channel.icon}</span>

                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{channel.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{channel.description}</p>
                </div>

                {!channel.available && (
                  <span
                    style={{
                      padding: "4px 8px",
                      background: "#F5F7FA",
                      borderRadius: "4px",
                      fontSize: "10px",
                      color: "#6B7280",
                    }}
                  >
                    No email on file
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection */}
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
            Message Language
          </h3>

          <div style={{ display: "flex", gap: "8px" }}>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: language === lang.code ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                  border: language === lang.code ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "20px" }}>{lang.flag}</span>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "11px",
                    fontWeight: language === lang.code ? "600" : "400",
                    color: language === lang.code ? "#00897B" : "#6B7280",
                  }}
                >
                  {lang.name}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Message Preview */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Message Preview</h3>
            <button
              onClick={() => setShowCustomMessage(!showCustomMessage)}
              style={{
                padding: "4px 10px",
                background: "none",
                border: "none",
                color: "#00C6AE",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {showCustomMessage ? "Use Default" : "Customize"}
            </button>
          </div>

          {showCustomMessage ? (
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Write a personal message..."
              maxLength={160}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
                fontSize: "13px",
                color: "#0A2342",
                resize: "none",
                height: "80px",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <div
              style={{
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "10px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#0A2342",
                  lineHeight: 1.5,
                }}
              >
                {previewMessages[language]}
              </p>
            </div>
          )}

          {showCustomMessage && (
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: "11px",
                color: "#6B7280",
                textAlign: "right",
              }}
            >
              {customMessage.length}/160 characters
            </p>
          )}
        </div>

        {/* Cash Pickup QR Code Option */}
        {transfer.deliveryMethod !== "Mobile Money" && (
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "14px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                background: "#FFFFFF",
                borderRadius: "10px",
                border: "2px solid #00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>QR Code for Pickup</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#065F46" }}>
                We'll include a QR code for faster pickup at agent locations
              </p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {/* Timing Info */}
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p style={{ margin: 0, fontSize: "11px", color: "#6B7280" }}>
            Notification sent immediately when transfer is initiated
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
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
          onClick={handleContinue}
          disabled={selectedChannels.length === 0}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: selectedChannels.length > 0 ? "#00C6AE" : "#E5E7EB",
            fontSize: "16px",
            fontWeight: "600",
            color: selectedChannels.length > 0 ? "#FFFFFF" : "#9CA3AF",
            cursor: selectedChannels.length > 0 ? "pointer" : "not-allowed",
          }}
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}
