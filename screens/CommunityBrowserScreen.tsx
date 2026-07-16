import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useCommunity, Community, CommunityType } from "../context/CommunityContext";
import { useCommunityJoinRequests } from "../hooks/useCommunityJoinRequests";

type CommunityBrowserNavigationProp = StackNavigationProp<RootStackParamList>;

const categories: { id: CommunityType | "all"; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "🌍" },
  { id: "diaspora", label: "Diaspora", icon: "✈️" },
  { id: "religious", label: "Faith", icon: "🙏" },
  { id: "professional", label: "Professional", icon: "💼" },
  { id: "neighborhood", label: "Local", icon: "🏘️" },
];

export default function CommunityBrowserScreen() {
  const navigation = useNavigation<CommunityBrowserNavigationProp>();
  const { t } = useTranslation();
  const { myCommunities, discoverCommunities, suggestions, isLoading } = useCommunity();
  // Phase 2 (mig 345) — communities other than auto-assigned ones go
  // through the request-approve pipeline. The join CTA now creates a
  // community_join_requests row instead of directly inserting a
  // membership. Elders/owners review + approve/reject from their
  // Elder dashboard (client UI is a follow-up; the RPCs are ready).
  const { myPendingCommunityIds, requestToJoin } = useCommunityJoinRequests();

  const [activeTab, setActiveTab] = useState<"my" | "discover">("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CommunityType | "all">("all");

  const filteredCommunities = discoverCommunities.filter((c) => {
    const matchesQuery =
      searchQuery === "" || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || c.type === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  const handleRequestToJoin = async (community: Community) => {
    const result = await requestToJoin(community.id);
    if (result.success) {
      Alert.alert(
        "Request sent",
        `Your request to join ${community.name} is pending elder review.`,
      );
    } else {
      Alert.alert("Request failed", result.error || "Please try again.");
    }
  };

  const handleViewCommunity = (communityId: string) => {
    navigation.navigate("CommunityHub", { communityId });
  };

  const tabs = [
    { id: "my" as const, label: "My Communities", count: myCommunities.length },
    { id: "discover" as const, label: "Discover" },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{t("community_browser.header_title")}</Text>
            <Text style={styles.headerSubtitle}>
              Join communities, create circles
            </Text>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate("CreateCommunity")}
          >
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={18}
            color="#6B7280"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t("community_browser.search_placeholder")}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* MY COMMUNITIES TAB */}
        {activeTab === "my" && (
          <>
            {/* Explainer */}
            <View style={styles.explainerCard}>
              <Text style={styles.explainerEmoji}>💡</Text>
              <View style={styles.explainerText}>
                <Text style={styles.explainerTitle}>
                  You can belong to multiple communities
                </Text>
                <Text style={styles.explainerSubtitle}>
                  Communities can have sub-communities. Circles belong to communities.
                </Text>
              </View>
            </View>

            {/* My Communities List */}
            {myCommunities.map((community) => (
              <TouchableOpacity
                key={community.id}
                style={styles.communityCard}
                onPress={() => handleViewCommunity(community.id)}
              >
                <View style={styles.communityCardContent}>
                  <View style={styles.communityIcon}>
                    <Text style={styles.communityIconText}>{community.icon}</Text>
                  </View>

                  <View style={styles.communityInfo}>
                    <View style={styles.communityNameRow}>
                      <Text style={styles.communityName}>{community.name}</Text>
                      {community.role === "elder" && (
                        <View style={styles.elderBadge}>
                          <Text style={styles.elderBadgeText}>{t("community_browser.badge_elder")}</Text>
                        </View>
                      )}
                      {community.role === "admin" && (
                        <View style={[styles.elderBadge, styles.adminBadge]}>
                          <Text style={styles.elderBadgeText}>{t("community_browser.badge_admin")}</Text>
                        </View>
                      )}
                    </View>

                    {community.parentName && (
                      <Text style={styles.parentName}>
                        Part of: {community.parentName}
                      </Text>
                    )}

                    <View style={styles.statsRow}>
                      <Text style={styles.statText}>
                        👥 {community.members.toLocaleString()} members
                      </Text>
                      <Text style={styles.circlesStat}>
                        ⭕ {community.circles} circles
                      </Text>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                </View>
              </TouchableOpacity>
            ))}

            {/* Create Community CTA */}
            <TouchableOpacity
              style={styles.createCommunityButton}
              onPress={() => navigation.navigate("CreateCommunity")}
            >
              <Ionicons name="add-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.createCommunityText}>
                Create a new community
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* DISCOVER TAB */}
        {activeTab === "discover" && (
          <>
            {/* Category Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    selectedCategory === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryLabel,
                      selectedCategory === cat.id && styles.categoryLabelActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Suggestions Section */}
            {suggestions.length > 0 && selectedCategory === "all" && searchQuery === "" && (
              <>
                <Text style={styles.sectionTitle}>{t("community_browser.section_suggested")}</Text>
                {suggestions.slice(0, 2).map((suggestion) => (
                  <View key={suggestion.community.id} style={styles.suggestionCard}>
                    <View style={styles.suggestionBadge}>
                      <Ionicons name="sparkles" size={12} color="#D97706" />
                      <Text style={styles.suggestionBadgeText}>
                        {suggestion.reason}
                      </Text>
                    </View>
                    <CommunityDiscoverCard
                      community={suggestion.community}
                      pending={myPendingCommunityIds.has(suggestion.community.id)}
                      onJoin={() => handleRequestToJoin(suggestion.community)}
                      onView={() => handleViewCommunity(suggestion.community.id)}
                    />
                  </View>
                ))}
              </>
            )}

            {/* All Communities */}
            <Text style={styles.sectionTitle}>
              {selectedCategory === "all" ? "All Communities" : `${categories.find((c) => c.id === selectedCategory)?.label} Communities`}
            </Text>

            {filteredCommunities.map((community) => (
              <CommunityDiscoverCard
                key={community.id}
                community={community}
                pending={myPendingCommunityIds.has(community.id)}
                onJoin={() => handleRequestToJoin(community)}
                onView={() => handleViewCommunity(community.id)}
              />
            ))}

            {filteredCommunities.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>{t("community_browser.empty_title")}</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different search or create your own community
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => navigation.navigate("CreateCommunity")}
                >
                  <Text style={styles.emptyButtonText}>{t("community_browser.btn_create")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// Separate component for discover cards
function CommunityDiscoverCard({
  community,
  pending,
  onJoin,
  onView,
}: {
  community: Community;
  pending: boolean;
  onJoin: () => void;
  onView: () => void;
}) {
  return (
    <View style={styles.discoverCard}>
      <TouchableOpacity onPress={onView} style={styles.discoverCardContent}>
        <View style={styles.discoverIconContainer}>
          <Text style={styles.discoverIcon}>{community.icon}</Text>
          {community.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.discoverInfo}>
          <Text style={styles.discoverName}>{community.name}</Text>
          <Text style={styles.discoverDescription} numberOfLines={2}>
            {community.description}
          </Text>

          <View style={styles.discoverStats}>
            <Text style={styles.discoverStat}>
              👥 {community.members.toLocaleString()}
            </Text>
            <Text style={styles.discoverCircles}>
              ⭕ {community.circles} circles
            </Text>
          </View>

          {/* Sub-communities preview */}
          {community.subCommunities && community.subCommunities.length > 0 && (
            <View style={styles.subCommunitiesPreview}>
              <Text style={styles.subCommunitiesLabel}>
                INCLUDES SUB-COMMUNITIES:
              </Text>
              <View style={styles.subCommunitiesList}>
                {community.subCommunities.slice(0, 3).map((sub) => (
                  <View key={sub.id} style={styles.subCommunityBadge}>
                    <Text style={styles.subCommunityName}>{sub.name}</Text>
                  </View>
                ))}
                {community.subCommunities.length > 3 && (
                  <Text style={styles.subCommunitiesMore}>
                    +{community.subCommunities.length - 3} more
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {pending ? (
        <View style={[styles.joinButton, styles.joinButtonPending]}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text style={[styles.joinButtonText, styles.joinButtonTextPending]}>
            Pending review
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.joinButton} onPress={onJoin}>
          <Text style={styles.joinButtonText}>Request to Join</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    position: "relative",
    marginBottom: 16,
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: 14,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 15,
    color: "#0A2342",
  },
  tabsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "rgba(0,198,174,0.2)",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  tabBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 12,
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  explainerCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  explainerEmoji: {
    fontSize: 20,
  },
  explainerText: {
    flex: 1,
  },
  explainerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  explainerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  communityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  communityCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  communityIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  communityIconText: {
    fontSize: 28,
  },
  communityInfo: {
    flex: 1,
  },
  communityNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  communityName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  elderBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  adminBadge: {
    backgroundColor: "#EDE9FE",
  },
  elderBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#92400E",
  },
  parentName: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  statText: {
    fontSize: 12,
    color: "#6B7280",
  },
  circlesStat: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "500",
  },
  createCommunityButton: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  createCommunityText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  categoriesScroll: {
    marginBottom: 20,
    marginHorizontal: -20,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryButtonActive: {
    backgroundColor: "#0A2342",
    borderColor: "#0A2342",
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0A2342",
  },
  categoryLabelActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 14,
  },
  suggestionCard: {
    marginBottom: 12,
  },
  suggestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  suggestionBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#92400E",
  },
  discoverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  discoverCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 12,
  },
  discoverIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  discoverIcon: {
    fontSize: 28,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  discoverInfo: {
    flex: 1,
  },
  discoverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  discoverDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 8,
  },
  discoverStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  discoverStat: {
    fontSize: 12,
    color: "#6B7280",
  },
  discoverCircles: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "500",
  },
  subCommunitiesPreview: {
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    padding: 10,
  },
  subCommunitiesLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
  },
  subCommunitiesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  subCommunityBadge: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  subCommunityName: {
    fontSize: 11,
    color: "#0A2342",
  },
  subCommunitiesMore: {
    fontSize: 11,
    color: "#6B7280",
    alignSelf: "center",
  },
  joinButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  joinButtonPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
  },
  joinButtonTextPending: {
    color: "#6B7280",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginTop: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  bottomSpacer: {
    height: 40,
  },
});
