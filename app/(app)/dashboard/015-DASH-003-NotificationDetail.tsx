"use client"

import { useState } from "react"
import {
  ArrowLeft,
  DollarSign,
  Users,
  Bell,
  Shield,
  Calendar,
  UserPlus,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react"

export default function NotificationDetailScreen() {
  const [actionTaken, setActionTaken] = useState(false)

  const notification = {
    id: 1,
    type: "payment",
    title: "Contribution Due Tomorrow",
    message:
      "Your $200 contribution to Family Circle is due tomorrow. Make sure to pay on time to maintain your XnScore.",
    fullMessage:
      "Your monthly contribution of $200 to Family Circle is due on January 5th, 2025. Paying on time helps maintain your XnScore and ensures the circle runs smoothly for all members.\n\nYou're currently in position 3 for the payout rotation. Keep up the good work!",
    time: "2 hours ago",
    timestamp: "December 28, 2024 at 2:34 PM",
    read: false,
    icon: "calendar",
    actionable: true,
    relatedCircle: {
      name: "Family Circle",
      id: "fc-123",
      contribution: 200,
      dueDate: "Jan 5, 2025",
    },
    actions: [
      { id: "pay", label: "Pay Now", primary: true },
      { id: "view", label: "View Circle", primary: false },
    ],
  }

  const getIcon = (iconType: string) => {
    const iconProps = { size: 24, color: "#FFFFFF" }
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
        return <AlertTriangle {...iconProps} />
      default:
        return <Bell {...iconProps} />
    }
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "payment":
        return { label: "Payment", color: "#00C6AE", bgColor: "#F0FDFB" }
      case "circle":
        return { label: "Circle Update", color: "#0A2342", bgColor: "#F5F7FA" }
      case "system":
        return { label: "System", color: "#D97706", bgColor: "#FEF3C7" }
      default:
        return { label: "Notification", color: "#6B7280", bgColor: "#F3F4F6" }
    }
  }

  const typeInfo = getTypeInfo(notification.type)

  const handleAction = (action: any) => {
    setActionTaken(true)
    console.log("Action taken:", action)
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
            gap: "12px",
          }}
        >
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
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#FFFFFF" }}>Notification</h1>
          </div>
          <span
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "#FFFFFF",
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            {typeInfo.label}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: "20px" }}>
        {/* Icon and Title */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "16px",
            border: "1px solid #E0E0E0",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: typeInfo.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            {getIcon(notification.icon)}
          </div>

          <h1
            style={{
              margin: "0 0 12px 0",
              fontSize: "22px",
              fontWeight: "700",
              color: "#0A2342",
              lineHeight: "1.3",
            }}
          >
            {notification.title}
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <Clock size={14} color="#999" />
            <span style={{ fontSize: "13px", color: "#999" }}>{notification.timestamp}</span>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "15px",
              color: "#444",
              lineHeight: "1.6",
              whiteSpace: "pre-line",
            }}
          >
            {notification.fullMessage || notification.message}
          </p>
        </div>

        {/* Related Circle Info */}
        {notification.relatedCircle && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "16px",
              border: "1px solid #E0E0E0",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "14px",
                fontWeight: "600",
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Related Circle
            </h3>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px",
                background: "#F5F7FA",
                borderRadius: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "#0A2342",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users size={20} color="#00C6AE" />
                </div>
                <div>
                  <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                    {notification.relatedCircle.name}
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                    ${notification.relatedCircle.contribution} due {notification.relatedCircle.dueDate}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} color="#999" />
            </div>
          </div>
        )}

        {/* Action Taken Confirmation */}
        {actionTaken && (
          <div
            style={{
              background: "#D1FAE5",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <CheckCircle size={24} color="#00C6AE" />
            <p style={{ margin: 0, fontSize: "14px", color: "#065F46", fontWeight: "500" }}>
              Action completed successfully!
            </p>
          </div>
        )}

        {/* Actions */}
        {notification.actions && notification.actions.length > 0 && !actionTaken && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {notification.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "14px",
                  border: action.primary ? "none" : "2px solid #E0E0E0",
                  background: action.primary ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#FFFFFF",
                  color: action.primary ? "#FFFFFF" : "#0A2342",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: action.primary ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
                }}
              >
                {action.label}
                {!action.primary && <ExternalLink size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
