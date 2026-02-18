"use client"

import { ArrowLeft, Bell, Plus, Trash2, AlertCircle, Check } from "lucide-react"
import { useState } from "react"

export default function RateAlertsScreen() {
  const alerts = [
    { id: 1, from: "USD", to: "XOF", target: 620, current: 610, direction: "above", active: true, createdAt: "Dec 15" },
    {
      id: 2,
      from: "EUR",
      to: "XOF",
      target: 650,
      current: 656,
      direction: "below",
      active: true,
      createdAt: "Dec 10",
      triggered: true,
    },
    {
      id: 3,
      from: "USD",
      to: "NGN",
      target: 1600,
      current: 1550,
      direction: "above",
      active: false,
      createdAt: "Nov 28",
    },
    {
      id: 4,
      from: "GBP",
      to: "USD",
      target: 1.3,
      current: 1.268,
      direction: "above",
      active: true,
      createdAt: "Nov 20",
    },
  ]

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)

  const activeAlerts = alerts.filter((a) => a.active)
  const inactiveAlerts = alerts.filter((a) => !a.active)

  const getProgress = (alert: (typeof alerts)[0]) => {
    if (alert.direction === "above") {
      return Math.min(100, (alert.current / alert.target) * 100)
    }
    return Math.min(100, (alert.target / alert.current) * 100)
  }

  const AlertCard = ({ alert }: { alert: (typeof alerts)[0] }) => {
    const progress = getProgress(alert)
    const isClose = progress >= 90

    return (
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          padding: "16px",
          border: alert.triggered ? "2px solid #00C6AE" : "1px solid #E5E7EB",
          opacity: alert.active ? 1 : 0.6,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: alert.triggered ? "#F0FDFB" : isClose ? "#FEF3C7" : "#F5F7FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={20} color={alert.triggered ? "#00C6AE" : isClose ? "#D97706" : "#6B7280"} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                {alert.from} → {alert.to}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>Created {alert.createdAt}</p>
            </div>
          </div>

          {/* Toggle & Delete */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => console.log("Toggle alert", alert.id)}
              style={{
                width: "44px",
                height: "26px",
                borderRadius: "13px",
                background: alert.active ? "#00C6AE" : "#E5E7EB",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  position: "absolute",
                  top: "2px",
                  left: alert.active ? "20px" : "2px",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(alert.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <Trash2 size={18} color="#9CA3AF" />
            </button>
          </div>
        </div>

        {/* Alert Details */}
        <div
          style={{
            background: "#F5F7FA",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Alert when {alert.direction}</span>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
              {alert.target.toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>Current rate</span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: alert.triggered ? "#00C6AE" : "#0A2342",
              }}
            >
              {alert.current.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <span style={{ fontSize: "11px", color: "#6B7280" }}>Progress to target</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: alert.triggered ? "#00C6AE" : isClose ? "#D97706" : "#6B7280",
              }}
            >
              {progress.toFixed(0)}%
            </span>
          </div>
          <div
            style={{
              height: "6px",
              background: "#E5E7EB",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: alert.triggered ? "#00C6AE" : isClose ? "#D97706" : "#0A2342",
                borderRadius: "3px",
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>

        {/* Triggered Badge */}
        {alert.triggered && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "12px",
              padding: "8px 12px",
              background: "#F0FDFB",
              borderRadius: "8px",
            }}
          >
            <Check size={16} color="#00C6AE" />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#00897B" }}>
              Target reached! Rate hit {alert.target.toLocaleString()}
            </span>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm === alert.id && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: "#FEE2E2",
              borderRadius: "10px",
            }}
          >
            <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#991B1B" }}>Delete this alert?</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  console.log("Delete alert", alert.id)
                  setShowDeleteConfirm(null)
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#DC2626",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  color: "#0A2342",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
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
      {/* Header */}
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
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Rate Alerts</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
              {activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Create New Alert */}
        <button
          onClick={() => console.log("Create alert")}
          style={{
            width: "100%",
            padding: "16px",
            background: "#F0FDFB",
            borderRadius: "14px",
            border: "2px dashed #00C6AE",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <Plus size={20} color="#00C6AE" />
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#00C6AE" }}>Create New Alert</span>
        </button>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                fontWeight: "600",
                color: "#6B7280",
              }}
            >
              ACTIVE ALERTS
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activeAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {/* Inactive Alerts */}
        {inactiveAlerts.length > 0 && (
          <div>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "13px",
                fontWeight: "600",
                color: "#6B7280",
              }}
            >
              PAUSED ALERTS
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {inactiveAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {alerts.length === 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "40px 20px",
              textAlign: "center",
              border: "1px solid #E5E7EB",
            }}
          >
            <Bell size={48} color="#9CA3AF" style={{ marginBottom: "16px" }} />
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600", color: "#0A2342" }}>
              No Rate Alerts
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6B7280" }}>
              Get notified when exchange rates hit your target
            </p>
            <button
              onClick={() => console.log("Create first alert")}
              style={{
                padding: "14px 24px",
                background: "#00C6AE",
                borderRadius: "12px",
                border: "none",
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Create Your First Alert
            </button>
          </div>
        )}

        {/* Info */}
        {alerts.length > 0 && (
          <div
            style={{
              background: "#F0FDFB",
              borderRadius: "12px",
              padding: "14px",
              marginTop: "20px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <AlertCircle size={18} color="#00897B" style={{ marginTop: "2px", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "12px", color: "#065F46", lineHeight: 1.5 }}>
              <strong>How alerts work:</strong> We'll send you a push notification when the exchange rate reaches your
              target. You can then convert at the optimal rate.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
