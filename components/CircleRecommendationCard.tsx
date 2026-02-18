/**
 * CircleRecommendationCard Component
 *
 * A card component for displaying circle match recommendations.
 * Shows match score, connection info, affordability, and eligibility status.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CircleMatch } from "../services/CircleMatchingService";

interface CircleRecommendationCardProps {
  match: CircleMatch;
  onPress?: () => void;
  onJoin?: () => void;
  compact?: boolean;
  showAffordability?: boolean;
}

const CONNECTION_BADGES: Record<"A" | "B" | "C" | "D", { label: string; color: string; icon: string }> = {
  A: { label: "Close", color: "#10B981", icon: "heart" },
  B: { label: "Friend", color: "#3B82F6", icon: "people" },
  C: { label: "Extended", color: "#8B5CF6", icon: "link" },
  D: { label: "Community", color: "#6B7280", icon: "globe" },
};

const ELIGIBILITY_CONFIG = {
  eligible: { bg: "#ECFDF5", text: "#065F46", label: "Eligible" },
  conditional: { bg: "#FFFBEB", text: "#92400E", label: "Conditional" },
  ineligible: { bg: "#FEF2F2", text: "#991B1B", label: "Not Eligible" },
};

export const CircleRecommendationCard: React.FC<CircleRecommendationCardProps> = ({
  match,
  onPress,
  onJoin,
  compact = false,
  showAffordability = true,
}) => {
  const { circle, matchScore, connectionType, connectionCount, affordability, eligibilityStatus } = match;
  const eligibilityConfig = ELIGIBILITY_CONFIG[eligibilityStatus];

  // Get match score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10B981";
    if (score >= 60) return "#3B82F6";
    if (score >= 40) return "#F59E0B";
    return "#EF4444";
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.compactLeft}>
          <Text style={styles.circleEmoji}>{circle.emoji || "💰"}</Text>
          <View style={styles.compactInfo}>
            <Text style={styles.compactName} numberOfLines={1}>
              {circle.name}
            </Text>
            <Text style={styles.compactAmount}>
              ${circle.amount}/{circle.frequency}
            </Text>
          </View>
        </View>
        <View style={styles.compactRight}>
          <View style={[styles.matchBadge, { backgroundColor: getScoreColor(matchScore) + "20" }]}>
            <Text style={[styles.matchBadgeText, { color: getScoreColor(matchScore) }]}>
              {matchScore}% match
            </Text>
          </View>
          {connectionType && (
            <View style={styles.connectionIndicator}>
              <Ionicons
                name={CONNECTION_BADGES[connectionType].icon as any}
                size={14}
                color={CONNECTION_BADGES[connectionType].color}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.emoji}>{circle.emoji || "💰"}</Text>
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {circle.name}
            </Text>
            {circle.communityName && (
              <Text style={styles.community}>in {circle.communityName}</Text>
            )}
          </View>
        </View>
        <View style={styles.matchScoreContainer}>
          <Text style={[styles.matchScore, { color: getScoreColor(matchScore) }]}>
            {matchScore}%
          </Text>
          <Text style={styles.matchLabel}>match</Text>
        </View>
      </View>

      {/* Circle Details */}
      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons name="cash-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            ${circle.amount} / {circle.frequency}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {circle.currentMembers}/{circle.memberCount} members
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="layers-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{circle.type} circle</Text>
        </View>
      </View>

      {/* Connection Badge */}
      {connectionType && connectionCount > 0 && (
        <View
          style={[
            styles.connectionBadge,
            { backgroundColor: CONNECTION_BADGES[connectionType].color + "15" },
          ]}
        >
          <Ionicons
            name={CONNECTION_BADGES[connectionType].icon as any}
            size={16}
            color={CONNECTION_BADGES[connectionType].color}
          />
          <Text
            style={[
              styles.connectionText,
              { color: CONNECTION_BADGES[connectionType].color },
            ]}
          >
            {connectionCount} {CONNECTION_BADGES[connectionType].label.toLowerCase()} connection
            {connectionCount > 1 ? "s" : ""} in this circle
          </Text>
        </View>
      )}

      {/* Affordability Indicator */}
      {showAffordability && affordability && (
        <View
          style={[
            styles.affordabilityBadge,
            {
              backgroundColor:
                affordability.riskLevel === "low"
                  ? "#ECFDF5"
                  : affordability.riskLevel === "medium"
                    ? "#FFFBEB"
                    : "#FEF2F2",
            },
          ]}
        >
          <Ionicons
            name={
              affordability.canAfford
                ? affordability.riskLevel === "low"
                  ? "checkmark-circle"
                  : "alert-circle"
                : "close-circle"
            }
            size={16}
            color={
              affordability.riskLevel === "low"
                ? "#10B981"
                : affordability.riskLevel === "medium"
                  ? "#F59E0B"
                  : "#EF4444"
            }
          />
          <Text
            style={[
              styles.affordabilityText,
              {
                color:
                  affordability.riskLevel === "low"
                    ? "#065F46"
                    : affordability.riskLevel === "medium"
                      ? "#92400E"
                      : "#991B1B",
              },
            ]}
          >
            {affordability.canAfford
              ? `Affordable (${affordability.riskLevel} risk)`
              : "May exceed your budget"}
          </Text>
        </View>
      )}

      {/* Match Reasons */}
      {match.matchReasons.length > 0 && (
        <View style={styles.reasonsContainer}>
          {match.matchReasons
            .filter((r) => r.impact === "high" || r.impact === "medium")
            .slice(0, 2)
            .map((reason, index) => (
              <View key={index} style={styles.reasonItem}>
                <Ionicons
                  name="checkmark"
                  size={14}
                  color="#10B981"
                />
                <Text style={styles.reasonText} numberOfLines={1}>
                  {reason.description}
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Warnings */}
      {match.warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          {match.warnings.slice(0, 1).map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Ionicons name="information-circle" size={14} color="#F59E0B" />
              <Text style={styles.warningText} numberOfLines={1}>
                {warning}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View
          style={[
            styles.eligibilityBadge,
            { backgroundColor: eligibilityConfig.bg },
          ]}
        >
          <Text style={[styles.eligibilityText, { color: eligibilityConfig.text }]}>
            {eligibilityConfig.label}
          </Text>
        </View>

        {eligibilityStatus === "eligible" && onJoin && (
          <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
            <Text style={styles.joinButtonText}>Join Circle</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {eligibilityStatus !== "eligible" && (
          <TouchableOpacity style={styles.viewButton} onPress={onPress}>
            <Text style={styles.viewButtonText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Spots Available Indicator */}
      {circle.spotsAvailable <= 3 && (
        <View style={styles.urgentBadge}>
          <Ionicons name="flame" size={12} color="#EF4444" />
          <Text style={styles.urgentText}>
            Only {circle.spotsAvailable} spot{circle.spotsAvailable > 1 ? "s" : ""} left!
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Featured/Top Match Card
export const TopMatchCard: React.FC<{
  match: CircleMatch;
  onPress?: () => void;
  onJoin?: () => void;
}> = ({ match, onPress, onJoin }) => {
  const { circle, matchScore, connectionType, affordability } = match;

  return (
    <TouchableOpacity
      style={styles.topMatchCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.topMatchBadge}>
        <Ionicons name="star" size={14} color="#F59E0B" />
        <Text style={styles.topMatchBadgeText}>Top Match for You</Text>
      </View>

      <View style={styles.topMatchContent}>
        <View style={styles.topMatchLeft}>
          <Text style={styles.topMatchEmoji}>{circle.emoji || "💰"}</Text>
          <View>
            <Text style={styles.topMatchName}>{circle.name}</Text>
            <Text style={styles.topMatchDetails}>
              ${circle.amount}/{circle.frequency} • {circle.currentMembers}/{circle.memberCount} members
            </Text>
            {connectionType && (
              <View style={styles.topMatchConnection}>
                <Ionicons
                  name={CONNECTION_BADGES[connectionType].icon as any}
                  size={12}
                  color={CONNECTION_BADGES[connectionType].color}
                />
                <Text
                  style={[
                    styles.topMatchConnectionText,
                    { color: CONNECTION_BADGES[connectionType].color },
                  ]}
                >
                  {CONNECTION_BADGES[connectionType].label} in circle
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.topMatchRight}>
          <View style={styles.topMatchScoreRing}>
            <Text style={styles.topMatchScoreText}>{matchScore}%</Text>
          </View>
          <Text style={styles.topMatchScoreLabel}>match</Text>
        </View>
      </View>

      {onJoin && match.eligibilityStatus === "eligible" && (
        <TouchableOpacity style={styles.topMatchJoinButton} onPress={onJoin}>
          <Text style={styles.topMatchJoinText}>Join Now</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  emoji: {
    fontSize: 36,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  community: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  matchScoreContainer: {
    alignItems: "center",
    paddingLeft: 12,
  },
  matchScore: {
    fontSize: 24,
    fontWeight: "800",
  },
  matchLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    textTransform: "uppercase",
  },
  details: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#4B5563",
  },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  connectionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  affordabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  affordabilityText: {
    fontSize: 13,
    fontWeight: "500",
  },
  reasonsContainer: {
    marginBottom: 12,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 12,
    color: "#065F46",
    flex: 1,
  },
  warningsContainer: {
    marginBottom: 12,
  },
  warningItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  eligibilityBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  eligibilityText: {
    fontSize: 12,
    fontWeight: "600",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewButtonText: {
    color: "#6B7280",
    fontSize: 14,
  },
  urgentBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF2F2",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  urgentText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#EF4444",
  },
  // Compact styles
  compactCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  compactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  circleEmoji: {
    fontSize: 28,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  compactAmount: {
    fontSize: 13,
    color: "#6B7280",
  },
  compactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  matchBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  connectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  // Top Match styles
  topMatchCard: {
    backgroundColor: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    borderRadius: 20,
    padding: 20,
    marginVertical: 8,
    overflow: "hidden",
  },
  topMatchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  topMatchBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  topMatchContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topMatchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  topMatchEmoji: {
    fontSize: 44,
  },
  topMatchName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  topMatchDetails: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  topMatchConnection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  topMatchConnectionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  topMatchRight: {
    alignItems: "center",
  },
  topMatchScoreRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  topMatchScoreText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  topMatchScoreLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
    textTransform: "uppercase",
  },
  topMatchJoinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  topMatchJoinText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
});

export default CircleRecommendationCard;
