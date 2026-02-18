"use client"

import { useState } from "react"

export default function CommunityBrowser() {
  const [activeTab, setActiveTab] = useState("discover")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const user = { name: "Franck", location: "Atlanta, GA" }

  // User's current communities (can belong to multiple)
  const myCommunitites = [
    {
      id: "c1",
      name: "Ivorian in Atlanta",
      type: "diaspora",
      icon: "🇨🇮",
      members: 342,
      circles: 8,
      parent: "Ivorian in Georgia",
      role: "member",
    },
    {
      id: "c2",
      name: "Catholic Community Atlanta",
      type: "religious",
      icon: "⛪",
      members: 1250,
      circles: 15,
      parent: null,
      role: "member",
    },
    {
      id: "c3",
      name: "Black Entrepreneurs ATL",
      type: "professional",
      icon: "💼",
      members: 890,
      circles: 12,
      parent: null,
      role: "elder",
    },
  ]

  // Discoverable communities
  const discoverCommunities = [
    {
      id: "d1",
      name: "Ivorian in USA",
      type: "diaspora",
      icon: "🇨🇮",
      members: 15420,
      circles: 156,
      verified: true,
      subCommunities: [
        { name: "Ivorian in Georgia", members: 1240 },
        { name: "Ivorian in New York", members: 4520 },
        { name: "Ivorian in Texas", members: 2180 },
      ],
      description: "Connecting Ivorians across America",
    },
    {
      id: "d2",
      name: "Nigerian Diaspora USA",
      type: "diaspora",
      icon: "🇳🇬",
      members: 45200,
      circles: 423,
      verified: true,
      subCommunities: [
        { name: "Nigerians in Atlanta", members: 3200 },
        { name: "Nigerians in Houston", members: 8400 },
      ],
      description: "The largest Nigerian community platform",
    },
    {
      id: "d3",
      name: "Atlanta Faith Community",
      type: "religious",
      icon: "🙏",
      members: 8900,
      circles: 67,
      verified: true,
      subCommunities: [
        { name: "Catholic Atlanta", members: 1250 },
        { name: "Baptist Atlanta", members: 3400 },
      ],
      description: "Interfaith community savings",
    },
    {
      id: "d4",
      name: "Women in Tech ATL",
      type: "professional",
      icon: "👩‍💻",
      members: 2340,
      circles: 18,
      verified: true,
      description: "Supporting women tech professionals",
    },
    {
      id: "d5",
      name: "Ghanaian Association GA",
      type: "diaspora",
      icon: "🇬🇭",
      members: 890,
      circles: 12,
      verified: false,
      description: "Ghanaians in Georgia",
    },
  ]

  const categories = [
    { id: "all", label: "All", icon: "🌍" },
    { id: "diaspora", label: "Diaspora", icon: "✈️" },
    { id: "religious", label: "Faith", icon: "🙏" },
    { id: "professional", label: "Professional", icon: "💼" },
    { id: "neighborhood", label: "Local", icon: "🏘️" },
  ]

  const filteredCommunities = discoverCommunities.filter(
    (c) =>
      (selectedCategory === "all" || c.type === selectedCategory) &&
      (searchQuery === "" || c.name.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const tabs = [
    { id: "my", label: "My Communities", count: myCommunitites.length },
    { id: "discover", label: "Discover" },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F7FA",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "100px",
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
            marginBottom: "16px",
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Communities</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Join communities, create circles
            </p>
          </div>
          <button
            onClick={() => console.log("Create community")}
            style={{
              background: "#00C6AE",
              border: "none",
              borderRadius: "10px",
              padding: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2"
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 14px 14px 44px",
              borderRadius: "12px",
              border: "none",
              background: "#FFFFFF",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: activeTab === tab.id ? "rgba(0,198,174,0.2)" : "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {tab.label}
              {tab.count && (
                <span
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "12px",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* MY COMMUNITIES TAB */}
        {activeTab === "my" && (
          <>
            {/* Community Hierarchy Explainer */}
            <div
              style={{
                background: "#F0FDFB",
                borderRadius: "14px",
                padding: "14px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "20px" }}>💡</span>
              <div>
                <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "600", color: "#0A2342" }}>
                  You can belong to multiple communities
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                  Communities can have sub-communities. Circles belong to communities.
                </p>
              </div>
            </div>

            {/* My Communities List */}
            {myCommunitites.map((community) => (
              <button
                key={community.id}
                onClick={() => console.log("View community:", community.name)}
                style={{
                  width: "100%",
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "12px",
                  border: "1px solid #E5E7EB",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "14px",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "28px",
                    }}
                  >
                    {community.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                        {community.name}
                      </h3>
                      {community.role === "elder" && (
                        <span
                          style={{
                            background: "#FEF3C7",
                            color: "#92400E",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "10px",
                            fontWeight: "600",
                          }}
                        >
                          ELDER
                        </span>
                      )}
                    </div>

                    {community.parent && (
                      <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#6B7280" }}>
                        Part of: {community.parent}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: "16px" }}>
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>
                        👥 {community.members.toLocaleString()} members
                      </span>
                      <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "500" }}>
                        ⭕ {community.circles} circles
                      </span>
                    </div>
                  </div>

                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}

            {/* Create Community CTA */}
            <button
              onClick={() => console.log("Create new community")}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "2px dashed #E5E7EB",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginTop: "8px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#6B7280" }}>Create a new community</span>
            </button>
          </>
        )}

        {/* DISCOVER TAB */}
        {activeTab === "discover" && (
          <>
            {/* Category Filter */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "20px",
                overflowX: "auto",
                paddingBottom: "4px",
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "20px",
                    border: selectedCategory === cat.id ? "none" : "1px solid #E5E7EB",
                    background:
                      selectedCategory === cat.id ? "linear-gradient(135deg, #0A2342 0%, #143654 100%)" : "#FFFFFF",
                    color: selectedCategory === cat.id ? "#FFFFFF" : "#0A2342",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Suggested Communities */}
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
              Suggested for you
            </h3>

            {filteredCommunities.map((community) => (
              <div
                key={community.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "12px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "14px",
                      background: "#F5F7FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "28px",
                      position: "relative",
                    }}
                  >
                    {community.icon}
                    {community.verified && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "-4px",
                          right: "-4px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "#00C6AE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600", color: "#0A2342" }}>
                      {community.name}
                    </h3>
                    <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#6B7280" }}>{community.description}</p>

                    <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>
                        👥 {community.members.toLocaleString()}
                      </span>
                      <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "500" }}>
                        ⭕ {community.circles} circles
                      </span>
                    </div>

                    {/* Sub-communities preview */}
                    {community.subCommunities && community.subCommunities.length > 0 && (
                      <div
                        style={{
                          background: "#F5F7FA",
                          borderRadius: "10px",
                          padding: "10px",
                          marginBottom: "12px",
                        }}
                      >
                        <p style={{ margin: "0 0 6px 0", fontSize: "11px", fontWeight: "600", color: "#6B7280" }}>
                          INCLUDES SUB-COMMUNITIES:
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {community.subCommunities.slice(0, 3).map((sub, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: "#FFFFFF",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                color: "#0A2342",
                              }}
                            >
                              {sub.name}
                            </span>
                          ))}
                          {community.subCommunities.length > 3 && (
                            <span style={{ fontSize: "11px", color: "#6B7280" }}>
                              +{community.subCommunities.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => console.log("Join community:", community.name)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#00C6AE",
                        color: "#FFFFFF",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Join Community
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
