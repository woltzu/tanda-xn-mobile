"use client"

import { TabBarInline } from "../../../components/TabBar"

export default function NotificationsListScreen() {
  const notifications = [
    {
      id: "n1",
      type: "payment",
      title: "Payment Received",
      message: "You received $100 from Family Unity circle",
      time: "2 min ago",
      read: false,
    },
    {
      id: "n2",
      type: "reminder",
      title: "Contribution Due",
      message: "Your weekly contribution of $50 is due tomorrow",
      time: "1 hour ago",
      read: false,
    },
    {
      id: "n3",
      type: "circle",
      title: "New Circle Invite",
      message: "Amara invited you to join 'Diaspora Savers'",
      time: "3 hours ago",
      read: true,
    },
    {
      id: "n4",
      type: "transfer",
      title: "Transfer Complete",
      message: "Your $200 transfer to Mama has been delivered",
      time: "Yesterday",
      read: true,
    },
    {
      id: "n5",
      type: "score",
      title: "XnScore Update",
      message: "Your XnScore increased to 74! Keep it up.",
      time: "2 days ago",
      read: true,
    },
  ]

  const unreadCount = notifications.filter((n) => !n.read).length

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "payment":
        return "💰"
      case "reminder":
        return "⏰"
      case "circle":
        return "🔄"
      case "transfer":
        return "🌍"
      case "score":
        return "📈"
      default:
        return "🔔"
    }
  }

  const handleBack = () => {
    console.log("Going back...")
  }

  const handleMarkAllRead = () => {
    console.log("Marking all as read...")
  }

  const handleSelectNotification = (notification: any) => {
    console.log("Selected notification:", notification.id)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Notifications</h1>
              {unreadCount > 0 && (
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                background: "none",
                border: "none",
                fontSize: "13px",
                color: "#00C6AE",
                cursor: "pointer",
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {notifications.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "60px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <span style={{ fontSize: "48px" }}>🔔</span>
            <p style={{ margin: "16px 0 4px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
              No notifications
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>You're all caught up!</p>
          </div>
        ) : (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
            }}
          >
            {notifications.map((notification, idx) => (
              <button
                key={notification.id}
                onClick={() => handleSelectNotification(notification)}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderBottom: idx < notifications.length - 1 ? "1px solid #F5F7FA" : "none",
                  background: notification.read ? "#FFFFFF" : "#F0FDFB",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: notification.read ? "#F5F7FA" : "#00C6AE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: 0,
                  }}
                >
                  {getTypeIcon(notification.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: notification.read ? "500" : "600",
                        color: "#0A2342",
                      }}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#00C6AE",
                        }}
                      />
                    )}
                  </div>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: "13px",
                      color: "#6B7280",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {notification.message}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{notification.time}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <TabBarInline activeTab="home" />
    </div>
  )
}
