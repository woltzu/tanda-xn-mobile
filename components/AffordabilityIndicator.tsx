/**
 * AffordabilityIndicator Component
 *
 * A visual component that displays affordability check results.
 * Can be used in circle join flows, circle browsing, etc.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AffordabilityResult } from "../services/AffordabilityService";

interface AffordabilityIndicatorProps {
  result: AffordabilityResult | null;
  isLoading?: boolean;
  compact?: boolean;
  showDetails?: boolean;
  onLearnMore?: () => void;
}

export const AffordabilityIndicator: React.FC<AffordabilityIndicatorProps> = ({
  result,
  isLoading = false,
  compact = false,
  showDetails = true,
  onLearnMore,
}) => {
  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <ActivityIndicator size="small" color="#10B981" />
        <Text style={styles.loadingText}>Checking affordability...</Text>
      </View>
    );
  }

  if (!result) {
    return null;
  }

  const getStatusConfig = () => {
    if (result.canAfford) {
      switch (result.riskLevel) {
        case "low":
          return {
            icon: "checkmark-circle",
            color: "#10B981",
            bgColor: "#ECFDF5",
            borderColor: "#A7F3D0",
            label: "Affordable",
            sublabel: "Low risk",
          };
        case "medium":
          return {
            icon: "alert-circle",
            color: "#F59E0B",
            bgColor: "#FFFBEB",
            borderColor: "#FCD34D",
            label: "Affordable",
            sublabel: "Moderate risk",
          };
        case "high":
          return {
            icon: "warning",
            color: "#F97316",
            bgColor: "#FFF7ED",
            borderColor: "#FDBA74",
            label: "Affordable",
            sublabel: "High risk",
          };
        default:
          return {
            icon: "help-circle",
            color: "#6B7280",
            bgColor: "#F9FAFB",
            borderColor: "#D1D5DB",
            label: "Check Result",
            sublabel: "",
          };
      }
    } else {
      return {
        icon: "close-circle",
        color: "#EF4444",
        bgColor: "#FEF2F2",
        borderColor: "#FECACA",
        label: "Not Affordable",
        sublabel: "Exceeds limit",
      };
    }
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <View
        style={[
          styles.compactContainer,
          { backgroundColor: config.bgColor, borderColor: config.borderColor },
        ]}
      >
        <Ionicons name={config.icon as any} size={18} color={config.color} />
        <Text style={[styles.compactLabel, { color: config.color }]}>
          {config.label}
        </Text>
        <Text style={styles.compactScore}>{result.score}%</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.bgColor, borderColor: config.borderColor },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={config.icon as any} size={24} color={config.color} />
          <View style={styles.headerText}>
            <Text style={[styles.label, { color: config.color }]}>
              {config.label}
            </Text>
            <Text style={styles.sublabel}>{config.sublabel}</Text>
          </View>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={[styles.score, { color: config.color }]}>
            {result.score}
          </Text>
          <Text style={styles.scoreLabel}>score</Text>
        </View>
      </View>

      {showDetails && (
        <>
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(result.proposedRatio * 100 / result.maxAllowedRatio * 100, 100)}%`,
                    backgroundColor: config.color,
                  },
                ]}
              />
              <View
                style={[
                  styles.progressLimit,
                  { left: `${result.maxAllowedRatio * 100}%` },
                ]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelText}>
                {Math.round(result.proposedRatio * 100)}% of income
              </Text>
              <Text style={styles.progressLabelText}>
                Max: {Math.round(result.maxAllowedRatio * 100)}%
              </Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Monthly Income</Text>
              <Text style={styles.detailValue}>
                ${result.monthlyIncome.toFixed(0)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Current Obligations</Text>
              <Text style={styles.detailValue}>
                ${result.currentObligations.toFixed(0)}/mo
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>This Circle</Text>
              <Text style={styles.detailValue}>
                +${result.newObligation.toFixed(0)}/mo
              </Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowTotal]}>
              <Text style={styles.detailLabelBold}>Total After</Text>
              <Text style={[styles.detailValueBold, { color: config.color }]}>
                ${result.totalObligationsAfter.toFixed(0)}/mo
              </Text>
            </View>
          </View>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <View style={styles.warningsContainer}>
              {result.warnings.slice(0, 2).map((warning, index) => (
                <View key={index} style={styles.warningRow}>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color="#F59E0B"
                  />
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Reasons (if not affordable) */}
          {!result.canAfford && result.reasons.length > 0 && (
            <View style={styles.reasonsContainer}>
              {result.reasons.map((reason, index) => (
                <View key={index} style={styles.reasonRow}>
                  <Ionicons name="close-circle" size={16} color="#EF4444" />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <View style={styles.recommendationsContainer}>
              <Text style={styles.recommendationsTitle}>Recommendations</Text>
              {result.recommendations.slice(0, 2).map((rec, index) => (
                <View key={index} style={styles.recommendationRow}>
                  <Ionicons name="bulb-outline" size={16} color="#10B981" />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Learn More */}
          {onLearnMore && (
            <TouchableOpacity
              style={styles.learnMoreButton}
              onPress={onLearnMore}
            >
              <Text style={styles.learnMoreText}>
                Learn more about affordability
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

// Compact badge version for list items
export const AffordabilityBadge: React.FC<{
  canAfford: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  score: number;
}> = ({ canAfford, riskLevel, score }) => {
  const getConfig = () => {
    if (canAfford) {
      switch (riskLevel) {
        case "low":
          return { color: "#10B981", bg: "#ECFDF5", text: "Affordable" };
        case "medium":
          return { color: "#F59E0B", bg: "#FFFBEB", text: "Moderate" };
        case "high":
          return { color: "#F97316", bg: "#FFF7ED", text: "Risky" };
        default:
          return { color: "#6B7280", bg: "#F9FAFB", text: "Unknown" };
      }
    }
    return { color: "#EF4444", bg: "#FEF2F2", text: "Unaffordable" };
  };

  const config = getConfig();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>
        {config.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: "#6B7280",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: {
    gap: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  sublabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  compactLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  compactScore: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginLeft: "auto",
  },
  scoreContainer: {
    alignItems: "center",
  },
  score: {
    fontSize: 24,
    fontWeight: "700",
  },
  scoreLabel: {
    fontSize: 10,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    position: "relative",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLimit: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: "#374151",
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  progressLabelText: {
    fontSize: 11,
    color: "#6B7280",
  },
  details: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailRowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  detailLabelBold: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  detailValueBold: {
    fontSize: 14,
    fontWeight: "700",
  },
  warningsContainer: {
    marginTop: 12,
    gap: 6,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  reasonsContainer: {
    marginTop: 12,
    gap: 6,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasonText: {
    flex: 1,
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 18,
  },
  recommendationsContainer: {
    marginTop: 12,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 8,
    padding: 12,
  },
  recommendationsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  recommendationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  recommendationText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  learnMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  learnMoreText: {
    fontSize: 13,
    color: "#6B7280",
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});

export default AffordabilityIndicator;
