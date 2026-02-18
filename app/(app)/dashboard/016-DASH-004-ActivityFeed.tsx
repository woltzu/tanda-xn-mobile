"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Gift,
  Send,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
} from "lucide-react"

export default function ActivityFeedScreen() {
  const [activeFilter, setActiveFilter] = useState("all")
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const activities = [
    {
      date: "Today",
      items: [
        {
          id: 1,
          type: "contribution",
          title: "Circle Contribution",
          description: "Paid to Coworkers Savings",
          amount: -100,
          time: "2:30 PM",
          status: "completed",
          circle: "Coworkers Savings",
        },
      ],
    },
    {
      date: "Yesterday",
      items: [
        {
          id: 2,
          type: "payout",
          title: "Circle Payout",
          description: "Received from Family Circle",
          amount: 1500,
          time: "10:15 AM",
          status: "completed",
          circle: "Family Circle",
        },
        {
          id: 3,
          type: "deposit",
          title: "Added to Goal",
          description: "Home Down Payment goal",
          amount: -250,
          time: "9:00 AM",
          status: "completed",
          goal: "Home Down Payment",
        },
      ],
    },
    {
      date: "December 26",
      items: [
        {
          id: 4,
          type: "reward",
          title: "Referral Bonus",
          description: "Sarah joined using your code",
          amount: 25,
          time: "3:45 PM",
          status: "completed",
        },
        {
          id: 5,
          type: "contribution",
          title: "Circle Contribution",
          description: "Paid to Family Circle",
          amount: -200,
          time: "11:00 AM",
          status: "completed",
          circle: "Family Circle",
        },
      ],
    },
    {
      date: "December 20",
      items: [
        {
          id: 6,
          type: "transfer",
          title: "Money Sent",
          description: "To Maria J. (Kenya)",
          amount: -500,
          time: "4:20 PM",
          status: "completed",
          recipient: "Maria J.",
        },
      ],
    },
  ]

  const stats = {
    totalIn: 1525,
    totalOut: 1050,
    netChange: 475,
  }

  const filters = [
    { id: "all", label: "All Activity" },
    { id: "in", label: "Money In" },
    { id: "out", label: "Money Out" },
    { id: "circles", label: "Circles Only" },
    { id: "goals", label: "Goals Only" },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return { icon: ArrowDownLeft, color: "#00C6AE", bg: "#F0FDFB" }
      case "contribution":
        return { icon: ArrowUpRight, color: "#F59E0B", bg: "#FEF3C7" }
      case "payout":
        return { icon: ArrowDownLeft, color: "#00C6AE", bg: "#F0FDFB" }
      case "withdrawal":
        return { icon: ArrowUpRight, color: "#EF4444", bg: "#FEE2E2" }
      case "transfer":
        return { icon: Send, color: "#0A2342", bg: "#F5F7FA" }
      case "reward":
        return { icon: Gift, color: "#00C6AE", bg: "#F0FDFB" }
      default:
        return { icon: RefreshCw, color: "#6B7280", bg: "#F3F4F6" }
    }
  }

  const filterActivities = (activities: any[]) => {
    if (activeFilter === "all") return activities

    return activities
      .map((group) => ({
        ...group,
        items: group.items.filter((item: any) => {
          switch (activeFilter) {
            case "in":
              return item.amount > 0
            case "out":
              return item.amount < 0
            case "circles":
              return item.circle
            case "goals":
              return item.goal
            default:
              return true
          }
        }),
      }))
      .filter((group) => group.items.length > 0)
  }

  const filteredActivities = filterActivities(activities)

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
              }}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </button>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#FFFFFF" }}>Activity</h1>
          </div>

          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "10px",
              padding: "8px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Filter size={16} color="#FFFFFF" />
            <span style={{ fontSize: "13px", color: "#FFFFFF", fontWeight: "500" }}>
              {filters.find((f) => f.id === activeFilter)?.label}
            </span>
            <ChevronDown size={14} color="#FFFFFF" />
          </button>
        </div>

        {/* Filter Dropdown */}
        {showFilterMenu && (
          <div
            style={{
              position: "absolute",
              right: "20px",
              top: "70px",
              background: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              border: "1px solid #E0E0E0",
              overflow: "hidden",
              zIndex: 20,
            }}
          >
            {filters.map((filter, idx) => (
              <button
                key={filter.id}
                onClick={() => {
                  setActiveFilter(filter.id)
                  setShowFilterMenu(false)
                }}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  border: "none",
                  borderBottom: idx < filters.length - 1 ? "1px solid #F5F7FA" : "none",
                  background: activeFilter === filter.id ? "#F0FDFB" : "#FFFFFF",
                  color: activeFilter === filter.id ? "#00C6AE" : "#0A2342",
                  fontSize: "14px",
                  fontWeight: activeFilter === filter.id ? "600" : "400",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
          }}
        >
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                marginBottom: "4px",
              }}
            >
              <TrendingUp size={14} color="#00C6AE" />
              <span style={{ fontSize: "11px", color: "#00C6AE", fontWeight: "600" }}>IN</span>
            </div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#065F46" }}>
              +${stats.totalIn.toLocaleString()}
            </p>
          </div>

          <div
            style={{
              background: "#FEE2E2",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                marginBottom: "4px",
              }}
            >
              <TrendingDown size={14} color="#EF4444" />
              <span style={{ fontSize: "11px", color: "#EF4444", fontWeight: "600" }}>OUT</span>
            </div>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#991B1B" }}>
              -${stats.totalOut.toLocaleString()}
            </p>
          </div>

          <div
            style={{
              background: stats.netChange >= 0 ? "#F0FDFB" : "#FEF2F2",
              borderRadius: "12px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                marginBottom: "4px",
              }}
            >
              <DollarSign size={14} color={stats.netChange >= 0 ? "#00C6AE" : "#EF4444"} />
              <span
                style={{
                  fontSize: "11px",
                  color: stats.netChange >= 0 ? "#00C6AE" : "#EF4444",
                  fontWeight: "600",
                }}
              >
                NET
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "700",
                color: stats.netChange >= 0 ? "#0A2342" : "#991B1B",
              }}
            >
              {stats.netChange >= 0 ? "+" : ""}
              {stats.netChange.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div style={{ padding: "20px" }}>
        {filteredActivities.length === 0 ? (
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
              <Calendar size={36} color="#999" />
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#0A2342" }}>No activity found</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>Try adjusting your filter</p>
          </div>
        ) : (
          filteredActivities.map((group, groupIdx) => (
            <div key={groupIdx} style={{ marginBottom: "24px" }}>
              {/* Date Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {group.date}
                </span>
                <div style={{ flex: 1, height: "1px", background: "#E0E0E0" }} />
              </div>

              {/* Activity Items */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid #E0E0E0",
                }}
              >
                {group.items.map((item, itemIdx) => {
                  const iconInfo = getActivityIcon(item.type)
                  const Icon = iconInfo.icon

                  return (
                    <button
                      key={item.id}
                      onClick={() => console.log("Activity clicked:", item)}
                      style={{
                        width: "100%",
                        padding: "16px",
                        border: "none",
                        borderBottom: itemIdx < group.items.length - 1 ? "1px solid #F5F7FA" : "none",
                        background: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        textAlign: "left",
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: iconInfo.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={20} color={iconInfo.color} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 2px 0", fontSize: "15px", fontWeight: "600", color: "#0A2342" }}>
                          {item.title}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            color: "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.description}
                        </p>
                      </div>

                      {/* Amount */}
                      <div style={{ textAlign: "right" }}>
                        <p
                          style={{
                            margin: "0 0 2px 0",
                            fontSize: "16px",
                            fontWeight: "700",
                            color: item.amount > 0 ? "#00C6AE" : "#0A2342",
                          }}
                        >
                          {item.amount > 0 ? "+" : ""}
                          {item.amount < 0 ? "-" : ""}${Math.abs(item.amount).toLocaleString()}
                        </p>
                        <p style={{ margin: 0, fontSize: "12px", color: "#999" }}>{item.time}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* Load More */}
        {filteredActivities.length > 0 && (
          <button
            style={{
              width: "100%",
              padding: "14px",
              background: "#FFFFFF",
              border: "1px solid #E0E0E0",
              borderRadius: "12px",
              color: "#666",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              marginTop: "8px",
            }}
          >
            Load More Activity
          </button>
        )}
      </div>
    </div>
  )
}
