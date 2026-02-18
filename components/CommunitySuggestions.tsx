import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { SuggestedCommunity, useOnboarding } from "../context/OnboardingContext";
import { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme/tokens";

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface CommunitySuggestionsProps {
  maxSuggestions?: number;
  showHeader?: boolean;
  compact?: boolean;
}

export function CommunitySuggestions({
  maxSuggestions = 4,
  showHeader = true,
  compact = false,
}: CommunitySuggestionsProps) {
  const navigation = useNavigation<NavigationProp>();
  const { suggestedCommunities, dismissSuggestion } = useOnboarding();

  const displaySuggestions = suggestedCommunities.slice(0, maxSuggestions);

  if (displaySuggestions.length === 0) {
    return null;
  }

  const handleJoinCommunity = (community: SuggestedCommunity) => {
    // Navigate to community and pre-fill join intent
    navigation.navigate("CommunityHub", {
      communityId: community.id,
      joinIntent: true,
    } as any);
  };

  const handleViewAll = () => {
    navigation.navigate("CommunityBrowser");
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compactScroll}
        >
          {displaySuggestions.map((community) => (
            <TouchableOpacity
              key={community.id}
              style={styles.compactCard}
              onPress={() => handleJoinCommunity(community)}
              activeOpacity={0.8}
            >
              <View style={styles.compactIconContainer}>
                <Text style={styles.compactIcon}>{community.icon}</Text>
              </View>
              <Text style={styles.compactName} numberOfLines={1}>
                {community.name}
              </Text>
              <Text style={styles.compactMembers}>
                {community.members.toLocaleString()} members
              </Text>
              <View style={styles.compactMatchBadge}>
                <Text style={styles.compactMatchText}>{community.matchScore}% match</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="sparkles" size={18} color="#6366F1" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Suggested for You</Text>
              <Text style={styles.headerSubtitle}>Based on your profile</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleViewAll}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.suggestionsGrid}>
        {displaySuggestions.map((community) => (
          <View key={community.id} style={styles.suggestionCard}>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => dismissSuggestion(community.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Text style={styles.communityIcon}>{community.icon}</Text>
              </View>

              <Text style={styles.communityName} numberOfLines={1}>
                {community.name}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Ionicons name="people" size={12} color={colors.textSecondary} />
                  <Text style={styles.statText}>
                    {community.members.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{community.category}</Text>
                </View>
              </View>

              <View style={styles.matchContainer}>
                <View style={styles.matchBar}>
                  <View
                    style={[
                      styles.matchFill,
                      { width: `${community.matchScore}%` },
                    ]}
                  />
                </View>
                <Text style={styles.matchPercent}>{community.matchScore}%</Text>
              </View>

              <Text style={styles.reasonText} numberOfLines={1}>
                {community.reason}
              </Text>

              <TouchableOpacity
                style={styles.joinButton}
                onPress={() => handleJoinCommunity(community)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={colors.textWhite} />
                <Text style={styles.joinText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Inline suggestion bubble for dashboard
export function CommunitySuggestionBubble() {
  const navigation = useNavigation<NavigationProp>();
  const { suggestedCommunities } = useOnboarding();

  const topSuggestion = suggestedCommunities[0];
  if (!topSuggestion) return null;

  return (
    <TouchableOpacity
      style={styles.bubble}
      onPress={() => navigation.navigate("CommunityBrowser")}
      activeOpacity={0.9}
    >
      <View style={styles.bubbleIconContainer}>
        <Text style={styles.bubbleIcon}>{topSuggestion.icon}</Text>
      </View>
      <View style={styles.bubbleContent}>
        <Text style={styles.bubbleTitle}>Join {topSuggestion.name}</Text>
        <Text style={styles.bubbleSubtitle}>
          {topSuggestion.members.toLocaleString()} members • {topSuggestion.matchScore}% match
        </Text>
      </View>
      <View style={styles.bubbleAction}>
        <Ionicons name="chevron-forward" size={20} color={colors.accentTeal} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  headerSubtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  viewAllText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: "#6366F1",
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionCard: {
    flex: 1,
    minWidth: "45%",
    maxWidth: "48%",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  dismissButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  cardContent: {
    padding: 14,
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.medium,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  communityIcon: {
    fontSize: 24,
  },
  communityName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    textAlign: "center",
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  categoryBadge: {
    backgroundColor: colors.screenBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  matchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
    marginBottom: 6,
  },
  matchBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  matchFill: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 2,
  },
  matchPercent: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: "#6366F1",
    width: 30,
    textAlign: "right",
  },
  reasonText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 10,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    gap: 4,
    width: "100%",
  },
  joinText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },

  // Compact styles
  compactContainer: {
    marginVertical: 8,
  },
  compactScroll: {
    paddingHorizontal: 4,
    gap: 10,
  },
  compactCard: {
    width: 120,
    backgroundColor: colors.cardBg,
    borderRadius: radius.medium,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  compactIcon: {
    fontSize: 20,
  },
  compactName: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    textAlign: "center",
    marginBottom: 2,
  },
  compactMembers: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  compactMatchBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  compactMatchText: {
    fontSize: 10,
    fontWeight: typography.semibold,
    color: "#6366F1",
  },

  // Bubble styles
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: "#6366F1",
    borderStyle: "dashed",
    marginVertical: 8,
  },
  bubbleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bubbleIcon: {
    fontSize: 22,
  },
  bubbleContent: {
    flex: 1,
  },
  bubbleTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  bubbleSubtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bubbleAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
  },
});
