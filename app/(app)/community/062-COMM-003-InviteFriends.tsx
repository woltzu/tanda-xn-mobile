"use client"

import { useState } from "react"

export default function InviteFriendsScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedContacts, setSelectedContacts] = useState<number[]>([])

  const referralCode = "FRANCK2024"
  const referralLink = "https://tandaxn.com/join/FRANCK2024"
  const rewardAmount = 25

  const contacts = [
    { id: 1, name: "Amara Okafor", phone: "+1 (404) 555-0123", avatar: "A", invited: false },
    { id: 2, name: "Kwame Mensah", phone: "+1 (470) 555-0456", avatar: "K", invited: true },
    { id: 3, name: "Fatima Hassan", phone: "+1 (678) 555-0789", avatar: "F", invited: false },
    { id: 4, name: "David Nguyen", phone: "+1 (404) 555-0321", avatar: "D", invited: false },
    { id: 5, name: "Marie Claire", phone: "+1 (470) 555-0654", avatar: "M", invited: true },
    { id: 6, name: "Samuel Osei", phone: "+1 (678) 555-0987", avatar: "S", invited: false },
  ]

  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery),
  )

  const toggleContact = (contactId: number) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter((id) => id !== contactId))
    } else {
      setSelectedContacts([...selectedContacts, contactId])
    }
  }

  const socialPlatforms = [
    { id: "whatsapp", name: "WhatsApp", icon: "💬", color: "#25D366" },
    { id: "sms", name: "SMS", icon: "📱", color: "#0A2342" },
    { id: "email", name: "Email", icon: "✉️", color: "#EA4335" },
    { id: "facebook", name: "Facebook", icon: "📘", color: "#1877F2" },
    { id: "twitter", name: "X/Twitter", icon: "🐦", color: "#1DA1F2" },
    { id: "more", name: "More", icon: "•••", color: "#6B7280" },
  ]

  const handleBack = () => {
    console.log("Back clicked")
  }

  const handleShareLink = () => {
    console.log("Share link clicked")
  }

  const handleShareQR = () => {
    console.log("Share QR clicked")
  }

  const handleInviteContact = () => {
    console.log("Invite contacts:", selectedContacts)
  }

  const handleShareSocial = (platformId: string) => {
    console.log("Share on platform:", platformId)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "140px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px 20px 80px 20px",
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>Invite Friends</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              Earn ${rewardAmount} for every friend who joins
            </p>
          </div>
        </div>

        {/* Reward Banner */}
        <div
          style={{
            background: "rgba(0,198,174,0.2)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            🎁
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>You both get rewarded!</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              You get ${rewardAmount} • They get $10 bonus
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Share Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            Share Your Link
          </h3>

          {/* Link Display */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#0A2342",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {referralLink}
              </p>
            </div>
            <button
              onClick={handleShareLink}
              style={{
                background: "#00C6AE",
                border: "none",
                borderRadius: "10px",
                padding: "12px 16px",
                cursor: "pointer",
                color: "#FFFFFF",
                fontWeight: "600",
                fontSize: "13px",
                whiteSpace: "nowrap",
              }}
            >
              Copy
            </button>
          </div>

          {/* Social Share Buttons */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {socialPlatforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handleShareSocial(platform.id)}
                style={{
                  flex: "1 1 calc(33.33% - 8px)",
                  minWidth: "90px",
                  padding: "12px 8px",
                  borderRadius: "10px",
                  border: "1px solid #E5E7EB",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "20px" }}>{platform.icon}</span>
                <span style={{ fontSize: "11px", color: "#6B7280", fontWeight: "500" }}>{platform.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* QR Code */}
        <button
          onClick={handleShareQR}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "10px",
              background: "#F5F7FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Show QR Code</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Let friends scan to join instantly
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Contacts */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
            Invite from Contacts
          </h3>

          {/* Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              background: "#F5F7FA",
              borderRadius: "10px",
              marginBottom: "16px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          {/* Contact List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => !contact.invited && toggleContact(contact.id)}
                disabled={contact.invited}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: selectedContacts.includes(contact.id) ? "#F0FDFB" : "#F5F7FA",
                  borderRadius: "10px",
                  border: selectedContacts.includes(contact.id) ? "2px solid #00C6AE" : "1px solid transparent",
                  cursor: contact.invited ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                  opacity: contact.invited ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "#0A2342",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "600",
                    fontSize: "16px",
                  }}
                >
                  {contact.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{contact.name}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{contact.phone}</p>
                </div>
                {contact.invited ? (
                  <span
                    style={{
                      background: "#E5E7EB",
                      color: "#6B7280",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "600",
                    }}
                  >
                    Invited
                  </span>
                ) : selectedContacts.includes(contact.id) ? (
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "#00C6AE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      border: "2px solid #D1D5DB",
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Send Invites Button */}
      {selectedContacts.length > 0 && (
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
            onClick={handleInviteContact}
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
            Send {selectedContacts.length} Invite{selectedContacts.length > 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  )
}
