"use client"

import { useState } from "react"

export default function CircleChat() {
  const circle = {
    name: "Family Savings",
    memberCount: 6,
  }

  const messages = [
    {
      id: 1,
      sender: "Marie C.",
      avatar: "M",
      text: "Don't forget, contributions are due this Friday!",
      time: "2:30 PM",
      isYou: false,
    },
    {
      id: 2,
      sender: "You",
      avatar: "F",
      text: "Thanks for the reminder Marie! I'll send mine today.",
      time: "2:32 PM",
      isYou: true,
    },
    { id: 3, sender: "Kwame M.", avatar: "K", text: "Just sent my contribution 💪", time: "3:15 PM", isYou: false },
    {
      id: 4,
      sender: "Amara O.",
      avatar: "A",
      text: "Great job everyone! We're on track for this cycle.",
      time: "3:20 PM",
      isYou: false,
    },
    { id: 5, sender: "You", avatar: "F", text: "Done! Sent mine too ✅", time: "4:45 PM", isYou: true },
  ]

  const [newMessage, setNewMessage] = useState("")

  const handleSend = () => {
    if (newMessage.trim()) {
      console.log("Send message:", newMessage)
      setNewMessage("")
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "20px",
          flexShrink: 0,
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
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF" }}>{circle.name}</h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
              {circle.memberCount} members
            </p>
          </div>
          <button
            onClick={() => console.log("View members")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "10px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: "16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Date Divider */}
        <div
          style={{
            textAlign: "center",
            margin: "8px 0",
          }}
        >
          <span
            style={{
              background: "#E5E7EB",
              padding: "4px 12px",
              borderRadius: "10px",
              fontSize: "11px",
              color: "#6B7280",
            }}
          >
            Today
          </span>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              flexDirection: message.isYou ? "row-reverse" : "row",
              alignItems: "flex-end",
              gap: "8px",
            }}
          >
            {!message.isYou && (
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#0A2342",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "600",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {message.avatar}
              </div>
            )}
            <div
              style={{
                maxWidth: "75%",
              }}
            >
              {!message.isYou && (
                <p style={{ margin: "0 0 4px 4px", fontSize: "11px", color: "#6B7280" }}>{message.sender}</p>
              )}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: message.isYou ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: message.isYou ? "#00C6AE" : "#FFFFFF",
                  color: message.isYou ? "#FFFFFF" : "#0A2342",
                  boxShadow: message.isYou ? "none" : "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.4 }}>{message.text}</p>
              </div>
              <p
                style={{
                  margin: "4px 4px 0 4px",
                  fontSize: "10px",
                  color: "#9CA3AF",
                  textAlign: message.isYou ? "right" : "left",
                }}
              >
                {message.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Message Input */}
      <div
        style={{
          padding: "12px 16px 32px 16px",
          background: "#FFFFFF",
          borderTop: "1px solid #E5E7EB",
          flexShrink: 0,
        }}
      >
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
              display: "flex",
              alignItems: "center",
              background: "#F5F7FA",
              borderRadius: "24px",
              padding: "4px 4px 4px 16px",
            }}
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "14px",
                outline: "none",
                padding: "8px 0",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "none",
                background: newMessage.trim() ? "#00C6AE" : "#E5E7EB",
                cursor: newMessage.trim() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={newMessage.trim() ? "#FFFFFF" : "#9CA3AF"}
                strokeWidth="2"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Replies */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "10px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          {["Thanks!", "Sent ✅", "Reminder: Due Friday", "👍"].map((reply, idx) => (
            <button
              key={idx}
              onClick={() => setNewMessage(reply)}
              style={{
                padding: "8px 14px",
                background: "#F5F7FA",
                borderRadius: "16px",
                border: "1px solid #E5E7EB",
                fontSize: "12px",
                color: "#6B7280",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {reply}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
