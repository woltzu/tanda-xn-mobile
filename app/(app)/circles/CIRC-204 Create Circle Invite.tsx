"use client"

import { useState } from "react"

export default function CreateCircleInviteScreen() {
  const circleDetails = {
    name: "Family Savings",
    amount: 200,
    frequency: "monthly",
    size: 6,
  }

  const contacts = [
    { id: 1, name: "Amara Okafor", phone: "+1 (404) 555-0123", avatar: "A", xnScore: 78 },
    { id: 2, name: "Kwame Mensah", phone: "+1 (470) 555-0456", avatar: "K", xnScore: 85 },
    { id: 3, name: "Fatima Hassan", phone: "+1 (678) 555-0789", avatar: "F", xnScore: 72 },
    { id: 4, name: "David Nguyen", phone: "+1 (404) 555-0321", avatar: "D", xnScore: 68 },
    { id: 5, name: "Marie Claire", phone: "+1 (470) 555-0654", avatar: "M", xnScore: 81 },
    { id: 6, name: "Samuel Osei", phone: "+1 (678) 555-0987", avatar: "S", xnScore: 75 },
    { id: 7, name: "Grace Adeyemi", phone: "+1 (404) 555-1234", avatar: "G", xnScore: 82 },
    { id: 8, name: "James Kimani", phone: "+1 (470) 555-5678", avatar: "J", xnScore: 79 },
  ]

  const [selectedMembers, setSelectedMembers] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery),
  )

  const toggleMember = (memberId: number) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== memberId))
    } else {
      setSelectedMembers([...selectedMembers, memberId])
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return "#00C6AE"
    if (score >= 70) return "#0A2342"
    if (score >= 50) return "#D97706"
    return "#DC2626"
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
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Invite Members</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Step 3 of 4</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", gap: "6px" }}>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: step <= 3 ? "#00C6AE" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Selection Count */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} selected
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              You + {selectedMembers.length} = {selectedMembers.length + 1} total • No limit
            </p>
          </div>
          <div
            style={{
              background: "#F0FDFB",
              padding: "8px 12px",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#00C6AE" }}>∞</span>
          </div>
        </div>

        {/* Share Link Option */}
        <button
          onClick={() => console.log("Share Link")}
          style={{
            width: "100%",
            background: "#F0FDFB",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Share Invite Link</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              Anyone with the link can request to join
            </p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Search */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 14px",
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

          {/* Contacts List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto" }}>
            {filteredContacts.map((contact) => {
              const isSelected = selectedMembers.includes(contact.id)

              return (
                <button
                  key={contact.id}
                  onClick={() => toggleMember(contact.id)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isSelected ? "#F0FDFB" : "#F5F7FA",
                    borderRadius: "12px",
                    border: isSelected ? "2px solid #00C6AE" : "1px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
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
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{contact.name}</p>
                      <span
                        style={{
                          background: "#F5F7FA",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: "700",
                          color: getScoreColor(contact.xnScore),
                        }}
                      >
                        ⭐ {contact.xnScore}
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{contact.phone}</p>
                  </div>
                  {isSelected ? (
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
              )
            })}
          </div>
        </div>

        {/* Tip */}
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            marginTop: "16px",
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
            <strong>Tip:</strong> Invite members with higher XnScores for a more reliable circle. There's no limit - you
            can invite as many members as you want!
          </p>
        </div>
      </div>

      {/* Continue Button */}
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
          onClick={() => console.log("Continue", selectedMembers)}
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
          {selectedMembers.length > 0
            ? `Continue with ${selectedMembers.length} invite${selectedMembers.length > 1 ? "s" : ""}`
            : "Skip for Now"}
        </button>
      </div>
    </div>
  )
}
