"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Home,
  Briefcase,
  Heart,
  GraduationCap,
  Car,
  Plane,
  PiggyBank,
  Globe,
  Check,
  Stethoscope,
  Building2,
  Hammer,
  Gem,
  Users,
  Scale,
  Plus,
  Sparkles,
} from "lucide-react"

// Brand Colors
const colors = {
  primaryNavy: "#0A2342",
  accentTeal: "#00C6AE",
  warningAmber: "#D97706",
  background: "#F5F7FA",
  cards: "#FFFFFF",
  borders: "#E5E7EB",
  textSecondary: "#6B7280",
}

export default function GoalSelectionScreen() {
  const [selectedGoals, setSelectedGoals] = useState([])
  const [showOtherInput, setShowOtherInput] = useState(false)
  const [customGoal, setCustomGoal] = useState("")
  const [customGoals, setCustomGoals] = useState([])

  // DIASPORA-FOCUSED GOALS
  const goalCategories = [
    {
      title: "Family & Home",
      goals: [
        { id: "home", label: "Buy a Home", icon: Home, popular: true },
        { id: "family_support", label: "Family Support Back Home", icon: Globe, popular: true },
        { id: "wedding", label: "Wedding / Celebration", icon: Heart },
        { id: "home_improvement", label: "Home Renovation", icon: Hammer },
      ],
    },
    {
      title: "Education & Career",
      goals: [
        { id: "education", label: "Education / School Fees", icon: GraduationCap, popular: true },
        { id: "certification", label: "Professional Certification", icon: Briefcase },
        { id: "business", label: "Start a Business", icon: Building2 },
      ],
    },
    {
      title: "Health & Security",
      goals: [
        { id: "medical", label: "Medical / Dental", icon: Stethoscope },
        { id: "emergency", label: "Emergency Fund", icon: PiggyBank, popular: true },
        { id: "legal", label: "Legal / Immigration", icon: Scale },
      ],
    },
    {
      title: "Lifestyle & Dreams",
      goals: [
        { id: "car", label: "Car Purchase", icon: Car },
        { id: "travel", label: "Travel / Vacation", icon: Plane },
        { id: "luxury", label: "Jewelry / Luxury Item", icon: Gem },
        { id: "community", label: "Community Project", icon: Users },
      ],
    },
  ]

  const toggleGoal = (goalId) => {
    if (selectedGoals.includes(goalId)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goalId))
    } else {
      setSelectedGoals([...selectedGoals, goalId])
    }
  }

  const addCustomGoal = () => {
    if (customGoal.trim()) {
      const newCustomGoal = {
        id: `custom_${Date.now()}`,
        label: customGoal.trim(),
        isCustom: true,
      }
      setCustomGoals([...customGoals, newCustomGoal])
      setSelectedGoals([...selectedGoals, newCustomGoal.id])
      setCustomGoal("")
      setShowOtherInput(false)
    }
  }

  const removeCustomGoal = (goalId) => {
    setCustomGoals(customGoals.filter((g) => g.id !== goalId))
    setSelectedGoals(selectedGoals.filter((g) => g !== goalId))
  }

  const handleContinue = () => {
    if (selectedGoals.length > 0) {
      const selectedWithLabels = selectedGoals.map((id) => {
        const customG = customGoals.find((g) => g.id === id)
        if (customG) return { id, label: customG.label, isCustom: true }

        for (const cat of goalCategories) {
          const found = cat.goals.find((g) => g.id === id)
          if (found) return { id, label: found.label, isCustom: false }
        }
        return { id, label: id, isCustom: false }
      })

      console.log("Selected goals:", selectedWithLabels)
    }
  }

  const totalSelected = selectedGoals.length

  return (
    <div
      style={{
        background: colors.background,
        minHeight: "100vh",
        paddingBottom: "100px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: colors.primaryNavy,
          padding: "0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Status Bar Spacer */}
        <div style={{ height: "44px", background: colors.primaryNavy }} />

        {/* Navigation Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
          }}
        >
          <button
            onClick={() => console.log("Back")}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "10px",
              width: "40px",
              height: "40px",
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </button>

          {/* Progress Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              Step 5 of 8
            </span>
          </div>

          {/* Spacer for alignment */}
          <div style={{ width: "40px" }} />
        </div>

        {/* Progress Bar */}
        <div
          style={{
            padding: "0 20px 16px 20px",
          }}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "4px",
              height: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: colors.accentTeal,
                height: "100%",
                width: "62.5%",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Title Section */}
        <div
          style={{
            padding: "8px 20px 24px 20px",
          }}
        >
          <h1
            style={{
              color: "#FFFFFF",
              fontSize: "26px",
              fontWeight: "700",
              margin: "0 0 8px 0",
              lineHeight: "1.2",
            }}
          >
            What Are You Saving For?
          </h1>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              margin: 0,
              fontSize: "15px",
              lineHeight: "1.5",
            }}
          >
            Select all that apply. This helps us match you with the right circles.
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Goal Categories */}
        {goalCategories.map((category, catIdx) => (
          <div key={catIdx} style={{ marginBottom: "24px" }}>
            <h3
              style={{
                color: colors.primaryNavy,
                fontSize: "13px",
                fontWeight: "600",
                margin: "0 0 12px 0",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {category.title}
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              {category.goals.map((goal) => {
                const Icon = goal.icon
                const isSelected = selectedGoals.includes(goal.id)

                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    style={{
                      background: isSelected ? colors.primaryNavy : colors.cards,
                      color: isSelected ? "#FFFFFF" : colors.primaryNavy,
                      border: isSelected ? `2px solid ${colors.accentTeal}` : `1px solid ${colors.borders}`,
                      borderRadius: "14px",
                      padding: "16px 12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                      transition: "all 0.2s ease",
                      position: "relative",
                    }}
                  >
                    {/* Popular Badge */}
                    {goal.popular && !isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          background: colors.accentTeal,
                          color: "#FFFFFF",
                          fontSize: "9px",
                          fontWeight: "700",
                          padding: "3px 6px",
                          borderRadius: "8px",
                          textTransform: "uppercase",
                        }}
                      >
                        Popular
                      </div>
                    )}

                    {/* Selection Checkmark */}
                    {isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          background: colors.accentTeal,
                          borderRadius: "50%",
                          width: "18px",
                          height: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={10} color="#FFFFFF" />
                      </div>
                    )}

                    <Icon size={22} color={isSelected ? colors.accentTeal : colors.primaryNavy} />

                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        textAlign: "center",
                        lineHeight: "1.3",
                      }}
                    >
                      {goal.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Custom Goals Section */}
        {customGoals.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h3
              style={{
                color: colors.primaryNavy,
                fontSize: "13px",
                fontWeight: "600",
                margin: "0 0 12px 0",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Your Custom Goals
            </h3>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {customGoals.map((goal) => (
                <div
                  key={goal.id}
                  style={{
                    background: colors.primaryNavy,
                    color: "#FFFFFF",
                    padding: "10px 16px",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: "500",
                  }}
                >
                  <Sparkles size={14} color={colors.accentTeal} />
                  {goal.label}
                  <button
                    onClick={() => removeCustomGoal(goal.id)}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      border: "none",
                      borderRadius: "50%",
                      width: "18px",
                      height: "18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      marginLeft: "4px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OTHER / CUSTOM GOAL INPUT */}
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              color: colors.primaryNavy,
              fontSize: "13px",
              fontWeight: "600",
              margin: "0 0 12px 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Other Goal
          </h3>

          {!showOtherInput ? (
            <button
              onClick={() => setShowOtherInput(true)}
              style={{
                width: "100%",
                background: colors.cards,
                border: `2px dashed ${colors.accentTeal}`,
                borderRadius: "14px",
                padding: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                color: colors.accentTeal,
                fontWeight: "600",
                fontSize: "14px",
              }}
            >
              <Plus size={20} />
              Add Your Own Goal
            </button>
          ) : (
            <div
              style={{
                background: colors.cards,
                borderRadius: "14px",
                padding: "16px",
                border: `1px solid ${colors.borders}`,
              }}
            >
              <input
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Enter your savings goal..."
                style={{
                  width: "100%",
                  border: `1px solid ${colors.borders}`,
                  borderRadius: "10px",
                  padding: "14px",
                  fontSize: "16px",
                  marginBottom: "12px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
                autoFocus
              />
              <p
                style={{
                  color: colors.textSecondary,
                  fontSize: "12px",
                  margin: "0 0 12px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={14} color={colors.accentTeal} />
                We'll automatically categorize your goal
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setShowOtherInput(false)}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: `1px solid ${colors.borders}`,
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    color: colors.textSecondary,
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addCustomGoal}
                  disabled={!customGoal.trim()}
                  style={{
                    flex: 1,
                    background: customGoal.trim() ? colors.accentTeal : colors.borders,
                    color: customGoal.trim() ? "#FFFFFF" : colors.textSecondary,
                    border: "none",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: customGoal.trim() ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  Add Goal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: colors.cards,
          padding: "16px 20px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          borderTop: `1px solid ${colors.borders}`,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={handleContinue}
          disabled={totalSelected === 0}
          style={{
            width: "100%",
            background:
              totalSelected > 0 ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)` : colors.borders,
            color: totalSelected > 0 ? "#FFFFFF" : colors.textSecondary,
            border: "none",
            borderRadius: "14px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: totalSelected > 0 ? "pointer" : "not-allowed",
            boxShadow: totalSelected > 0 ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
            fontFamily: "inherit",
          }}
        >
          Continue with {totalSelected} goal{totalSelected !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  )
}
