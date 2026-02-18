"use client"

import { useState } from "react"

export default function LiveChatScreen() {
  const [inputText, setInputText] = useState("")

  const agent = {
    name: "Sarah",
    avatar: "S",
    status: "online",
  }

  const messages = [
    { id: "m1", type: "agent", text: "Hi! I'm Sarah from TandaXn support. How can I help you today?", time: "3:42 PM" },
    { id: "m2", type: "user", text: "I have a question about my circle payout", time: "3:43 PM" },
    {
      id: "m3",
      type: "agent",
      text: "Of course! I'd be happy to help with that. Can you tell me which circle you're asking about?",
      time: "3:43 PM",
    },
  ]

  const handleSend = () => {
    if (inputText.trim()) {
      console.log("Send message:", inputText)
      setInputText("")
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
      {/* Header - Navy */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #143654 100%)",
          padding: "16px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#00C6AE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: "600",
                position: "relative",
              }}
            >
              {agent.avatar}
              <div
                style={{
                  position: "absolute",
                  bottom: "0",
                  right: "0",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#10B981",
                  border: "2px solid #0A2342",
                }}
              />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>{agent.name}</p>
              <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Support Agent • Online</p>
            </div>
          </div>
          <button
            onClick={() => console.log("End chat")}
            style={{
              padding: "8px 12px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "8px",
              border: "none",
              fontSize: "12px",
              fontWeight: "500",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            End Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px",
          overflowY: "auto",
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.type === "user" ? "flex-end" : "flex-start",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: msg.type === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: msg.type === "user" ? "#00C6AE" : "#FFFFFF",
                color: msg.type === "user" ? "#FFFFFF" : "#0A2342",
                border: msg.type === "user" ? "none" : "1px solid #E5E7EB",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>{msg.text}</p>
              <p
                style={{
                  margin: "6px 0 0 0",
                  fontSize: "10px",
                  opacity: 0.7,
                  textAlign: "right",
                }}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#00C6AE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "600",
              color: "#FFFFFF",
            }}
          >
            {agent.avatar}
          </div>
          <div
            style={{
              padding: "10px 14px",
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              display: "flex",
              gap: "4px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#9CA3AF",
                animation: "pulse 1s infinite",
              }}
            />
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#9CA3AF",
                animation: "pulse 1s infinite 0.2s",
              }}
            />
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#9CA3AF",
                animation: "pulse 1s infinite 0.4s",
              }}
            />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "12px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <button
            style={{
              padding: "10px",
              background: "#F5F7FA",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "24px",
              border: "1px solid #E5E7EB",
              fontSize: "14px",
              color: "#0A2342",
              outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              border: "none",
              background: inputText.trim() ? "#00C6AE" : "#E5E7EB",
              cursor: inputText.trim() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={inputText.trim() ? "#FFFFFF" : "#9CA3AF"}
              strokeWidth="2"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
