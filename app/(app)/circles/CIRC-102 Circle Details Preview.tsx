"use client"
import { useState, useEffect } from "react"
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
import { useCircles, Circle, CircleMember } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { useCircleParams, goBack, navigateToCircleScreen } from "./useCircleParams"

export default function CircleDetailsPreview() {
  const [isSaved, setIsSaved] = useState(false)
  const [circle, setCircle] = useState<Circle | null>(null)
  const [members, setMembers] = useState<CircleMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { circleId } = useCircleParams()
  const { getCircleById, getCircleMembers, generateInviteCode, browseCircles } = useCircles()
  const { user } = useAuth()

  useEffect(() => {
    if (!circleId) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        // Try getCircleById first, then search browseCircles
        let found = getCircleById(circleId)
        if (!found) {
          found = browseCircles.find((c) => c.id === circleId) || null
        }
        if (!found) {
          setError("Circle not found")
          setLoading(false)
          return
        }
        setCircle(found)

        // Load members
        const membersData = await getCircleMembers(circleId)
        setMembers(membersData)
      } catch (err: any) {
        setError(err.message || "Failed to load circle")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [circleId])

  // Compute derived values from real data
  const userXnScore = user?.xnScore ?? 0
  const isLoggedIn = !!user

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <p style={{ fontSize: "16px", color: "#666" }}>Loading circle...</p>
      </div>
    )
  }

  if (error || !circle) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F7FA",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          gap: "16px",
        }}
      >
        <AlertCircle size={40} color="#DC2626" />
        <p style={{ fontSize: "16px", color: "#DC2626" }}>{error || "Circle not found"}</p>
        <button
          onClick={() => goBack()}
          style={{
            padding: "10px 24px",
            borderRadius: "10px",
            border: "none",
            background: "#0A2342",
            color: "#FFFFFF",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Go Back
        </button>
      </div>
    )
  }

  // Compute display values from real circle + members data
  const spotsLeft = circle.memberCount - circle.currentMembers
  const minScore = circle.minScore ?? 0
  const canJoin = userXnScore >= minScore && spotsLeft > 0
  const totalPool = circle.amount * circle.memberCount
  const successRate = circle.progress > 0 ? Math.round(circle.progress) : null
  const avgMemberScore =
    members.length > 0
      ? Math.round(members.reduce((sum, m) => sum + m.xnScore, 0) / members.length)
      : null
  const elder = members.find((m) => m.role === "elder" || m.role === "creator")
  const memberAvatars = members.map((m) => m.name.charAt(0).toUpperCase())
  const circleType = circle.type === "traditional" ? "family" : circle.type === "goal-based" ? "work" : circle.type === "family-support" ? "family" : circle.type

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

  const typeColor = getTypeColor(circleType)

  const handleSave = () => {
    setIsSaved(!isSaved)
  }

  const handleShare = async () => {
    try {
      const code = generateInviteCode(circle)
      await navigator.clipboard.writeText(code)
      alert("Invite code copied to clipboard!")
    } catch {
      alert("Could not copy invite code")
    }
  }

  const handleJoin = () => {
    navigateToCircleScreen("CIRC-107 Join Circle Confirmation", { circleId: circle.id })
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
            onClick={() => goBack()}
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
              onClick={handleShare}
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
            {circleType}
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
          {circle.location && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <MapPin size={14} />
              <span style={{ fontSize: "13px" }}>{circle.location}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Calendar size={14} />
            <span style={{ fontSize: "13px" }}>Since {new Date(circle.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
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
          <p style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0A2342" }}>${circle.amount}</p>
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
            {circle.currentMembers}/{circle.memberCount}
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
            ${totalPool.toLocaleString()}
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
          <p style={{ margin: 0, fontSize: "14px", color: "#444", lineHeight: "1.6" }}>{circle.description || "No description provided."}</p>
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
                  {successRate !== null ? `${successRate}%` : "N/A"}
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
                  {avgMemberScore !== null ? avgMemberScore : "N/A"}
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
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                  {circle.startDate ? new Date(circle.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
                </p>
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
                  {circle.currentCycle ?? 1}/{circle.totalCycles ?? circle.memberCount}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>Cycle</p>
              </div>
            </div>
          </div>
        </div>

        {/* Elder Info */}
        {elder && (
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
                <p style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#78350F" }}>{elder.name}</p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#92400E" }}>
                  XnScore {elder.xnScore}
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
                {memberAvatars.slice(0, 5).map((initial, idx) => (
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
                {circle.currentMembers > 5 && (
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
                    +{circle.currentMembers - 5}
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
            {[
              `Pay by the ${circle.gracePeriodDays > 0 ? circle.gracePeriodDays + "th" : "due date"} of each ${circle.frequency === "monthly" ? "month" : "cycle"}`,
              `${circle.gracePeriodDays}-day grace period for late payments`,
              "10% penalty for defaults",
              "Elder mediation for disputes",
            ].slice(0, 3).map((rule, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle size={14} color="#10B981" />
                <span style={{ fontSize: "13px", color: "#444" }}>{rule}</span>
              </div>
            ))}
            <span style={{ fontSize: "13px", color: "#00C6AE", fontWeight: "600", marginLeft: "22px" }}>
              +1 more rules
            </span>
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
        {userXnScore < minScore && (
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
                You need {minScore} XnScore to join. Yours is {userXnScore}.
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
                ${circle.amount}
                <span style={{ fontSize: "13px", fontWeight: "400", color: "#666" }}>
                  /{circle.frequency === "monthly" ? "month" : "2wk"}
                </span>
              </p>
            </div>
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  window.location.href = "/login"
                } else if (canJoin) {
                  handleJoin()
                }
              }}
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
