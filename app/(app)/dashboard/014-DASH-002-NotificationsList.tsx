"use client"

import { useState } from "react"
import {
  ArrowLeft,
  DollarSign,
  Users,
  Bell,
  Shield,
  AlertCircle,
  TrendingUp,
  Calendar,
  UserPlus,
  CheckCircle,
} from "lucide-react"

export default function NotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState("all")
  const [notificationList, setNotificationList] = useState([
    {
      id: 1,
      type: "payment",
      title: "Contribution Due Tomorrow",
      message:
        "Your $200 contribution to Family Circle is due tomorrow. Make sure to pay on time to maintain your XnScore.",
      time: "2 hours ago",
      read: false,
      icon: "calendar",
      actionable: true,
    },
    {
      id: 2,
      type: "payment",
      title: "Payout Received! 🎉",
      message: "You received $1,500 from Family Circle. Funds are now in your wallet.",
      time: "Yesterday",
      read: false,
      icon: "dollar",
      actionable: false,
    },
    {
      id: 3,
      type: "circle",
      title: "New Member Joined",
      message: "Sarah M. has joined Coworkers Savings. Your circle now has 7 members.",
      time: "2 days ago",
      read: true,
      icon: "user-plus",
      actionable: false,
    },
    {
      id: 4,
      type: "system",
      title: "XnScore Increased",
      message: "Great news! Your XnScore increased to 72 (+3). Keep up the good work!",
      time: "3 days ago",
      read: true,
      icon: "trending",
      actionable: false,
    },
    {
      id: 5,
      type: "circle",
      title: "Payout Order Updated",
      message: "The payout order for Family Circle has been updated. You are now in position 3.",
      time: "1 week ago",
      read: true,
      icon: "users",
      actionable: true,
    },
    {
      id: 6,
      type: "system",
      title: "Security Alert",
      message: "New login detected from iPhone in New York. If this wasn't you, secure your account.",
      time: "1 week ago",
      read: true,
      icon: "shield",
      actionable: true,
    },
  ])

  const filters = [
    { id: "all", label: "All" },
    { id: "payment", label: "Payments" },
    { id: "circle", label: "Circles" },
    { id: "system", label: "System" },
  ]

  const getIcon = (iconType: string) => {
    const iconProps = { size: 18, color: "#FFFFFF" }
    switch (iconType) {
      case "dollar":
        return <DollarSign {...iconProps} />
      case "users":
        return <Users {...iconProps} />
      case "user-plus":
        return <UserPlus {...iconProps} />
      case "calendar":
        return <Calendar {...iconProps} />
      case "trending":
        return <TrendingUp {...iconProps} />
      case "shield":
        return <Shield {...iconProps} />
      case "alert":
        return <AlertCircle {...iconProps} />
      default:
        return <Bell {...iconProps} />
    }
  }

  const getIconColor = (type: string) => {
    switch (type) {
      case "payment":
        return "#00C6AE"
      case "circle":
        return "#0A2342"
      case "system":
        return "#D97706"
      default:
        return "#6B7280"
    }
  }

  const filteredNotifications =
    activeFilter === "all" ? notificationList : notificationList.filter((n) => n.type === activeFilter)

  const unreadCount = notificationList.filter((n) => !n.read).length

  const handleMarkAllRead = () => {
    setNotificationList(notificationList.map((n) => ({ ...n, read: true })))
  }

  const handleNotificationClick = (notification: any) => {
    setNotificationList(notificationList.map((n) => (n.id === notification.id ? { ...n, read: true } : n)))
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header - Navy Gradient */}
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
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => console.log("Back")}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>Notifications</h1>
              {unreadCount > 0 && (
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                cursor: "pointer",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle size={16} color="#00C6AE" />
              <span style={{ fontSize: "13px", color: "#FFFFFF", fontWeight: "600" }}>Mark all read</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              style={{
                background: activeFilter === filter.id ? "#0A2342" : "#F5F7FA",
                color: activeFilter === filter.id ? "#FFFFFF" : "#666",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              {filter.label}
              {filter.id !== "all" && (
                <span style={{ marginLeft: "6px", opacity: 0.7 }}>
                  ({notificationList.filter((n) => n.type === filter.id).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div style={{ padding: "16px 20px" }}>
        {filteredNotifications.length === 0 ? (
          /* Empty State */
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Bell size={36} color="#999" />
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#0A2342" }}>No notifications</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
              {activeFilter === "all" ? "You're all caught up!" : `No ${activeFilter} notifications yet`}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredNotifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  background: notification.read ? "#FFFFFF" : "#F0FDFB",
                  border: notification.read ? "1px solid #E0E0E0" : "1px solid #00C6AE",
                  borderRadius: "14px",
                  padding: "16px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  position: "relative",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", gap: "12px" }}>
                  {/* Icon */}
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: getIconColor(notification.type),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getIcon(notification.icon)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "start",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: notification.read ? "500" : "600",
                          color: "#0A2342",
                          lineHeight: "1.3",
                        }}
                      >
                        {notification.title}
                      </p>

                      {/* Unread Indicator */}
                      {!notification.read && (
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#00C6AE",
                            flexShrink: 0,
                            marginTop: "4px",
                          }}
                        />
                      )}
                    </div>

                    <p
                      style={{
                        margin: "6px 0 0 0",
                        fontSize: "13px",
                        color: "#666",
                        lineHeight: "1.4",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {notification.message}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: "10px",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "12px", color: "#999" }}>{notification.time}</p>

                      {notification.actionable && (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#00C6AE",
                            fontWeight: "600",
                          }}
                        >
                          View details →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
