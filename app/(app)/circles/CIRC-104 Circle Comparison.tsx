"use client"

import { useState } from "react"
import { ArrowLeft, Plus, X, TrendingUp, Star, CheckCircle, XCircle, Sparkles } from "lucide-react"

export default function CircleComparisonScreen() {
  const [highlightMetric, setHighlightMetric] = useState<string | null>(null)

  const selectedCircles = [
    {
      id: "c1",
      name: "Diaspora Family Fund",
      type: "family",
      contribution: 200,
      frequency: "monthly",
      totalPool: 2400,
      members: 8,
      maxMembers: 12,
      minScore: 50,
      avgScore: 74,
      successRate: 98,
      nextPayout: "Jan 15",
      verified: true,
      elder: "Grace M.",
      pros: ["High success rate", "Verified circle", "Experienced Elder"],
      cons: ["Higher contribution", "Longer wait for payout"],
    },
    {
      id: "c2",
      name: "Brooklyn Savers",
      type: "community",
      contribution: 100,
      frequency: "weekly",
      totalPool: 1000,
      members: 10,
      maxMembers: 10,
      minScore: 40,
      avgScore: 65,
      successRate: 92,
      nextPayout: "Dec 30",
      verified: true,
      elder: "Marcus T.",
      pros: ["Lower contribution", "Faster payouts", "Local community"],
      cons: ["Full - waitlist only", "Lower pool amount"],
    },
    {
      id: "c3",
      name: "Tech Workers Fund",
      type: "work",
      contribution: 500,
      frequency: "biweekly",
      totalPool: 4000,
      members: 6,
      maxMembers: 8,
      minScore: 65,
      avgScore: 82,
      successRate: 100,
      nextPayout: "Jan 8",
      verified: true,
      elder: "Sarah K.",
      pros: ["Highest pool", "Perfect track record", "Professional network"],
      cons: ["High min score", "Large contribution"],
    },
  ]

  const userXnScore = 72
  const maxCompare = 3

  const getTypeColor = (type: string) => {
    switch (type) {
      case "family":
        return { bg: "#F0FDFB", text: "#00897B" }
      case "work":
        return { bg: "#F5F7FA", text: "#0A2342" }
      case "community":
        return { bg: "#FEF3C7", text: "#D97706" }
      default:
        return { bg: "#F3F4F6", text: "#6B7280" }
    }
  }

  const getBestValue = (metric: string) => {
    switch (metric) {
      case "contribution":
        return Math.min(...selectedCircles.map((c) => c.contribution))
      case "pool":
        return Math.max(...selectedCircles.map((c) => c.totalPool))
      case "successRate":
        return Math.max(...selectedCircles.map((c) => c.successRate))
      case "avgScore":
        return Math.max(...selectedCircles.map((c) => c.avgScore))
      case "minScore":
        return Math.min(...selectedCircles.map((c) => c.minScore))
      default:
        return null
    }
  }

  const isBestValue = (circle: any, metric: string, value: number) => {
    const best = getBestValue(metric)
    if (metric === "contribution" || metric === "minScore") {
      return value === best
    }
    return value === best
  }

  const canJoin = (circle: any) => {
    const spotsLeft = circle.maxMembers - circle.members
    return userXnScore >= circle.minScore && spotsLeft > 0
  }

  // Find recommended circle based on user profile
  const getRecommendation = () => {
    const eligible = selectedCircles.filter((c) => canJoin(c))
    if (eligible.length === 0) return null

    // Score each circle based on factors
    const scored = eligible.map((c) => ({
      ...c,
      score: c.successRate + c.avgScore - c.contribution / 10,
    }))

    return scored.sort((a, b) => b.score - a.score)[0]
  }

  const recommended = getRecommendation()

  const comparisonMetrics = [
    {
      key: "contribution",
      label: "Contribution",
      format: (v: number, c: any) =>
        `$${v}/${c.frequency === "monthly" ? "mo" : c.frequency === "biweekly" ? "2wk" : "wk"}`,
    },
    { key: "totalPool", label: "Pool Size", format: (v: number) => `$${v.toLocaleString()}` },
    { key: "frequency", label: "Frequency", format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1) },
    { key: "members", label: "Members", format: (v: number, c: any) => `${v}/${c.maxMembers}` },
    { key: "minScore", label: "Min Score", format: (v: number) => v },
    { key: "avgScore", label: "Avg Score", format: (v: number) => v },
    { key: "successRate", label: "Success Rate", format: (v: number) => `${v}%` },
    { key: "nextPayout", label: "Next Payout", format: (v: string) => v },
    { key: "elder", label: "Elder", format: (v: string) => v },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "120px",
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
            }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: "0 0 2px 0", fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>
              Compare Circles
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              {selectedCircles.length} of {maxCompare} circles selected
            </p>
          </div>
        </div>
      </div>

      {/* Circle Headers */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "16px 20px",
          overflowX: "auto",
        }}
      >
        {selectedCircles.map((circle) => {
          const typeColor = getTypeColor(circle.type)
          const isRecommended = recommended?.id === circle.id

          return (
            <div
              key={circle.id}
              style={{
                minWidth: "140px",
                flex: 1,
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "14px",
                border: isRecommended ? "2px solid #00C6AE" : "1px solid #E0E0E0",
                position: "relative",
              }}
            >
              {/* Remove Button */}
              <button
                onClick={() => console.log("Remove circle")}
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  background: "#F5F7FA",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} color="#666" />
              </button>

              {/* Recommended Badge */}
              {isRecommended && (
                <div
                  style={{
                    position: "absolute",
                    top: "-10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#00C6AE",
                    color: "#FFFFFF",
                    padding: "4px 10px",
                    borderRadius: "10px",
                    fontSize: "10px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Sparkles size={10} />
                  BEST FIT
                </div>
              )}

              {/* Type Badge */}
              <span
                style={{
                  display: "inline-block",
                  background: typeColor.bg,
                  color: typeColor.text,
                  padding: "3px 8px",
                  borderRadius: "8px",
                  fontSize: "10px",
                  fontWeight: "600",
                  textTransform: "capitalize",
                  marginBottom: "8px",
                }}
              >
                {circle.type}
              </span>

              {/* Name */}
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#0A2342",
                  paddingRight: "20px",
                  lineHeight: "1.3",
                }}
              >
                {circle.name}
              </h3>

              {/* Verified */}
              {circle.verified && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginTop: "4px",
                  }}
                >
                  <Star size={10} color="#00C6AE" fill="#00C6AE" />
                  <span style={{ fontSize: "10px", color: "#00C6AE", fontWeight: "600" }}>Verified</span>
                </div>
              )}
            </div>
          )
        })}

        {/* Add Circle Button */}
        {selectedCircles.length < maxCompare && (
          <button
            onClick={() => console.log("Add circle")}
            style={{
              minWidth: "100px",
              background: "#FFFFFF",
              border: "2px dashed #E0E0E0",
              borderRadius: "14px",
              padding: "20px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Plus size={24} color="#999" />
            <span style={{ fontSize: "12px", color: "#999", fontWeight: "600" }}>Add Circle</span>
          </button>
        )}
      </div>

      {/* Comparison Table */}
      <div style={{ padding: "0 20px" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid #E0E0E0",
          }}
        >
          {comparisonMetrics.map((metric, idx) => (
            <div
              key={metric.key}
              style={{
                display: "flex",
                borderBottom: idx < comparisonMetrics.length - 1 ? "1px solid #F5F7FA" : "none",
              }}
            >
              {/* Metric Label */}
              <div
                style={{
                  width: "100px",
                  padding: "14px 12px",
                  background: "#F5F7FA",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#666",
                  flexShrink: 0,
                }}
              >
                {metric.label}
              </div>

              {/* Values */}
              {selectedCircles.map((circle) => {
                const value = (circle as any)[metric.key]
                const isBest =
                  ["contribution", "totalPool", "successRate", "avgScore", "minScore"].includes(metric.key) &&
                  isBestValue(circle, metric.key, value)

                return (
                  <div
                    key={circle.id}
                    style={{
                      flex: 1,
                      padding: "14px 8px",
                      fontSize: "13px",
                      fontWeight: isBest ? "700" : "500",
                      color: isBest ? "#00C6AE" : "#0A2342",
                      textAlign: "center",
                      background: isBest ? "#F0FDFB" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    {metric.format(value, circle)}
                    {isBest && <CheckCircle size={12} color="#00C6AE" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Pros & Cons */}
      <div style={{ padding: "20px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>Pros & Cons</h3>

        <div
          style={{
            display: "flex",
            gap: "12px",
            overflowX: "auto",
            paddingBottom: "8px",
          }}
        >
          {selectedCircles.map((circle) => (
            <div
              key={circle.id}
              style={{
                minWidth: "200px",
                flex: 1,
                background: "#FFFFFF",
                borderRadius: "14px",
                padding: "14px",
                border: "1px solid #E0E0E0",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0A2342",
                }}
              >
                {circle.name}
              </p>

              {/* Pros */}
              <div style={{ marginBottom: "12px" }}>
                {circle.pros.map((pro, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <CheckCircle size={12} color="#00C6AE" />
                    <span style={{ fontSize: "12px", color: "#444" }}>{pro}</span>
                  </div>
                ))}
              </div>

              {/* Cons */}
              <div>
                {circle.cons.map((con, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <XCircle size={12} color="#EF4444" />
                    <span style={{ fontSize: "12px", color: "#444" }}>{con}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Eligibility Check */}
      <div style={{ padding: "0 20px 20px 20px" }}>
        <div
          style={{
            background: "#F0FDFB",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <TrendingUp size={20} color="#00897B" />
          <div>
            <p style={{ margin: 0, fontSize: "13px", color: "#1E3A8A" }}>
              Your XnScore: <strong>{userXnScore}</strong> — You qualify for{" "}
              {selectedCircles.filter((c) => canJoin(c)).length} of {selectedCircles.length} circles
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
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
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
          }}
        >
          {selectedCircles.map((circle) => {
            const eligible = canJoin(circle)
            const spotsLeft = circle.maxMembers - circle.members

            return (
              <button
                key={circle.id}
                onClick={() => console.log(eligible ? "Join circle" : "View details")}
                style={{
                  flex: 1,
                  minWidth: "100px",
                  padding: "14px 12px",
                  borderRadius: "12px",
                  border: "none",
                  background: eligible ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#F5F7FA",
                  color: eligible ? "#FFFFFF" : "#666",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span style={{ fontSize: "11px", opacity: 0.8 }}>{circle.name.split(" ").slice(0, 2).join(" ")}</span>
                {spotsLeft > 0 ? (eligible ? "Join" : `Need ${circle.minScore} Score`) : "Full"}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
