/**
 * CommunityHealthCard Component
 *
 * A comprehensive card component for displaying community health scores.
 * Shows overall score, component breakdowns, trends, and recommendations.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCommunityHealth } from "../hooks/useCommunityHealth";
import {
  HealthStatus,
  ComponentScore,
  HealthRecommendation,
} from "../services/CommunityHealthService";

interface CommunityHealthCardProps {
  communityId: string;
  compact?: boolean;
  showRecommendations?: boolean;
  onViewDetails?: () => void;
  onRecalculate?: () => void;
}

const STATUS_COLORS: Record<HealthStatus, { bg: string; text: string; border: string }> = {
  thriving: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  healthy: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  at_risk: { bg: "#FFFBEB", text: "#92400E", border: "#FCD34D" },
  critical: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

const ScoreRing: React.FC<{
  score: number;
  size: number;
  strokeWidth: number;
  color: string;
}> = ({ score, size, strokeWidth, color }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: "#E5E7EB",
          position: "absolute",
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderLeftColor: "transparent",
          borderBottomColor: score > 25 ? color : "transparent",
          borderRightColor: score > 50 ? color : "transparent",
          borderTopColor: score > 75 ? color : "transparent",
          position: "absolute",
          transform: [{ rotate: "-45deg" }],
        }}
      />
      <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
    </View>
  );
};

const ComponentScoreBar: React.FC<{
  label: string;
  score: ComponentScore;
  color: string;
}> = ({ label, score, color }) => {
  return (
    <View style={styles.componentRow}>
      <View style={styles.componentLabelContainer}>
        <Text style={styles.componentLabel}>{label}</Text>
        <Text style={styles.componentWeight}>
          ({Math.round(score.weight * 100)}%)
        </Text>
      </View>
      <View style={styles.componentBarContainer}>
        <View style={styles.componentBarBg}>
          <View
            style={[
              styles.componentBarFill,
              { width: `${score.score}%`, backgroundColor: color },
            ]}
          />
        </View>
        <Text style={[styles.componentScore, { color }]}>{score.score}</Text>
      </View>
    </View>
  );
};

const RecommendationItem: React.FC<{
  recommendation: HealthRecommendation;
  onPress?: () => void;
}> = ({ recommendation, onPress }) => {
  const priorityColors = {
    high: "#EF4444",
    medium: "#F59E0B",
    low: "#3B82F6",
  };

  return (
    <TouchableOpacity
      style={styles.recommendationCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.recommendationHeader}>
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: priorityColors[recommendation.priority] + "20" },
          ]}
        >
          <Text
            style={[
              styles.priorityText,
              { color: priorityColors[recommendation.priority] },
            ]}
          >
            {recommendation.priority.toUpperCase()}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
      <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
      <Text style={styles.recommendationDescription} numberOfLines={2}>
        {recommendation.description}
      </Text>
    </TouchableOpacity>
  );
};

export const CommunityHealthCard: React.FC<CommunityHealthCardProps> = ({
  communityId,
  compact = false,
  showRecommendations = true,
  onViewDetails,
  onRecalculate,
}) => {
  const {
    healthScore,
    isLoading,
    isCalculating,
    calculateHealth,
    overallScore,
    status,
    trend,
    statusLabel,
    statusColor,
    statusEmoji,
    scoreDescription,
    trendDescription,
    topRecommendations,
  } = useCommunityHealth(communityId);

  useEffect(() => {
    // Auto-calculate if no score exists
    if (!isLoading && !healthScore && !isCalculating) {
      calculateHealth();
    }
  }, [healthScore, isLoading, isCalculating]);

  if (isLoading || isCalculating) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>
          {isCalculating ? "Calculating health score..." : "Loading..."}
        </Text>
      </View>
    );
  }

  if (!healthScore) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Ionicons name="pulse-outline" size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>No health data available</Text>
        <TouchableOpacity style={styles.calculateButton} onPress={calculateHealth}>
          <Text style={styles.calculateButtonText}>Calculate Health Score</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColorConfig = status ? STATUS_COLORS[status] : STATUS_COLORS.healthy;

  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          { backgroundColor: statusColorConfig.bg, borderColor: statusColorConfig.border },
        ]}
        onPress={onViewDetails}
        activeOpacity={0.8}
      >
        <View style={styles.compactLeft}>
          <Text style={styles.compactEmoji}>{statusEmoji}</Text>
          <View>
            <Text style={[styles.compactLabel, { color: statusColorConfig.text }]}>
              Community Health
            </Text>
            <Text style={styles.compactStatus}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.compactRight}>
          <Text style={[styles.compactScore, { color: statusColor }]}>{overallScore}</Text>
          {trend && (
            <Ionicons
              name={
                trend === "improving"
                  ? "trending-up"
                  : trend === "declining"
                    ? "trending-down"
                    : "remove"
              }
              size={16}
              color={
                trend === "improving"
                  ? "#10B981"
                  : trend === "declining"
                    ? "#EF4444"
                    : "#6B7280"
              }
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: statusColorConfig.bg, borderColor: statusColorConfig.border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Community Health</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusEmoji}>{statusEmoji}</Text>
            <Text style={[styles.statusText, { color: statusColorConfig.text }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <ScoreRing score={overallScore} size={80} strokeWidth={6} color={statusColor} />
      </View>

      {/* Description */}
      <Text style={styles.description}>{scoreDescription}</Text>

      {/* Trend */}
      {trend && (
        <View style={styles.trendContainer}>
          <Ionicons
            name={
              trend === "improving"
                ? "trending-up"
                : trend === "declining"
                  ? "trending-down"
                  : "remove"
            }
            size={20}
            color={
              trend === "improving"
                ? "#10B981"
                : trend === "declining"
                  ? "#EF4444"
                  : "#6B7280"
            }
          />
          <Text style={styles.trendText}>
            {trendDescription}
            {healthScore.scoreDelta !== undefined && (
              <Text
                style={{
                  color:
                    healthScore.scoreDelta > 0
                      ? "#10B981"
                      : healthScore.scoreDelta < 0
                        ? "#EF4444"
                        : "#6B7280",
                }}
              >
                {" "}
                ({healthScore.scoreDelta > 0 ? "+" : ""}
                {healthScore.scoreDelta} pts)
              </Text>
            )}
          </Text>
        </View>
      )}

      {/* Component Scores */}
      <View style={styles.componentsContainer}>
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        <ComponentScoreBar
          label="Payment Reliability"
          score={healthScore.contributionScore}
          color="#10B981"
        />
        <ComponentScoreBar
          label="Activity"
          score={healthScore.activityScore}
          color="#3B82F6"
        />
        <ComponentScoreBar
          label="Default Rate"
          score={healthScore.defaultScore}
          color="#F59E0B"
        />
        <ComponentScoreBar
          label="Growth Health"
          score={healthScore.growthScore}
          color="#8B5CF6"
        />
      </View>

      {/* Recommendations */}
      {showRecommendations && topRecommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={styles.sectionTitle}>Top Recommendations</Text>
          {topRecommendations.map((rec, index) => (
            <RecommendationItem key={index} recommendation={rec} />
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {onRecalculate && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRecalculate || calculateHealth}
          >
            <Ionicons name="refresh" size={18} color="#6B7280" />
            <Text style={styles.actionButtonText}>Recalculate</Text>
          </TouchableOpacity>
        )}
        {onViewDetails && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={onViewDetails}
          >
            <Text style={styles.primaryActionButtonText}>View Details</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Last Updated */}
      <Text style={styles.lastUpdated}>
        Last calculated:{" "}
        {new Date(healthScore.calculatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginVertical: 8,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  emptyText: {
    marginTop: 12,
    marginBottom: 16,
    color: "#6B7280",
    fontSize: 14,
  },
  calculateButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  calculateButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusEmoji: {
    fontSize: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: "700",
  },
  description: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 16,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 8,
  },
  trendText: {
    fontSize: 14,
    color: "#4B5563",
  },
  componentsContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  componentRow: {
    marginBottom: 12,
  },
  componentLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  componentLabel: {
    fontSize: 13,
    color: "#4B5563",
  },
  componentWeight: {
    fontSize: 11,
    color: "#9CA3AF",
    marginLeft: 4,
  },
  componentBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  componentBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 4,
    overflow: "hidden",
  },
  componentBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  componentScore: {
    width: 30,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  recommendationsContainer: {
    marginBottom: 16,
  },
  recommendationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  recommendationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionButtonText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  primaryActionButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  lastUpdated: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  compactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compactEmoji: {
    fontSize: 24,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  compactStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  compactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactScore: {
    fontSize: 24,
    fontWeight: "700",
  },
});

export default CommunityHealthCard;
