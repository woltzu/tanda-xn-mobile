"use client"

import { useState } from "react"

export default function ElderTrainingHubScreen() {
  const [activeTab, setActiveTab] = useState("courses")

  const elderProfile = {
    tier: "Junior",
    completedCourses: 3,
    requiredForNextTier: 5,
    credits: 75,
    creditsNeeded: 100,
  }

  const courses = [
    {
      id: "c1",
      title: "Fundamentals of Mediation",
      category: "required",
      duration: "45 min",
      credits: 15,
      status: "completed",
      badge: "🎓",
    },
    {
      id: "c2",
      title: "Cultural Competency in Diaspora Communities",
      category: "required",
      duration: "60 min",
      credits: 20,
      status: "completed",
      badge: "🌍",
    },
    {
      id: "c3",
      title: "Financial Dispute Resolution",
      category: "required",
      duration: "90 min",
      credits: 25,
      status: "completed",
      badge: "💰",
    },
    {
      id: "c4",
      title: "Advanced Mediation Techniques",
      category: "required",
      duration: "75 min",
      credits: 20,
      status: "in_progress",
      progress: 60,
      badge: "🎯",
    },
    {
      id: "c5",
      title: "Trust & Reputation Systems",
      category: "required",
      duration: "45 min",
      credits: 15,
      status: "locked",
      badge: "🔐",
    },
    {
      id: "c6",
      title: "Emergency Protocols",
      category: "elective",
      duration: "30 min",
      credits: 10,
      status: "available",
      badge: "🚨",
    },
    {
      id: "c7",
      title: "Cross-Border Regulations",
      category: "elective",
      duration: "60 min",
      credits: 15,
      status: "available",
      badge: "🌐",
    },
  ]

  const badges = [
    { id: "b1", name: "Mediator I", icon: "🎓", earned: true },
    { id: "b2", name: "Culture Expert", icon: "🌍", earned: true },
    { id: "b3", name: "Financial Specialist", icon: "💰", earned: true },
    { id: "b4", name: "Advanced Mediator", icon: "🎯", earned: false },
    { id: "b5", name: "Trust Guardian", icon: "🔐", earned: false },
  ]

  const tabs = [
    { id: "courses", label: "Courses", icon: "📚" },
    { id: "badges", label: "Badges", icon: "🏅" },
    { id: "progress", label: "Progress", icon: "📊" },
  ]

  const requiredCourses = courses.filter((c) => c.category === "required")
  const electiveCourses = courses.filter((c) => c.category === "elective")
  const progressPercent = (elderProfile.credits / elderProfile.creditsNeeded) * 100

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
          paddingBottom: "80px",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
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
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#FFFFFF" }}>Elder Academy</h1>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>
              Train to become a better Elder
            </p>
          </div>
          <div
            style={{
              background: "rgba(0,198,174,0.2)",
              padding: "6px 12px",
              borderRadius: "8px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "600" }}>👑 {elderProfile.tier} Elder</span>
          </div>
        </div>

        {/* Progress to Next Tier */}
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", opacity: 0.8 }}>Progress to Senior Elder</span>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>
              {elderProfile.credits}/{elderProfile.creditsNeeded} credits
            </span>
          </div>
          <div
            style={{
              height: "8px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "4px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                background: "#00C6AE",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      </div>

      {/* Stats Card - Overlapping */}
      <div
        style={{
          margin: "-60px 20px 20px 20px",
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 4px 20px rgba(10, 35, 66, 0.1)",
          display: "flex",
          gap: "12px",
        }}
      >
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#0A2342" }}>
            {elderProfile.completedCourses}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Completed</p>
        </div>
        <div style={{ width: "1px", background: "#E5E7EB" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#D97706" }}>
            {courses.filter((c) => c.status === "in_progress").length}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>In Progress</p>
        </div>
        <div style={{ width: "1px", background: "#E5E7EB" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#00C6AE" }}>
            {badges.filter((b) => b.earned).length}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>Badges</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "0 20px",
          marginBottom: "16px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: activeTab === tab.id ? "#0A2342" : "#FFFFFF",
              color: activeTab === tab.id ? "#FFFFFF" : "#0A2342",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px" }}>
        {/* COURSES TAB */}
        {activeTab === "courses" && (
          <>
            {/* Required Courses */}
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              Required Courses
            </h3>

            {requiredCourses.map((course) => {
              return (
                <div
                  key={course.id}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "14px",
                    padding: "16px",
                    marginBottom: "10px",
                    border: "1px solid #E5E7EB",
                    opacity: course.status === "locked" ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: course.status === "completed" ? "#F0FDFB" : "#F5F7FA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                      }}
                    >
                      {course.badge}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                          {course.title}
                        </h4>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#6B7280" }}>⏱️ {course.duration}</span>
                        <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "600" }}>
                          +{course.credits} credits
                        </span>
                      </div>

                      {/* Progress bar for in_progress */}
                      {course.status === "in_progress" && (
                        <div style={{ marginBottom: "10px" }}>
                          <div
                            style={{
                              height: "6px",
                              background: "#E5E7EB",
                              borderRadius: "3px",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${course.progress}%`,
                                background: "#D97706",
                                borderRadius: "3px",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "11px", color: "#6B7280" }}>{course.progress}% complete</span>
                        </div>
                      )}

                      {/* Action Button */}
                      {course.status === "available" && (
                        <button
                          onClick={() => console.log("Start course:", course)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#00C6AE",
                            color: "#FFFFFF",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Start Course
                        </button>
                      )}

                      {course.status === "in_progress" && (
                        <button
                          onClick={() => console.log("Continue course:", course)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#D97706",
                            color: "#FFFFFF",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Continue
                        </button>
                      )}

                      {course.status === "completed" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "#00897B",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          ✓ Completed
                        </span>
                      )}

                      {course.status === "locked" && (
                        <span style={{ fontSize: "12px", color: "#6B7280" }}>🔒 Complete previous course first</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Elective Courses */}
            <h3 style={{ margin: "20px 0 12px 0", fontSize: "15px", fontWeight: "700", color: "#0A2342" }}>
              Elective Courses
            </h3>

            {electiveCourses.map((course) => (
              <div
                key={course.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "10px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <span style={{ fontSize: "24px" }}>{course.badge}</span>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#0A2342" }}>
                      {course.title}
                    </h4>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "12px", color: "#6B7280" }}>{course.duration}</span>
                      <span style={{ fontSize: "12px", color: "#00C6AE", fontWeight: "600" }}>+{course.credits}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => console.log("Start course:", course)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                      color: "#0A2342",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* BADGES TAB */}
        {activeTab === "badges" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "12px",
            }}
          >
            {badges.map((badge) => (
              <div
                key={badge.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "20px",
                  textAlign: "center",
                  border: badge.earned ? "2px solid #00C6AE" : "1px solid #E5E7EB",
                  opacity: badge.earned ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: badge.earned ? "#F0FDFB" : "#F5F7FA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 10px auto",
                    fontSize: "28px",
                    filter: badge.earned ? "none" : "grayscale(100%)",
                  }}
                >
                  {badge.icon}
                </div>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#0A2342" }}>{badge.name}</p>
                {badge.earned && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: "6px",
                      fontSize: "10px",
                      color: "#00897B",
                      fontWeight: "600",
                    }}
                  >
                    ✓ Earned
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PROGRESS TAB */}
        {activeTab === "progress" && (
          <>
            {/* Tier Progress */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "16px",
                padding: "20px",
                marginBottom: "16px",
                border: "1px solid #E5E7EB",
              }}
            >
              <h4 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#0A2342" }}>
                Path to Senior Elder
              </h4>

              {/* Visual Path */}
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}
              >
                {["Junior", "Senior", "Grand"].map((tier, idx) => (
                  <div key={tier} style={{ display: "flex", alignItems: "center" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        background:
                          tier === elderProfile.tier
                            ? "#00C6AE"
                            : idx < ["Junior", "Senior", "Grand"].indexOf(elderProfile.tier)
                              ? "#00C6AE"
                              : "#E5E7EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "20px",
                          filter:
                            tier === elderProfile.tier || idx < ["Junior", "Senior", "Grand"].indexOf(elderProfile.tier)
                              ? "none"
                              : "grayscale(100%)",
                        }}
                      >
                        {tier === "Junior" ? "🌱" : tier === "Senior" ? "🌿" : "🌳"}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div
                        style={{
                          width: "60px",
                          height: "3px",
                          background:
                            idx < ["Junior", "Senior", "Grand"].indexOf(elderProfile.tier) ? "#00C6AE" : "#E5E7EB",
                          margin: "0 8px",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Requirements */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Complete 5 required courses", current: 3, needed: 5 },
                  { label: "Earn 100 training credits", current: 75, needed: 100 },
                  { label: "Resolve 50 cases", current: 23, needed: 50 },
                  { label: "Maintain 4.5+ rating", current: 4.7, needed: 4.5, isMet: true },
                ].map((req, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#F5F7FA",
                      borderRadius: "10px",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <span style={{ fontSize: "13px", color: "#0A2342" }}>{req.label}</span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: req.isMet || req.current >= req.needed ? "#00897B" : "#6B7280",
                        }}
                      >
                        {req.current}/{req.needed}
                      </span>
                    </div>
                    <div
                      style={{
                        height: "4px",
                        background: "#E5E7EB",
                        borderRadius: "2px",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min((req.current / req.needed) * 100, 100)}%`,
                          background: req.isMet || req.current >= req.needed ? "#00C6AE" : "#D97706",
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
