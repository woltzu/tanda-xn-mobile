"use client"
import { useState } from "react"
import {
  ArrowLeft,
  Share2,
  Heart,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  MapPin,
  Star,
  ChevronRight,
  AlertCircle,
  Lock,
  CheckCircle,
  Award,
} from "lucide-react"

export default function CircleDetailsPreview() {
  const [isSaved, setIsSaved] = useState(false)

  const circle = {
    id: "c1",
    name: "Diaspora Family Fund",
    type: "family",
    description:
      "A trusted savings circle for families supporting loved ones back home. We pool our resources monthly and take turns receiving the full pot. Built on trust, transparency, and the tradition of community savings.",
    members: 8,
    maxMembers: 12,
    contribution: 200,
    frequency: "monthly",
    totalPool: 2400,
    minScore: 50,
    verified: true,
    createdAt: "Aug 2024",
    location: "USA → Kenya",
    nextPayout: "Jan 15, 2025",
    currentCycle: 3,
    totalCycles: 12,
    successRate: 98,
    avgMemberScore: 74,
    elder: {
      name: "Grace M.",
      score: 92,
      circlesOverseen: 12,
    },
    rules: [
      "Pay by the 5th of each month",
      "2-day grace period for late payments",
      "10% penalty for defaults",
      "Elder mediation for disputes",
    ],
    memberAvatars: ["G", "M", "S", "J", "A", "K", "T", "R"],
  }

  const userXnScore = 72
  const isLoggedIn = true
  const spotsLeft = circle.maxMembers - circle.members
  const canJoin = userXnScore >= circle.minScore && spotsLeft > 0

  const getTypeColor = (type: string) => {
    switch (type) {
      case "family":
        return { bg: "#DBEAFE", text: "#1D4ED8" }
      case "work":
        return { bg: "#D1FAE5", text: "#059669" }
      case "community":
        return { bg: "#FEF3C7", text: "#D97706" }
      case "friends":
        return { bg: "#EDE9FE", text: "#7C3AED" }
      default:
        return { bg: "#F3F4F6", text: "#6B7280" }
    }
  }

  const typeColor = getTypeColor(circle.type)

  const handleSave = () => {
    setIsSaved(!isSaved)
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
      {/* Hero Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A2342 0%, #1A3A5A 100%)",
          padding: "20px 20px 40px 20px",
          color: "#FFFFFF",
        }}
      >
        {/* Nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSave}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Heart
                size={20}
                color="#FFFFFF"
                fill={isSaved ? "#EF4444" : "none"}
                style={{ color: isSaved ? "#EF4444" : "#FFFFFF" }}
              />
            </button>
            <button
              onClick={() => console.log("Share")}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Share2 size={20} color="#FFFFFF" />
            </button>
          </div>
        </div>

        {/* Circle Info */}
        <div style={{ display: "flex", alignItems: "start", gap: "4px", marginBottom: "8px" }}>
          <span
            style={{
              background: typeColor.bg,
              color: typeColor.text,
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600",
              textTransform: "capitalize",
            }}
          >
            {circle.type}
          </span>
          {circle.verified && (
            <span
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                color: "#10B981",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Star size={10} fill="#10B981" />
              Verified
            </span>
          )}
        </div>

        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "700" }}>{circle.name}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", opacity: 0.9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <MapPin size={14} />
            <span style={{ fontSize: "13px" }}>{circle.location}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Calendar size={14} />
            <span style={{ fontSize: "13px" }}>Since {circle.createdAt}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          margin: "-24px 20px 20px 20px",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <DollarSign size={18} color="#00C6AE" style={{ marginBottom: "4px" }} />
          <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>${circle.contribution}</p>
          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#666" }}>
            per {circle.frequency === "monthly" ? "month" : circle.frequency === "biweekly" ? "2 weeks" : "week"}
          </p>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <Users size={18} color="#3B82F6" style={{ marginBottom: "4px" }} />
          <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
            {circle.members}/{circle.maxMembers}
          </p>
          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#666" }}>members</p>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "14px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <TrendingUp size={18} color="#10B981" style={{ marginBottom: "4px" }} />
          <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>
            ${circle.totalPool.toLocaleString()}
          </p>
          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#666" }}>pool size</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px" }}>
        {/* Description */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E0E0E0",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>About</h3>
          <p style={{ margin: 0, fontSize: "14px", color: "#444", lineHeight: "1.6" }}>{circle.description}</p>
        </div>

        {/* Quick Stats */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E0E0E0",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#D1FAE5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle size={20} color="#10B981" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                  {circle.successRate}%
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>Success Rate</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#DBEAFE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TrendingUp size={20} color="#3B82F6" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                  {circle.avgMemberScore}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>Avg XnScore</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clock size={20} color="#F59E0B" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>{circle.nextPayout}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>Next Payout</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#EDE9FE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Calendar size={20} color="#8B5CF6" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                  {circle.currentCycle}/{circle.totalCycles}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>Cycle</p>
              </div>
            </div>
          </div>
        </div>

        {/* Elder Info */}
        {circle.elder && (
          <div
            style={{
              background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #F59E0B30",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Award size={24} color="#FFFFFF" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#92400E", fontWeight: "600" }}>
                  CIRCLE ELDER
                </p>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#78350F" }}>{circle.elder.name}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#92400E" }}>
                  XnScore {circle.elder.score} • {circle.elder.circlesOverseen} circles overseen
                </p>
              </div>
              <ChevronRight size={20} color="#92400E" />
            </div>
          </div>
        )}

        {/* Members Preview */}
        <button
          onClick={() => console.log("See members")}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E0E0E0",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Members</h3>
              <div style={{ display: "flex", alignItems: "center" }}>
                {circle.memberAvatars.slice(0, 5).map((initial, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: `hsl(${idx * 60}, 60%, 70%)`,
                      border: "2px solid #FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: idx > 0 ? "-8px" : 0,
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    {initial}
                  </div>
                ))}
                {circle.members > 5 && (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "#F5F7FA",
                      border: "2px solid #FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: "-8px",
                      fontSize: "10px",
                      fontWeight: "600",
                      color: "#666",
                    }}
                  >
                    +{circle.members - 5}
                  </div>
                )}
              </div>
            </div>
            <ChevronRight size={20} color="#999" />
          </div>
        </button>

        {/* Rules Preview */}
        <button
          onClick={() => console.log("See rules")}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E0E0E0",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Circle Rules</h3>
            <ChevronRight size={20} color="#999" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {circle.rules.slice(0, 3).map((rule, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle size={14} color="#10B981" />
                <span style={{ fontSize: "13px", color: "#444" }}>{rule}</span>
              </div>
            ))}
            {circle.rules.length > 3 && (
              <span style={{ fontSize: "13px", color: "#00C6AE", fontWeight: "600", marginLeft: "22px" }}>
                +{circle.rules.length - 3} more rules
              </span>
            )}
          </div>
        </button>

        {/* Payout Order Preview (Blurred) */}
        <button
          onClick={() => console.log("See payout order")}
          style={{
            width: "100%",
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E0E0E0",
            cursor: "pointer",
            textAlign: "left",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Payout Order</h3>
            <ChevronRight size={20} color="#999" />
          </div>

          {/* Blurred preview */}
          <div
            style={{
              filter: "blur(4px)",
              opacity: 0.5,
              pointerEvents: "none",
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 0",
                  borderBottom: i < 3 ? "1px solid #F5F7FA" : "none",
                }}
              >
                <span
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  {i}
                </span>
                <div style={{ flex: 1, height: "12px", background: "#F5F7FA", borderRadius: "6px" }} />
              </div>
            ))}
          </div>

          {/* Join to see message */}
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#0A2342",
              color: "#FFFFFF",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Lock size={12} />
            Join to see full order
          </div>
        </button>

        {/* Requirement Warning */}
        {userXnScore < circle.minScore && (
          <div
            style={{
              background: "#FEF2F2",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <AlertCircle size={20} color="#DC2626" />
            <div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#DC2626" }}>XnScore too low</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#991B1B" }}>
                You need {circle.minScore} XnScore to join. Yours is {userXnScore}.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Join Button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E0E0E0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        {spotsLeft > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 2px 0", fontSize: "12px", color: "#666" }}>
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} remaining
              </p>
              <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0A2342" }}>
                ${circle.contribution}
                <span style={{ fontSize: "13px", fontWeight: "400", color: "#666" }}>
                  /{circle.frequency === "monthly" ? "month" : "2wk"}
                </span>
              </p>
            </div>
            <button
              onClick={() => console.log(isLoggedIn ? (canJoin ? "Join" : "Score too low") : "Login")}
              disabled={isLoggedIn && !canJoin}
              style={{
                padding: "16px 40px",
                borderRadius: "14px",
                border: "none",
                background: canJoin || !isLoggedIn ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E0E0E0",
                color: canJoin || !isLoggedIn ? "#FFFFFF" : "#999",
                fontSize: "16px",
                fontWeight: "600",
                cursor: canJoin || !isLoggedIn ? "pointer" : "not-allowed",
                boxShadow: canJoin || !isLoggedIn ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
              }}
            >
              {!isLoggedIn ? "Sign In to Join" : canJoin ? "Join Circle" : "Score Too Low"}
            </button>
          </div>
        ) : (
          <button
            disabled
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: "#E0E0E0",
              color: "#999",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "not-allowed",
            }}
          >
            Circle is Full
          </button>
        )}
      </div>
    </div>
  )
}
