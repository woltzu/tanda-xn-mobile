"use client"

import { useState, useEffect } from "react"
import { useCircles } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"

export default function InviteToCircle() {
  const { circleId } = useCircleParams()
  const { getCircleById, getInvitedMembers, inviteMember, generateInviteCode } = useCircles()
  const { user } = useAuth()

  const [copied, setCopied] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [invitedMembers, setInvitedMembers] = useState<any[]>([])
  const [inviteName, setInviteName] = useState("")
  const [invitePhone, setInvitePhone] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const circle = circleId ? getCircleById(circleId) : undefined
  const inviteCode = circle ? generateInviteCode(circle) : ""
  const inviteLink = `https://tandaxn.com/join/${inviteCode}`

  useEffect(() => {
    if (!circleId) return
    setIsLoading(true)
    getInvitedMembers(circleId)
      .then((data) => setInvitedMembers(data))
      .catch((err) => console.error("Failed to load invited members:", err))
      .finally(() => setIsLoading(false))
  }, [circleId])

  const handleCopy = (type: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSendInvite = async () => {
    if (!circleId || !inviteName.trim() || !invitePhone.trim()) return
    setIsSending(true)
    setFeedback(null)
    try {
      await inviteMember(circleId, inviteName.trim(), invitePhone.trim())
      setFeedback({ type: "success", message: `Invite sent to ${inviteName}!` })
      setInviteName("")
      setInvitePhone("")
      // Refresh the invited members list
      const updated = await getInvitedMembers(circleId)
      setInvitedMembers(updated)
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to send invite" })
    } finally {
      setIsSending(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #E5E7EB",
              borderTop: "3px solid #00C6AE",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto",
            }}
          />
          <p style={{ color: "#6B7280", fontSize: "14px" }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
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
            onClick={() => goBack()}
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
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Invite Members</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{circle?.name || "Circle"}</p>
          </div>
        </div>

        {/* Circle Stats */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "rgba(0,198,174,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
            }}
          >
            👥
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>{circle?.currentMembers || 0} members</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
              {invitedMembers.length} invited so far
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: "-40px", padding: "0 20px" }}>
        {/* Invite Code */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Circle Invite Code</p>
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "32px",
              fontWeight: "700",
              color: "#0A2342",
              letterSpacing: "4px",
            }}
          >
            {inviteCode || "---"}
          </p>
          <button
            onClick={() => handleCopy("code", inviteCode)}
            style={{
              padding: "12px 24px",
              background: copied === "code" ? "#00C6AE" : "#F5F7FA",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {copied === "code" ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#FFFFFF" }}>Copied!</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0A2342" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Invite Link */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>Invite Link</p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "12px",
                background: "#F5F7FA",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#6B7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {inviteLink}
            </div>
            <button
              onClick={() => handleCopy("link", inviteLink)}
              style={{
                padding: "12px 16px",
                background: copied === "link" ? "#00C6AE" : "#0A2342",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              {copied === "link" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Send Invite Form */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Send Invite</h3>
          <input
            type="text"
            placeholder="Name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              marginBottom: "8px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              marginBottom: "12px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <button
            onClick={handleSendInvite}
            disabled={isSending || !inviteName.trim() || !invitePhone.trim()}
            style={{
              width: "100%",
              padding: "14px",
              background: isSending || !inviteName.trim() || !invitePhone.trim() ? "#E5E7EB" : "#00C6AE",
              borderRadius: "10px",
              border: "none",
              cursor: isSending || !inviteName.trim() || !invitePhone.trim() ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: isSending || !inviteName.trim() || !invitePhone.trim() ? "#9CA3AF" : "#FFFFFF",
            }}
          >
            {isSending ? "Sending..." : "Send Invite"}
          </button>

          {feedback && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                borderRadius: "8px",
                background: feedback.type === "success" ? "#F0FDFB" : "#FEE2E2",
                color: feedback.type === "success" ? "#065F46" : "#991B1B",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              {feedback.message}
            </div>
          )}
        </div>

        {/* Already Invited Members */}
        {invitedMembers.length > 0 && (
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
              Invited ({invitedMembers.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {invitedMembers.map((inv: any) => (
                <div
                  key={inv.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px",
                    background: "#F5F7FA",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "#0A2342",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    {inv.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>{inv.name}</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{inv.phone}</p>
                  </div>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "600",
                      background: inv.status === "accepted" ? "#F0FDFB" : inv.status === "declined" ? "#FEE2E2" : "#FEF3C7",
                      color: inv.status === "accepted" ? "#00897B" : inv.status === "declined" ? "#DC2626" : "#D97706",
                    }}
                  >
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share Options */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>Share Via</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => console.log("Share WhatsApp")}
              style={{
                flex: 1,
                padding: "14px",
                background: "#25D366",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "24px" }}>💬</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#FFFFFF" }}>WhatsApp</span>
            </button>
            <button
              onClick={() => console.log("Share SMS")}
              style={{
                flex: 1,
                padding: "14px",
                background: "#0A2342",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "24px" }}>📱</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#FFFFFF" }}>SMS</span>
            </button>
            <button
              onClick={() => console.log("Share Email")}
              style={{
                flex: 1,
                padding: "14px",
                background: "#F5F7FA",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "24px" }}>✉️</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#0A2342" }}>Email</span>
            </button>
          </div>
        </div>

        {/* Info */}
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
            Anyone with the invite code or link can request to join. You'll need to approve new members before they can
            participate.
          </p>
        </div>
      </div>
    </div>
  )
}
