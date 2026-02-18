"use client"

import { useState } from "react"

export default function SavedRecipientsScreen() {
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const recipients = [
    {
      id: "r1",
      name: "Mama Kengne",
      nickname: "Mama",
      country: "Cameroon",
      flag: "🇨🇲",
      phone: "+237 6XX XXX XXX",
      provider: "MTN Mobile Money",
      lastSent: "Dec 29, 2025",
      totalSent: 1200,
      isFavorite: true,
    },
    {
      id: "r2",
      name: "Papa Kengne",
      nickname: "Papa",
      country: "Cameroon",
      flag: "🇨🇲",
      phone: "+237 6XX XXX XXX",
      provider: "Orange Money",
      lastSent: "Dec 15, 2025",
      totalSent: 800,
      isFavorite: true,
    },
    {
      id: "r3",
      name: "Grace Achieng",
      nickname: "Auntie Grace",
      country: "Kenya",
      flag: "🇰🇪",
      phone: "+254 7XX XXX XXX",
      provider: "M-Pesa",
      lastSent: "Dec 1, 2025",
      totalSent: 450,
      isFavorite: false,
    },
    {
      id: "r4",
      name: "David Okonkwo",
      nickname: "Cousin David",
      country: "Nigeria",
      flag: "🇳🇬",
      phone: "+234 8XX XXX XXX",
      provider: "Bank Transfer",
      lastSent: "Nov 20, 2025",
      totalSent: 200,
      isFavorite: false,
    },
  ]

  const favorites = recipients.filter((r) => r.isFavorite)
  const others = recipients.filter((r) => !r.isFavorite)

  const filteredRecipients = searchQuery
    ? recipients.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.country.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null

  const handleBack = () => {
    console.log("Navigate back")
  }

  const handleSelectRecipient = (recipient: any) => {
    console.log("Select recipient:", recipient)
  }

  const handleAddRecipient = () => {
    console.log("Add recipient")
  }

  const handleEditRecipient = (recipient: any) => {
    console.log("Edit recipient:", recipient)
  }

  const handleDeleteRecipient = (recipient: any) => {
    console.log("Delete recipient:", recipient)
  }

  const RecipientCard = ({ recipient }: { recipient: any }) => (
    <button
      onClick={() => handleSelectRecipient(recipient)}
      style={{
        width: "100%",
        padding: "14px",
        background: "#FFFFFF",
        borderRadius: "12px",
        border: "1px solid #E5E7EB",
        marginBottom: "10px",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "50px",
          height: "50px",
          borderRadius: "50%",
          background: "#F0FDFB",
          border: "2px solid #00C6AE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          position: "relative",
        }}
      >
        {recipient.flag}
        {recipient.isFavorite && (
          <div
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              fontSize: "14px",
            }}
          >
            ⭐
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
          {recipient.nickname || recipient.name}
        </p>
        <p style={{ margin: "0 0 2px 0", fontSize: "12px", color: "#6B7280" }}>{recipient.provider}</p>
        <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
          Last: {recipient.lastSent} • ${recipient.totalSent} total
        </p>
      </div>

      {/* Action */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setSelectedRecipient(recipient)
        }}
        style={{
          padding: "8px",
          background: "#F5F7FA",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      </button>
    </button>
  )

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "40px",
      }}
    >
      {/* Header - Navy */}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Saved Recipients</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{recipients.length} recipients</p>
          </div>
          <button
            onClick={handleAddRecipient}
            style={{
              padding: "8px 14px",
              background: "#00C6AE",
              borderRadius: "8px",
              border: "none",
              fontSize: "12px",
              fontWeight: "600",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "10px",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ padding: "8px 10px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 10px 10px 0",
              border: "none",
              fontSize: "14px",
              color: "#FFFFFF",
              background: "transparent",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {filteredRecipients ? (
          // Search Results
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>
              Search Results ({filteredRecipients.length})
            </h3>
            {filteredRecipients.map((r) => (
              <RecipientCard key={r.id} recipient={r} />
            ))}
            {filteredRecipients.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <span style={{ fontSize: "40px" }}>🔍</span>
                <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#6B7280" }}>No recipients found</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Favorites */}
            {favorites.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>
                  ⭐ Favorites
                </h3>
                {favorites.map((r) => (
                  <RecipientCard key={r.id} recipient={r} />
                ))}
              </div>
            )}

            {/* Others */}
            {others.length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>
                  All Recipients
                </h3>
                {others.map((r) => (
                  <RecipientCard key={r.id} recipient={r} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Sheet */}
      {selectedRecipient && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,35,66,0.8)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: "100%",
              background: "#FFFFFF",
              borderRadius: "20px 20px 0 0",
              padding: "20px 20px 40px 20px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "28px" }}>{selectedRecipient.flag}</span>
                <div>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                    {selectedRecipient.nickname || selectedRecipient.name}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{selectedRecipient.country}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecipient(null)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "8px" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => {
                  handleSelectRecipient(selectedRecipient)
                  setSelectedRecipient(null)
                }}
                style={{
                  padding: "14px",
                  background: "#F0FDFB",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#00897B",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                💸 Send Money
              </button>
              <button
                onClick={() => {
                  handleEditRecipient(selectedRecipient)
                  setSelectedRecipient(null)
                }}
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#0A2342",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ✏️ Edit Details
              </button>
              <button
                style={{
                  padding: "14px",
                  background: "#F5F7FA",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#0A2342",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {selectedRecipient.isFavorite ? "⭐ Remove from Favorites" : "⭐ Add to Favorites"}
              </button>
              <button
                onClick={() => {
                  handleDeleteRecipient(selectedRecipient)
                  setSelectedRecipient(null)
                }}
                style={{
                  padding: "14px",
                  background: "#FEE2E2",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#DC2626",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                🗑️ Delete Recipient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
