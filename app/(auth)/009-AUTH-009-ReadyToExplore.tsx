"use client"

import { useState, useEffect } from "react"
import { Check, Users, Target, TrendingUp, ArrowRight, Sparkles } from "lucide-react"

export default function ReadyToExploreScreen() {
  const userName = "Marcus"
  const [showContent, setShowContent] = useState(false)
  const [confettiActive, setConfettiActive] = useState(true)

  useEffect(() => {
    // Stagger content appearance
    setTimeout(() => setShowContent(true), 500)
    // Stop confetti after 3 seconds
    setTimeout(() => setConfettiActive(false), 3000)
  }, [])

  const handleExplore = () => {
    console.log("Explore TandaXn")
  }

  const handleBrowseCircles = () => {
    console.log("Browse Circles")
  }

  const nextSteps = [
    {
      icon: Users,
      title: "Browse Circles",
      description: "Explore savings groups that match your goals",
      action: "No verification needed",
    },
    {
      icon: Target,
      title: "Track Your Goals",
      description: "Set milestones and watch your progress",
      action: "Start anytime",
    },
    {
      icon: TrendingUp,
      title: "Build Your XnScore",
      description: "Your financial reputation grows with activity",
      action: "Starts at 0",
    },
  ]

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0A2342 0%, #0A2342 40%, #F5F7FA 40%)",
        minHeight: "100vh",
        padding: "40px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Confetti Animation */}
      {confettiActive && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none" }}>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: "10px",
                height: "10px",
                background: ["#00C6AE", "#FFFFFF", "#FFD700", "#FF6B35"][i % 4],
                borderRadius: i % 2 === 0 ? "50%" : "2px",
                left: `${Math.random() * 100}%`,
                animation: `confetti ${2 + Math.random()}s ease-out forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Success Badge */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "32px",
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s ease",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            background: "#00C6AE",
            borderRadius: "50%",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 40px rgba(0, 198, 174, 0.4)",
          }}
        >
          <Check size={40} color="#FFFFFF" strokeWidth={3} />
        </div>

        <h1
          style={{
            color: "#FFFFFF",
            fontSize: "28px",
            fontWeight: "700",
            margin: "0 0 8px 0",
          }}
        >
          You're All Set, {userName}!
        </h1>

        <p
          style={{
            color: "rgba(255, 255, 255, 0.8)",
            fontSize: "16px",
            margin: 0,
          }}
        >
          Your TandaXn account is ready to explore
        </p>
      </div>

      {/* What You Can Do Card */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
          marginBottom: "24px",
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s ease 0.2s",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "20px",
          }}
        >
          <Sparkles size={20} color="#00C6AE" />
          <h2
            style={{
              color: "#0A2342",
              fontSize: "18px",
              fontWeight: "700",
              margin: 0,
            }}
          >
            What You Can Do Now
          </h2>
        </div>

        {nextSteps.map((step, idx) => {
          const Icon = step.icon
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: "16px",
                padding: "16px 0",
                borderBottom: idx < nextSteps.length - 1 ? "1px solid #E0E0E0" : "none",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={22} color="#00C6AE" />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    color: "#0A2342",
                    fontSize: "15px",
                    fontWeight: "600",
                    margin: "0 0 4px 0",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    color: "#666",
                    fontSize: "13px",
                    margin: "0 0 4px 0",
                  }}
                >
                  {step.description}
                </p>
                <span
                  style={{
                    color: "#00C6AE",
                    fontSize: "11px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                  }}
                >
                  {step.action}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Note about verification */}
      <div
        style={{
          background: "rgba(0, 198, 174, 0.1)",
          border: "1px solid rgba(0, 198, 174, 0.3)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "24px",
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s ease 0.3s",
        }}
      >
        <p
          style={{
            color: "#0A2342",
            fontSize: "13px",
            margin: 0,
            lineHeight: "1.5",
          }}
        >
          <strong>No verification needed to browse!</strong> We'll only ask for ID verification when you're ready to
          join a circle or make a contribution.
        </p>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s ease 0.4s",
        }}
      >
        <button
          onClick={handleExplore}
          style={{
            width: "100%",
            background: "#00C6AE",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "12px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          Explore TandaXn
          <ArrowRight size={20} />
        </button>

        <button
          onClick={handleBrowseCircles}
          style={{
            width: "100%",
            background: "transparent",
            color: "#0A2342",
            border: "2px solid #0A2342",
            borderRadius: "12px",
            padding: "14px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Users size={20} />
          Browse Circles Now
        </button>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
