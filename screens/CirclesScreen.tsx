import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";

type CirclesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function CirclesScreen() {
  const navigation = useNavigation<CirclesScreenNavigationProp>();
  const { myCircles, browseCircles } = useCircles();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTab, setActiveTab] = useState<"browse" | "my">("browse");

  // Convert browse circles to the format expected by CircleCard
  const circles = browseCircles.map((circle) => ({
    id: circle.id,
    name: circle.name,
    type: circle.type === "traditional" ? "family" : circle.type === "goal-based" ? "work" : "community",
    members: circle.currentMembers,
    maxMembers: circle.memberCount,
    contribution: circle.amount,
    frequency: circle.frequency,
    totalPool: circle.amount * circle.currentMembers,
    minScore: circle.minScore || 40,
    featured: circle.verified || false,
    verified: circle.verified || false,
    description: circle.description || "",
    location: circle.location || "Nationwide",
    nextPayout: "Coming soon",
    emoji: circle.emoji,
  }));

  const userXnScore = user?.xnScore || 0;

  const categories = [
    { id: "all", label: "All", icon: "sparkles" },
    { id: "family", label: "Family", icon: "people" },
    { id: "work", label: "Work", icon: "trending-up" },
    { id: "community", label: "Community", icon: "location" },
    { id: "friends", label: "Friends", icon: "star" },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "family":
        return { bg: "#F0FDFB", text: "#00897B" };
      case "work":
        return { bg: "#F0FDFB", text: "#00897B" };
      case "community":
        return { bg: "#FEF3C7", text: "#D97706" };
      case "friends":
        return { bg: "#F5F7FA", text: "#0A2342" };
      default:
        return { bg: "#F3F4F6", text: "#6B7280" };
    }
  };

  const filteredCircles = circles.filter((circle) => {
    const matchesSearch =
      circle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      circle.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || circle.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredCircles = filteredCircles.filter((c) => c.featured);
  const regularCircles = filteredCircles.filter((c) => !c.featured);

  const CircleCard = ({ circle, featured = false, originalId }: { circle: any; featured?: boolean; originalId?: string }) => {
    const typeColor = getTypeColor(circle.type);
    const spotsLeft = circle.maxMembers - circle.members;
    const canJoin = userXnScore >= circle.minScore;

    return (
      <TouchableOpacity
        style={[styles.circleCard, featured ? styles.circleCardFeatured : null]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("CircleDetail", { circleId: originalId || circle.id })}
      >
        {/* Verified Badge */}
        {circle.verified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="star" size={10} color="#00897B" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : null}

        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor.text }]}>{circle.type}</Text>
        </View>

        {/* Circle Name */}
        <Text style={[styles.circleName, circle.verified ? styles.circleNameWithBadge : null]}>
          {circle.name}
        </Text>

        {/* Description */}
        <Text style={styles.circleDescription} numberOfLines={2}>
          {circle.description}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={14} color="#666" />
            <Text style={styles.statText}>
              {circle.members}/{circle.maxMembers}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.statText}>{circle.location}</Text>
          </View>
        </View>

        {/* Contribution & Pool */}
        <View style={styles.contributionBox}>
          <View style={styles.contributionRow}>
            <Text style={styles.contributionLabel}>Contribution</Text>
            <Text style={styles.contributionValue}>
              ${circle.contribution}/
              {circle.frequency === "monthly" ? "mo" : circle.frequency === "biweekly" ? "2wk" : "wk"}
            </Text>
          </View>
          <View style={styles.contributionRow}>
            <Text style={styles.contributionLabel}>Pool Size</Text>
            <Text style={styles.poolValue}>${circle.totalPool.toLocaleString()}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View>
            {spotsLeft > 0 ? (
              <Text style={[styles.spotsText, { color: spotsLeft <= 2 ? "#DC2626" : "#00897B" }]}>
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </Text>
            ) : (
              <Text style={[styles.spotsText, { color: "#DC2626" }]}>Full</Text>
            )}
          </View>

          {!canJoin ? (
            <View style={styles.lockedRow}>
              <Ionicons name="lock-closed-outline" size={12} color="#F59E0B" />
              <Text style={styles.lockedText}>Min Score: {circle.minScore}</Text>
            </View>
          ) : null}

          {canJoin && spotsLeft > 0 ? (
            <Ionicons name="chevron-forward" size={18} color="#00C6AE" />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Circles</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.joinCodeButton}
                onPress={() => navigation.navigate("JoinCircleByCode")}
              >
                <Ionicons name="qr-code" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterButton}>
                <Ionicons name="filter" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "browse" && styles.tabActive]}
              onPress={() => setActiveTab("browse")}
            >
              <Text style={[styles.tabText, activeTab === "browse" && styles.tabTextActive]}>
                Browse
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "my" && styles.tabActive]}
              onPress={() => setActiveTab("my")}
            >
              <Text style={[styles.tabText, activeTab === "my" && styles.tabTextActive]}>
                My Circles
              </Text>
              {myCircles.length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{myCircles.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search - only show for browse tab */}
          {activeTab === "browse" && (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search circles..."
                  placeholderTextColor="#6B7280"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
                    <Ionicons name="close" size={12} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Categories */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                {categories.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setActiveCategory(cat.id)}
                      style={[styles.categoryButton, isActive ? styles.categoryButtonActive : null]}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={14}
                        color={isActive ? "#FFFFFF" : "#666"}
                      />
                      <Text style={[styles.categoryText, isActive ? styles.categoryTextActive : null]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === "browse" ? (
            <>
              {/* Featured Circles */}
              {featuredCircles.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>✨ Featured</Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll}>
                    {featuredCircles.map((circle) => (
                      <CircleCard key={circle.id} circle={circle} featured />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {/* All Circles */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {activeCategory === "all"
                    ? "All Circles"
                    : `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Circles`}
                  <Text style={styles.circleCount}> ({regularCircles.length})</Text>
                </Text>

                {regularCircles.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={40} color="#999" />
                    <Text style={styles.emptyTitle}>No circles found</Text>
                    <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
                  </View>
                ) : (
                  regularCircles.map((circle) => <CircleCard key={circle.id} circle={circle} />)
                )}
              </View>
            </>
          ) : (
            /* My Circles Tab */
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                My Circles
                <Text style={styles.circleCount}> ({myCircles.length})</Text>
              </Text>

              {myCircles.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="add-circle-outline" size={50} color="#00C6AE" />
                  </View>
                  <Text style={styles.emptyTitle}>No circles yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Create your first circle or join one from the Browse tab
                  </Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => navigation.navigate("CreateCircleStart")}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>Create Circle</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                myCircles.map((circle) => (
                  <TouchableOpacity
                    key={circle.id}
                    style={styles.myCircleCard}
                    onPress={() => navigation.navigate("CircleDetail", { circleId: circle.id })}
                  >
                    <View style={styles.myCircleIconContainer}>
                      <Text style={styles.myCircleEmoji}>{circle.emoji}</Text>
                    </View>
                    <View style={styles.myCircleInfo}>
                      <View style={styles.myCircleHeader}>
                        <Text style={styles.myCircleName} numberOfLines={1}>
                          {circle.name}
                        </Text>
                        <View style={[
                          styles.statusBadge,
                          circle.status === "active" ? styles.statusActive : styles.statusPending
                        ]}>
                          <Text style={[
                            styles.statusText,
                            circle.status === "active" ? styles.statusTextActive : styles.statusTextPending
                          ]}>
                            {circle.status === "active" ? "Active" : "Pending"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.myCircleDetails}>
                        {circle.currentMembers}/{circle.memberCount} members • ${circle.amount}/{circle.frequency.slice(0, 2)}
                      </Text>
                      <View style={styles.myCircleProgress}>
                        <View style={[styles.myCircleProgressFill, { width: `${circle.progress}%` }]} />
                      </View>
                    </View>
                    {circle.myPosition && (
                      <View style={styles.myCirclePosition}>
                        <Text style={styles.positionNumber}>#{circle.myPosition}</Text>
                        <Text style={styles.positionLabel}>Your turn</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>

      {/* Create Circle FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("CreateCircleStart")}
      >
        <LinearGradient colors={["#00C6AE", "#00A896"]} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  joinCodeButton: {
    backgroundColor: "rgba(0,198,174,0.3)",
    borderRadius: 10,
    padding: 10,
  },
  filterButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 10,
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
    padding: 12,
    paddingLeft: 44,
    fontSize: 15,
    color: "#0A2342",
  },
  clearButton: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  categoriesScroll: {
    flexDirection: "row",
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F7FA",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#0A2342",
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 12,
  },
  circleCount: {
    fontSize: 14,
    fontWeight: "400",
    color: "#666",
  },
  featuredScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  circleCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: "relative",
  },
  circleCardFeatured: {
    width: 280,
    marginRight: 12,
    marginBottom: 0,
  },
  verifiedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    color: "#00897B",
    fontWeight: "600",
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  circleName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 6,
  },
  circleNameWithBadge: {
    paddingRight: 70,
  },
  circleDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: "#666",
  },
  contributionBox: {
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  contributionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  contributionLabel: {
    fontSize: 12,
    color: "#666",
  },
  contributionValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  poolValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#00C6AE",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spotsText: {
    fontSize: 12,
    fontWeight: "600",
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F59E0B",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    marginBottom: 8,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  tabTextActive: {
    color: "#0A2342",
  },
  tabBadge: {
    backgroundColor: "#00C6AE",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  myCircleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  myCircleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  myCircleEmoji: {
    fontSize: 22,
  },
  myCircleInfo: {
    flex: 1,
    marginRight: 12,
  },
  myCircleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  myCircleName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: "#F0FDFB",
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusTextActive: {
    color: "#00897B",
  },
  statusTextPending: {
    color: "#D97706",
  },
  myCircleDetails: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  myCircleProgress: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  myCircleProgressFill: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 2,
  },
  myCirclePosition: {
    alignItems: "flex-end",
  },
  positionNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  positionLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingHelp: {
    position: "absolute",
    bottom: 90,
    right: 86,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
