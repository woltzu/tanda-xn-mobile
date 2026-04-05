"use client";

import React, { ReactNode } from "react";
import { useFeatureGates, AccessResult } from "../context/FeatureGateContext";

// ==================== useFeatureGate HOOK ====================

/**
 * Check access for a single feature. Use this when you need
 * conditional rendering rather than full blocking.
 *
 * @example
 * const { allowed, reasonCode, progress, missingRequirements } = useFeatureGate("loans.mortgage");
 * if (!allowed) return <div>Locked: {reasonCode}</div>;
 */
export function useFeatureGate(featureKey: string): AccessResult {
  const { checkAccess } = useFeatureGates();
  return checkAccess(featureKey);
}

// ==================== <FeatureGate> COMPONENT ====================

type FeatureGateProps = {
  /** The feature key to check, e.g. "circles.join_public" */
  feature: string;
  /** Content to render when access is granted */
  children: ReactNode;
  /** Optional custom fallback when blocked. If omitted, uses default blocked UI. */
  fallback?: ReactNode;
  /** If true, renders nothing when blocked (no UI at all) */
  hideWhenBlocked?: boolean;
};

/**
 * Declarative feature gate wrapper.
 *
 * @example
 * <FeatureGate feature="loans.mortgage">
 *   <MortgageScreen />
 * </FeatureGate>
 *
 * <FeatureGate feature="elder.mediate" fallback={<CustomLockUI />}>
 *   <MediationDashboard />
 * </FeatureGate>
 */
export default function FeatureGate({
  feature,
  children,
  fallback,
  hideWhenBlocked = false,
}: FeatureGateProps) {
  const result = useFeatureGate(feature);

  if (result.allowed) {
    return <>{children}</>;
  }

  if (hideWhenBlocked) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <BlockedFeatureUI result={result} />;
}

// ==================== DEFAULT BLOCKED UI ====================

function BlockedFeatureUI({ result }: { result: AccessResult }) {
  const {
    blockedTitle,
    blockedMessage,
    unlockHint,
    icon,
    color,
    progress,
    missingRequirements,
  } = result;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Icon */}
        <div
          style={{
            ...styles.iconCircle,
            backgroundColor: `${color}20`,
            borderColor: `${color}40`,
          }}
        >
          <span style={{ ...styles.iconText, color }}>{getIconEmoji(icon)}</span>
        </div>

        {/* Title & Message */}
        <h2 style={styles.title}>{blockedTitle}</h2>
        <p style={styles.message}>{blockedMessage}</p>

        {/* Progress Bar */}
        {progress > 0 && progress < 100 && (
          <div style={styles.progressSection}>
            <div style={styles.progressHeader}>
              <span style={styles.progressLabel}>Progress to unlock</span>
              <span style={{ ...styles.progressValue, color }}>{progress}%</span>
            </div>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progress}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        )}

        {/* Missing Requirements */}
        {missingRequirements.length > 0 && (
          <div style={styles.requirementsList}>
            {missingRequirements.map((req, idx) => (
              <div key={idx} style={styles.requirementRow}>
                <span style={styles.requirementIcon}>✗</span>
                <div style={styles.requirementContent}>
                  <span style={styles.requirementLabel}>{req.label}</span>
                  <span style={styles.requirementValues}>
                    <span style={styles.currentValue}>
                      {typeof req.current === "boolean" ? (req.current ? "Yes" : "No") : req.current}
                    </span>
                    {" → "}
                    <span style={styles.requiredValue}>
                      {typeof req.required === "boolean" ? (req.required ? "Required" : "—") : req.required}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Unlock Hint */}
        <div style={styles.hintCard}>
          <span style={styles.hintIcon}>💡</span>
          <p style={styles.hintText}>{unlockHint}</p>
        </div>

        {/* Action Button */}
        <button
          style={styles.actionButton}
          onClick={() => {
            window.location.href = "/score";
          }}
        >
          View XnScore™ Dashboard →
        </button>
      </div>
    </div>
  );
}

// ==================== ICON MAPPER ====================

function getIconEmoji(ioniconsName: string): string {
  const map: Record<string, string> = {
    "lock-closed": "🔒",
    search: "🔍",
    people: "👥",
    mail: "📩",
    "hand-right": "🤝",
    "add-circle": "➕",
    flash: "⚡",
    cash: "💰",
    home: "🏠",
    "shield-checkmark": "🛡️",
    ribbon: "🎖️",
    gavel: "⚖️",
    flag: "🚩",
    send: "📤",
    download: "📥",
    globe: "🌍",
    planet: "🪐",
    settings: "⚙️",
    gift: "🎁",
    analytics: "📊",
    grid: "📋",
    ban: "🚫",
  };
  return map[ioniconsName] || "🔒";
}

// ==================== STYLES ====================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0A2342 0%, #143654 100%)",
    padding: "20px",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: "20px",
    padding: "32px 24px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center" as const,
    border: "1px solid rgba(255,255,255,0.1)",
  },
  iconCircle: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    border: "2px solid",
  },
  iconText: {
    fontSize: "36px",
    lineHeight: "1",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700" as const,
    color: "#FFFFFF",
    margin: "0 0 10px",
  },
  message: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.75)",
    lineHeight: "1.5",
    margin: "0 0 24px",
  },
  progressSection: {
    marginBottom: "20px",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  progressLabel: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.6)",
  },
  progressValue: {
    fontSize: "13px",
    fontWeight: "700" as const,
  },
  progressTrack: {
    height: "8px",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "4px",
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.5s ease",
  },
  requirementsList: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "20px",
    textAlign: "left" as const,
  },
  requirementRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  requirementIcon: {
    color: "#EF4444",
    fontSize: "14px",
    fontWeight: "700" as const,
    marginTop: "2px",
  },
  requirementContent: {
    flex: "1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  requirementLabel: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500" as const,
  },
  requirementValues: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.5)",
  },
  currentValue: {
    color: "#EF4444",
    fontWeight: "600" as const,
  },
  requiredValue: {
    color: "#10B981",
    fontWeight: "600" as const,
  },
  hintCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    backgroundColor: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.25)",
    borderRadius: "12px",
    padding: "14px",
    marginBottom: "20px",
    textAlign: "left" as const,
  },
  hintIcon: {
    fontSize: "18px",
    flexShrink: "0",
  },
  hintText: {
    fontSize: "13px",
    color: "#FFFFFF",
    lineHeight: "1.5",
    margin: "0",
  },
  actionButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#00C6AE",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: "700" as const,
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
  },
};
