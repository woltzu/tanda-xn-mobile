"use client"

import { useState } from "react"
import { ArrowLeft, Plus, X, TrendingUp, Star, CheckCircle, XCircle, Sparkles } from "lucide-react"
import { useCircles, type Circle } from "../../../context/CirclesContext"
import { useAuth } from "../../../context/AuthContext"
import { goBack, navigateToCircleScreen } from "./useCircleParams"

export default function CircleComparisonScreen() {
  const { browseCircles, isLoading } = useCircles()
  const { user } = useAuth()
  const [highlightMetric, setHighlightMetric] = useState<string | null>(null)

  // Seed from first 3 browseCircles; user can remove/swap
  const [selectedCircles, setSelectedCircles] = useState<Circle[]>(() =>
    browseCircles.slice(0, 3)
  )

  // Sync once browseCircles arrive (they may load after mount)
  const [seeded, setSeeded] = useState(false)
  if (!seeded && browseCircles.length > 0 && selectedCircles.length === 0) {
    setSelectedCircles(browseCircles.slice(0, 3))
    setSeeded(true)
  }

  const userXnScore = user?.xnScore ?? 72
  const maxCompare = 3

  const getTypeColor = (type: string) => {
    switch (type) {
      case "family-support":
      case "beneficiary":
        return { bg: "#F0FDFB", text: "#00897B" }
      case "traditional":
        return { bg: "#F5F7FA", text: "#0A2342" }
      case "goal-based":
      case "goal":
        return { bg: "#FEF3C7", text: "#D97706" }
      case "emergency":
        return { bg: "#FEE2E2", text: "#DC2626" }
      default:
        return { bg: "#F3F4F6", text: "#6B7280" }
    }
  }

  const getBestValue = (metric: string) => {
    if (selectedCircles.length === 0) return null
    switch (metric) {
      case "amount":
        return Math.min(...selectedCircles.map((c) => c.amount))
      case "pool":
        return Math.max(...selectedCircles.map((c) => c.amount * c.memberCount))
      case "progress":
        return Math.max(...selectedCircles.map((c) => c.progress))
      case "minScore":
        return Math.min(...selectedCircles.map((c) => c.minScore ?? 0))
      default:
        return null
    }
  }

  const isBestValue = (_circle: Circle, metric: string, value: number) => {
    const best = getBestValue(metric)
    if (best === null) return false
    return value === best
  }

  const canJoin = (circle: Circle) => {
    const spotsLeft = circle.memberCount - circle.currentMembers
    return userXnScore >= (circle.minScore ?? 0) && spotsLeft > 0
  }

  const removeCircle = (circleId: string) => {
    setSelectedCircles((prev) => prev.filter((c) => c.id !== circleId))
  }

  const addCircle = () => {
    // Find first browse circle not already selected
    const available = browseCircles.filter(
      (bc) => !selectedCircles.find((sc) => sc.id === bc.id)
    )
    if (available.length > 0) {
      setSelectedCircles((prev) => [...prev, available[0]])
    }
  }

  // Find recommended circle based on user profile
  const getRecommendation = () => {
    const eligible = selectedCircles.filter((c) => canJoin(c))
    if (eligible.length === 0) return null

    const scored = eligible.map((c) => ({
      ...c,
      score: c.progress + (c.minScore ?? 0) - c.amount / 10,
    }))

    return scored.sort((a, b) => b.score - a.score)[0]
  }

  const recommended = getRecommendation()

  type CompMetric = {
    key: string
    label: string
    format: (v: any, c: Circle) => string | number
  }

  const comparisonMetrics: CompMetric[] = [
    {
      key: "amount",
      label: "Contribution",
      format: (v: number, c: Circle) =>
        `$${v}/${c.frequency === "monthly" ? "mo" : c.frequency === "biweekly" ? "2wk" : c.frequency === "weekly" ? "wk" : c.frequency}`,
    },
    { key: "pool", label: "Pool Size", format: (_v: any, c: Circle) => `$${(c.amount * c.memberCount).toLocaleString()}` },
    { key: "frequency", label: "Frequency", format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1) },
    { key: "members", label: "Members", format: (_v: any, c: Circle) => `${c.currentMembers}/${c.memberCount}` },
    { key: "minScore", label: "Min Score", format: (_v: any, c: Circle) => c.minScore ?? "N/A" },
    { key: "progress", label: "Progress", format: (v: number) => `${v}%` },
    { key: "rotationMethod", label: "Rotation", format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1) },
  ]

  const getMetricValue = (circle: Circle, key: string): any => {
    switch (key) {
      case "amount":
        return circle.amount
      case "pool":
        return circle.amount * circle.memberCount
      case "frequency":
        return circle.frequency
      case "members":
        return circle.currentMembers
      case "minScore":
        return circle.minScore ?? 0
      case "progress":
        return circle.progress
      case "rotationMethod":
        return circle.rotationMethod
      default:
        return ""
    }
  }

  if (isLoading) {
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
        <p style={{ color: "#666", fontSize: "16px" }}>Loading circles...</p>
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
            onClick={() => goBack()}
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
                onClick={() => removeCircle(circle.id)}
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
            onClick={addCircle}
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
      {selectedCircles.length > 0 && (
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
                  const value = getMetricValue(circle, metric.key)
                  const isBest =
                    ["amount", "pool", "progress", "minScore"].includes(metric.key) &&
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
      )}

      {/* Eligibility Check */}
      <div style={{ padding: "20px" }}>
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
            const spotsLeft = circle.memberCount - circle.currentMembers

            return (
              <button
                key={circle.id}
                onClick={() =>
                  eligible
                    ? navigateToCircleScreen("CIRC-105 Circle Rules & Terms", { circleId: circle.id })
                    : navigateToCircleScreen("CIRC-102 Circle Detail", { circleId: circle.id })
                }
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
                {spotsLeft > 0 ? (eligible ? "Join" : `Need ${circle.minScore ?? 0} Score`) : "Full"}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
