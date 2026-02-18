"use client"

import { useState } from "react"
import { Users, TrendingUp, Target, ArrowRight } from "lucide-react"

export default function WelcomeScreen() {
  const [carouselIndex, setCarouselIndex] = useState(0)

  const carouselSlides = [
    {
      title: "Save Together",
      description: "Join rotating savings groups and reach your financial goals faster with community support.",
      icon: <Users size={80} color="#00C6AE" />,
    },
    {
      title: "Build Your XnScore™",
      description: "Your in-app credit score that unlocks better rates and trusted partnerships.",
      icon: <TrendingUp size={80} color="#00C6AE" />,
    },
    {
      title: "Achieve Your Goals",
      description: "Whether it's a home, business, or dream vacation - we help you get there.",
      icon: <Target size={80} color="#00C6AE" />,
    },
  ]

  const handleNext = () => {
    if (carouselIndex < carouselSlides.length - 1) {
      setCarouselIndex(carouselIndex + 1)
    } else {
      console.log("Create Account clicked")
      // TODO: Navigate to SignUp screen
    }
  }

  const handleBack = () => {
    if (carouselIndex > 0) {
      setCarouselIndex(carouselIndex - 1)
    }
  }

  return (
    <div
      style={{
        background: "#F5F7FA",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "40px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: "center",
          maxWidth: "400px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Icon */}
        <div style={{ marginBottom: "40px" }}>{carouselSlides[carouselIndex].icon}</div>

        {/* Title */}
        <h2
          style={{
            color: "#0A2342",
            fontSize: "28px",
            fontWeight: "700",
            margin: "0 0 16px 0",
          }}
        >
          {carouselSlides[carouselIndex].title}
        </h2>

        {/* Description */}
        <p
          style={{
            color: "#666",
            fontSize: "16px",
            margin: "0 0 40px 0",
            lineHeight: "1.6",
          }}
        >
          {carouselSlides[carouselIndex].description}
        </p>

        {/* Dot Indicators */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "40px",
          }}
        >
          {carouselSlides.map((_, idx) => (
            <div
              key={idx}
              onClick={() => setCarouselIndex(idx)}
              style={{
                width: idx === carouselIndex ? "24px" : "8px",
                height: "8px",
                borderRadius: "4px",
                background: idx === carouselIndex ? "#00C6AE" : "#E0E0E0",
                transition: "all 0.3s ease",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          maxWidth: "400px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {carouselIndex > 0 && (
          <button
            onClick={handleBack}
            style={{
              flex: 1,
              background: "transparent",
              color: "#0A2342",
              border: "2px solid #0A2342",
              borderRadius: "12px",
              padding: "14px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Back
          </button>
        )}

        <button
          onClick={handleNext}
          style={{
            flex: 1,
            background: "#00C6AE",
            color: "#FFFFFF",
            border: "none",
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
          {carouselIndex < carouselSlides.length - 1 ? "Next" : "Create Account"}
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}
