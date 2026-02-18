"use client"

import type React from "react"

import { useState, useRef } from "react"
import { ArrowLeft, FileText, Check, Shield, ChevronDown } from "lucide-react"

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

export default function TermsScreen() {
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Track if user has scrolled to bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setHasScrolledToBottom(true)
    }
  }

  const handleBack = () => {
    console.log("Back to profile setup")
  }

  const handleAccept = () => {
    if (agreedTerms && agreedPrivacy) {
      console.log("Terms accepted - proceeding to onboarding complete!")
    }
  }

  const canAccept = agreedTerms && agreedPrivacy

  const termsContent = [
    {
      title: "1. Acceptance of Terms",
      content:
        "By accessing or using TandaXn, you agree to be bound by these Terms of Service. If you do not agree, do not use our services.",
    },
    {
      title: "2. Service Description",
      content:
        "TandaXn provides a platform for rotating savings groups (tandas/ROSCAs), peer-to-peer financial collaboration, and goal-based savings tracking. We facilitate payments but do not guarantee member behavior.",
    },
    {
      title: "3. User Responsibilities",
      content:
        "Users are responsible for making timely contributions, maintaining accurate information, and communicating with group members. Failure to meet obligations may result in account restrictions and impact your XnScore.",
    },
    {
      title: "4. Fees and Payments",
      content:
        "TandaXn charges platform fees for transactions. All fees are disclosed before transactions are processed. Users are responsible for any bank fees from their financial institutions.",
    },
    {
      title: "5. Risk Disclaimer",
      content:
        "Rotating savings groups involve financial risk. TandaXn does not guarantee payments unless explicitly stated. Users participate at their own risk. We encourage users to only join groups with trusted members.",
    },
    {
      title: "6. XnScore System",
      content:
        "Your XnScore reflects your reliability in the TandaXn community. It is calculated based on on-time payments, participation history, and community standing. A higher score unlocks better opportunities.",
    },
    {
      title: "7. Privacy and Data",
      content:
        "We collect and process personal data as described in our Privacy Policy. By using TandaXn, you consent to such processing. We implement industry-standard security measures to protect your information.",
    },
    {
      title: "8. Dispute Resolution",
      content:
        "Disputes between members should first be addressed through our Elder mediation system. Unresolved disputes may be escalated to binding arbitration. We are not liable for losses arising from member disputes.",
    },
  ]

  return (
    <div
      style={{
        background: colors.background,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header - Navy with proper styling */}
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
            onClick={handleBack}
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

          {/* Step Indicator */}
          <span
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            Step 8 of 8
          </span>

          {/* Spacer for alignment */}
          <div style={{ width: "40px" }} />
        </div>

        {/* Progress Bar - 100% Complete! */}
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
                width: "100%" /* 8/8 = 100% */,
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={20} color="#FFFFFF" />
            </div>
            <h1
              style={{
                color: "#FFFFFF",
                fontSize: "24px",
                fontWeight: "700",
                margin: 0,
                lineHeight: "1.2",
              }}
            >
              Terms of Service
            </h1>
          </div>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              margin: 0,
              fontSize: "15px",
              lineHeight: "1.5",
            }}
          >
            Please read and accept our terms to continue
          </p>
        </div>
      </div>

      {/* Scrollable Terms Content */}
      <div
        style={{
          flex: 1,
          padding: "20px",
          paddingBottom: "200px",
        }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            background: colors.cards,
            borderRadius: "16px",
            padding: "20px",
            border: `1px solid ${colors.borders}`,
            maxHeight: "calc(100vh - 420px)",
            overflow: "auto",
          }}
        >
          <p
            style={{
              margin: "0 0 20px 0",
              fontSize: "12px",
              color: colors.textSecondary,
              fontStyle: "italic",
            }}
          >
            Last Updated: January 1, 2026
          </p>

          {termsContent.map((section, idx) => (
            <div key={idx} style={{ marginBottom: "20px" }}>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "15px",
                  color: colors.primaryNavy,
                  fontWeight: "600",
                }}
              >
                {section.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: colors.textSecondary,
                  lineHeight: "1.6",
                }}
              >
                {section.content}
              </p>
            </div>
          ))}

          {/* Scroll indicator */}
          {!hasScrolledToBottom && (
            <div
              style={{
                textAlign: "center",
                padding: "12px",
                color: colors.accentTeal,
                fontSize: "12px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <ChevronDown size={16} />
              Scroll to read all terms
            </div>
          )}
        </div>

        {/* Agreement Checkboxes */}
        <div
          style={{
            marginTop: "20px",
            background: colors.cards,
            borderRadius: "16px",
            padding: "16px",
            border: `1px solid ${colors.borders}`,
          }}
        >
          {/* Terms Checkbox */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              cursor: "pointer",
              marginBottom: "16px",
            }}
          >
            <div
              onClick={() => setAgreedTerms(!agreedTerms)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "8px",
                border: agreedTerms ? "none" : `2px solid ${colors.borders}`,
                background: agreedTerms ? colors.accentTeal : colors.cards,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              {agreedTerms && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </div>
            <span
              style={{
                fontSize: "14px",
                color: colors.primaryNavy,
                lineHeight: "1.5",
              }}
            >
              I have read and agree to the{" "}
              <span style={{ color: colors.accentTeal, fontWeight: "600" }}>Terms of Service</span>
            </span>
          </label>

          {/* Privacy Checkbox */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <div
              onClick={() => setAgreedPrivacy(!agreedPrivacy)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "8px",
                border: agreedPrivacy ? "none" : `2px solid ${colors.borders}`,
                background: agreedPrivacy ? colors.accentTeal : colors.cards,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              {agreedPrivacy && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </div>
            <span
              style={{
                fontSize: "14px",
                color: colors.primaryNavy,
                lineHeight: "1.5",
              }}
            >
              I consent to the <span style={{ color: colors.accentTeal, fontWeight: "600" }}>Privacy Policy</span> and
              data processing
            </span>
          </label>
        </div>

        {/* Security Note */}
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <Shield size={14} color={colors.textSecondary} />
          <p
            style={{
              fontSize: "12px",
              color: colors.textSecondary,
              margin: 0,
            }}
          >
            Your data is protected with bank-level encryption
          </p>
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
          onClick={handleAccept}
          disabled={!canAccept}
          style={{
            width: "100%",
            background: canAccept ? `linear-gradient(135deg, ${colors.accentTeal} 0%, #00A896 100%)` : colors.borders,
            color: canAccept ? "#FFFFFF" : colors.textSecondary,
            border: "none",
            borderRadius: "14px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: canAccept ? "pointer" : "not-allowed",
            boxShadow: canAccept ? "0 8px 24px rgba(0, 198, 174, 0.3)" : "none",
            fontFamily: "inherit",
          }}
        >
          {canAccept ? "Accept & Get Started" : "Accept Terms to Continue"}
        </button>
      </div>
    </div>
  )
}
