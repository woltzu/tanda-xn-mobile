"use client"

import { useState } from "react"

export default function CreateCommunity() {
  const [communityName, setCommunityName] = useState("")
  const [communityType, setCommunityType] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState("")
  const [isSubCommunity, setIsSubCommunity] = useState(false)
  const [parentCommunity, setParentCommunity] = useState<any>(null)
  const [privacy, setPrivacy] = useState("public")
  const [showIconPicker, setShowIconPicker] = useState(false)

  const existingCommunities = [
    { id: "c1", name: "Ivorian in USA", icon: "🇨🇮", type: "diaspora" },
    { id: "c2", name: "Ivorian in Georgia", icon: "🇨🇮", type: "diaspora", parent: "c1" },
    { id: "c3", name: "African Diaspora USA", icon: "🌍", type: "diaspora" },
    { id: "c4", name: "Atlanta Faith Community", icon: "🙏", type: "religious" },
  ]

  const communityTypes = [
    {
      id: "diaspora",
      label: "Diaspora / Nationality",
      icon: "✈️",
      description: "Connect with people from your home country",
    },
    {
      id: "religious",
      label: "Faith / Religious",
      icon: "🙏",
      description: "Share beliefs and support each other",
    },
    {
      id: "professional",
      label: "Professional / Industry",
      icon: "💼",
      description: "Network with colleagues and peers",
    },
    {
      id: "neighborhood",
      label: "Local / Neighborhood",
      icon: "🏘️",
      description: "Connect with neighbors and locals",
    },
    { id: "school", label: "School / Alumni", icon: "🎓", description: "Stay connected with classmates" },
    { id: "interest", label: "Interest / Hobby", icon: "⭐", description: "Bond over shared interests" },
  ]

  const iconOptions = [
    "🇨🇮",
    "🇳🇬",
    "🇬🇭",
    "🇰🇪",
    "🇮🇳",
    "🇵🇭",
    "🇲🇽",
    "🇯🇲",
    "⛪",
    "🕌",
    "🕍",
    "🛕",
    "🙏",
    "✝️",
    "☪️",
    "✡️",
    "💼",
    "👩‍💻",
    "👨‍⚕️",
    "👩‍🍳",
    "👨‍🏫",
    "👷",
    "🏢",
    "📊",
    "🏘️",
    "🏠",
    "🌆",
    "🏙️",
    "🌳",
    "🏖️",
    "⛰️",
    "🌾",
    "🎓",
    "📚",
    "🏫",
    "🎒",
    "✏️",
    "🔬",
    "🎨",
    "🎵",
    "⚽",
    "🏀",
    "🎮",
    "🎯",
    "🎭",
    "🎪",
    "🧘",
    "💪",
  ]

  const canCreate = communityName.length >= 3 && communityType && icon && (!isSubCommunity || parentCommunity)

  const handleCreate = () => {
    console.log("Creating community:", {
      name: communityName,
      type: communityType,
      icon,
      description,
      privacy,
      parentId: isSubCommunity ? parentCommunity?.id : null,
    })
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
              cursor: "pointer",
              padding: "8px",
              display: "flex",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Create Community</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Build your savings community
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Sub-community Toggle */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => setIsSubCommunity(!isSubCommunity)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: isSubCommunity ? "#F0FDFB" : "#F5F7FA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "20px" }}>🔗</span>
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                  Create as sub-community
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                  Nest under an existing community
                </p>
              </div>
            </div>

            {/* Toggle */}
            <div
              style={{
                width: "50px",
                height: "28px",
                borderRadius: "14px",
                background: isSubCommunity ? "#00C6AE" : "#E5E7EB",
                padding: "2px",
                transition: "background 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  transform: isSubCommunity ? "translateX(22px)" : "translateX(0)",
                  transition: "transform 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              />
            </div>
          </button>

          {/* Parent Community Selection */}
          {isSubCommunity && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #E5E7EB" }}>
              <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                Select parent community
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {existingCommunities
                  .filter((c) => !c.parent)
                  .map((comm) => (
                    <button
                      key={comm.id}
                      onClick={() => setParentCommunity(comm)}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        border: parentCommunity?.id === comm.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                        background: parentCommunity?.id === comm.id ? "#F0FDFB" : "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "24px" }}>{comm.icon}</span>
                      <span style={{ fontSize: "14px", fontWeight: "500", color: "#0A2342" }}>{comm.name}</span>
                      {parentCommunity?.id === comm.id && (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#00C6AE"
                          strokeWidth="3"
                          style={{ marginLeft: "auto" }}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Community Name & Icon */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
            Community Details
          </h3>

          {/* Icon Selection */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A2342",
                marginBottom: "8px",
              }}
            >
              Community Icon
            </label>
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "16px",
                border: "2px dashed #E5E7EB",
                background: icon ? "#F0FDFB" : "#F5F7FA",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: icon ? "40px" : "24px",
              }}
            >
              {icon || "➕"}
            </button>

            {showIconPicker && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "#F5F7FA",
                  borderRadius: "12px",
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: "8px",
                }}
              >
                {iconOptions.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setIcon(emoji)
                      setShowIconPicker(false)
                    }}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "8px",
                      border: icon === emoji ? "2px solid #00C6AE" : "none",
                      background: icon === emoji ? "#F0FDFB" : "transparent",
                      cursor: "pointer",
                      fontSize: "20px",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name Input */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A2342",
                marginBottom: "6px",
              }}
            >
              Community Name
            </label>
            <input
              type="text"
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                fontSize: "16px",
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder={
                isSubCommunity && parentCommunity
                  ? `e.g., ${parentCommunity.name.split(" ")[0]} in Atlanta`
                  : "e.g., Ivorian in Atlanta"
              }
            />
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0A2342",
                marginBottom: "6px",
              }}
            >
              Description <span style={{ fontWeight: "400", color: "#6B7280" }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid #E5E7EB",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
                minHeight: "80px",
                resize: "none",
              }}
              placeholder="What is this community about?"
            />
          </div>
        </div>

        {/* Community Type */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "16px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
            Community Type
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {communityTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setCommunityType(type.id)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: communityType === type.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: communityType === type.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "24px" }}>{type.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{type.label}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>{type.description}</p>
                </div>
                {communityType === type.id && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C6AE" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "20px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>Privacy</h3>

          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { id: "public", label: "Public", icon: "🌍", desc: "Anyone can discover and join" },
              { id: "private", label: "Private", icon: "🔒", desc: "Invite only, hidden from search" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPrivacy(opt.id)}
                style={{
                  flex: 1,
                  padding: "16px",
                  borderRadius: "12px",
                  border: privacy === opt.id ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  background: privacy === opt.id ? "#F0FDFB" : "#FFFFFF",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "28px", display: "block", marginBottom: "8px" }}>{opt.icon}</span>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>{opt.label}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6B7280" }}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          padding: "16px 20px 32px 20px",
          borderTop: "1px solid #E5E7EB",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: canCreate ? "linear-gradient(135deg, #00C6AE 0%, #00A896 100%)" : "#E5E7EB",
            color: canCreate ? "#FFFFFF" : "#9CA3AF",
            fontSize: "16px",
            fontWeight: "700",
            cursor: canCreate ? "pointer" : "not-allowed",
          }}
        >
          Create Community
        </button>
      </div>
    </div>
  )
}
