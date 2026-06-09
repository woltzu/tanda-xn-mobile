// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalStoriesScreen.tsx — GOALS-015
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 166-GOALS-015-GoalStories.jsx.
//
// Community achievement stories (social proof), filterable by goal type.
// Each story expands to reveal the full text + the author's tips, and
// shows a stats bar (saved / months / circles) and engagement row.
//
// EXPANSION — the web used CSS -webkit-line-clamp. In RN we use
// <Text numberOfLines={expanded ? undefined : 3}> with a Read more / Show
// less toggle (local per-story state). Stories render in a FlatList.
//
// NAVIGATION — translation-only batch. onBack → goBack(); Share My Story
// is a "coming soon" Alert placeholder tagged TODO(goals-wiring). Tapping a
// story only expands it (no navigation).
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";
const AMBER = "#D97706";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type Story = {
  id: string;
  userName: string;
  userInitials: string;
  location: string;
  homeCountry: string;
  goalType: string;
  goalTypeLabel: string;
  emoji: string;
  headline: string;
  story: string;
  tips: string[];
  achievedAmount: number;
  monthsToAchieve: number;
  circlesUsed: number;
  likes: number;
  achievedDate: string;
  photoUrl: string | null;
};

type GoalTypeFilter = { id: string; label: string; emoji: string };

type GoalStoriesParams = {
  stories?: Story[];
  goalTypes?: GoalTypeFilter[];
};
type GoalStoriesRouteProp = RouteProp<
  { GoalStories: GoalStoriesParams },
  "GoalStories"
>;

const DEFAULT_STORIES: Story[] = [
  {
    id: "s1",
    userName: "Aminata D.",
    userInitials: "AD",
    location: "Atlanta, GA",
    homeCountry: "Senegal",
    goalType: "first_home",
    goalTypeLabel: "First Home",
    emoji: "🏠",
    headline: "Closed on my first home after 2 years of saving!",
    story:
      "When I arrived in the US, owning a home felt like an impossible dream. But joining TandaXn changed everything. The combination of Circle payouts and auto-deposits helped me save consistently. My Circle members became my accountability partners. When I got the keys last month, I cried. My parents watched on video call from Dakar. This is what the American dream looks like for us.",
    tips: [
      "Link your Circle to your Goal - game changer",
      "Start with a small monthly amount and increase over time",
      "Celebrate every milestone, even 10%",
    ],
    achievedAmount: 35000,
    monthsToAchieve: 24,
    circlesUsed: 2,
    likes: 234,
    achievedDate: "Dec 2025",
    photoUrl: null,
  },
  {
    id: "s2",
    userName: "Kwame O.",
    userInitials: "KO",
    location: "Houston, TX",
    homeCountry: "Ghana",
    goalType: "us_citizenship",
    goalTypeLabel: "US Citizenship",
    emoji: "🗽",
    headline: "Took the oath last month - 10 years in the making!",
    story:
      "Immigration lawyers are expensive, and I kept putting it off. TandaXn helped me finally save for the legal fees. The best part? Other members in the Citizenship Journey Circle shared their lawyer recommendations. I found a great immigration attorney through a Circle member. We went through the process together. Now three of us from that Circle are citizens!",
    tips: [
      "Join a goal-specific Circle - the support is invaluable",
      "Budget for unexpected costs (there are always surprises)",
      "Prepare for the civics test early",
    ],
    achievedAmount: 12000,
    monthsToAchieve: 18,
    circlesUsed: 1,
    likes: 189,
    achievedDate: "Nov 2025",
    photoUrl: null,
  },
  {
    id: "s3",
    userName: "Fatou N.",
    userInitials: "FN",
    location: "Brooklyn, NY",
    homeCountry: "Côte d'Ivoire",
    goalType: "start_business",
    goalTypeLabel: "Start Business",
    emoji: "💼",
    headline: "My catering business is now official!",
    story:
      "I'd been cooking for events informally for years. Everyone said 'You should start a business!' but where do you get the money? TandaXn's Business Launch Circle gave me $8,000 to get my LLC, commercial kitchen certification, and initial inventory. Six months later, I catered a wedding for 200 people. My mother's recipes are now a real business.",
    tips: [
      "The legal stuff costs more than you think - budget extra",
      "Get your business bank account early",
      "Your community is your first marketing channel",
    ],
    achievedAmount: 15000,
    monthsToAchieve: 12,
    circlesUsed: 1,
    likes: 312,
    achievedDate: "Oct 2025",
    photoUrl: null,
  },
  {
    id: "s4",
    userName: "Mamadou B.",
    userInitials: "MB",
    location: "DMV Area",
    homeCountry: "Mali",
    goalType: "property_home_country",
    goalTypeLabel: "Property Back Home",
    emoji: "🏡",
    headline: "Built a house for my parents in Bamako!",
    story:
      "For 15 years, my parents rented. It broke my heart every time rent increased. I decided that had to change. Every month, a portion of my Circle payout went to my Property Goal. After 3 years, I had enough to buy land and build. Last month, my parents moved in. They have a garden now. My father calls me every day just to say 'thank you, my son.' Worth every sacrifice.",
    tips: [
      "Get a trusted family member to manage construction",
      "Build in phases if needed - foundation first",
      "Factor in currency exchange fluctuations",
    ],
    achievedAmount: 28000,
    monthsToAchieve: 36,
    circlesUsed: 3,
    likes: 456,
    achievedDate: "Sep 2025",
    photoUrl: null,
  },
];

const DEFAULT_GOAL_TYPES: GoalTypeFilter[] = [
  { id: "all", label: "All Stories", emoji: "📖" },
  { id: "first_home", label: "First Home", emoji: "🏠" },
  { id: "us_citizenship", label: "Citizenship", emoji: "🗽" },
  { id: "start_business", label: "Business", emoji: "💼" },
  { id: "property_home_country", label: "Property Back Home", emoji: "🏡" },
  { id: "education", label: "Education", emoji: "🎓" },
];

export default function GoalStoriesScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<GoalStoriesRouteProp>();

  const stories = route.params?.stories ?? DEFAULT_STORIES;
  const goalTypes = route.params?.goalTypes ?? DEFAULT_GOAL_TYPES;

  const [selectedType, setSelectedType] = useState("all");
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const filteredStories =
    selectedType === "all"
      ? stories
      : stories.filter((s) => s.goalType === selectedType);

  const comingSoon = (label: string) =>
    Alert.alert(label, "This will be available soon.");

  const ListHeader = (
    <>
      <LinearGradient
        colors={[NAVY, "#143654"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏆 Achievement Stories</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Real stories from people who achieved their dreams. If they did it,
          so can you.
        </Text>
      </LinearGradient>

      {/* Goal type filter */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {goalTypes.map((type) => {
            const isActive = selectedType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedType(type.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
              >
                <Text style={styles.filterEmoji}>{type.emoji}</Text>
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.filterTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </>
  );

  const ListFooter = (
    <LinearGradient
      colors={[TEAL, GREEN]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.shareCard}
    >
      <Text style={styles.shareTitle}>Achieved a Goal?</Text>
      <Text style={styles.shareBody}>
        Share your story and inspire others on their journey
      </Text>
      <TouchableOpacity
        onPress={() => comingSoon("Share My Story")}
        accessibilityRole="button"
        style={styles.shareButton}
      >
        <Text style={styles.shareButtonText}>Share My Story 🌟</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  const renderStory = ({ item }: { item: Story }) => {
    const expanded = expandedStory === item.id;
    const firstName = item.userName.split(" ")[0];
    return (
      <View style={styles.storyCard}>
        {/* Header */}
        <View style={styles.storyHeader}>
          <View style={styles.storyHeaderRow}>
            <View style={styles.storyHeaderLeft}>
              <LinearGradient
                colors={[NAVY, "#143654"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{item.userInitials}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.storyName}>{item.userName}</Text>
                <Text style={styles.storyLocation}>
                  {item.location} • Originally from {item.homeCountry}
                </Text>
              </View>
            </View>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeEmoji}>{item.emoji}</Text>
              <Text style={styles.goalBadgeText}>{item.goalTypeLabel}</Text>
            </View>
          </View>

          <Text style={styles.headline}>"{item.headline}"</Text>
        </View>

        {/* Content */}
        <View style={styles.storyContent}>
          <Text
            style={styles.storyText}
            numberOfLines={expanded ? undefined : 3}
          >
            {item.story}
          </Text>

          {item.story.length > 200 && (
            <TouchableOpacity
              onPress={() =>
                setExpandedStory(expanded ? null : item.id)
              }
              accessibilityRole="button"
              style={styles.readMoreButton}
            >
              <Text style={styles.readMoreText}>
                {expanded ? "Show less" : "Read more"}
              </Text>
            </TouchableOpacity>
          )}

          {expanded && item.tips && item.tips.length > 0 && (
            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>💡 {firstName}'s Tips:</Text>
              {item.tips.map((tip, idx) => (
                <View key={idx} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              ${item.achievedAmount.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.monthsToAchieve}</Text>
            <Text style={styles.statLabel}>months</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.circlesUsed}</Text>
            <Text style={styles.statLabel}>Circles</Text>
          </View>
        </View>

        {/* Engagement */}
        <View style={styles.engagementBar}>
          <View style={styles.engagementLeft}>
            <Text style={styles.heart}>❤️</Text>
            <Text style={styles.engagementText}>
              {item.likes} people inspired
            </Text>
          </View>
          <Text style={styles.achievedDate}>Achieved {item.achievedDate}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <FlatList
        data={filteredStories}
        keyExtractor={(s) => s.id}
        extraData={expandedStory}
        renderItem={renderStory}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  listContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 50, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 21,
  },

  tabsWrap: { marginTop: -25, marginBottom: 12 },
  tabsContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  filterPillActive: { backgroundColor: NAVY },
  filterEmoji: { fontSize: 13 },
  filterText: { fontSize: 12, fontWeight: "600", color: MUTED },
  filterTextActive: { color: "#FFFFFF" },

  // Story card
  storyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  storyHeader: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12 },
  storyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  storyHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  storyName: { fontSize: 15, fontWeight: "600", color: NAVY },
  storyLocation: { fontSize: 11, color: MUTED, marginTop: 2 },
  goalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
  },
  goalBadgeEmoji: { fontSize: 14 },
  goalBadgeText: { fontSize: 11, fontWeight: "600", color: GREEN },
  headline: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
    lineHeight: 24,
    marginTop: 14,
  },

  storyContent: { paddingHorizontal: 16, paddingBottom: 16 },
  storyText: { fontSize: 14, color: "#4B5563", lineHeight: 24 },
  readMoreButton: { marginTop: 8, alignSelf: "flex-start" },
  readMoreText: { fontSize: 13, fontWeight: "600", color: TEAL },

  tipsBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
  },
  tipsTitle: { fontSize: 13, fontWeight: "600", color: AMBER, marginBottom: 10 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 6 },
  tipBullet: { fontSize: 12, color: "#92400E" },
  tipText: { fontSize: 12, color: "#92400E", flex: 1 },

  statsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F5F7FA",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "700", color: NAVY },
  statLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: BORDER },

  engagementBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  engagementLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  heart: { fontSize: 14 },
  engagementText: { fontSize: 12, color: MUTED },
  achievedDate: { fontSize: 11, color: "#9CA3AF" },

  // Share CTA footer
  shareCard: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  shareTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  shareBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
    marginBottom: 16,
    textAlign: "center",
  },
  shareButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  shareButtonText: { fontSize: 14, fontWeight: "700", color: GREEN },
});
