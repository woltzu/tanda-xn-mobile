import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useCommunity, CommunityCircle, SubCommunity } from "../context/CommunityContext";
import {
  useCommunityHub,
  type ActivityItem,
  type CommunityCircleRow,
} from "../hooks/useCommunityHub";

// Compact relative-time formatter — mirrors the ElderDashboard helper.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Currency-format cents → "$1.2k" / "$12k" / "$1.5M" for the stats row.
function formatSavedCents(cents: number): string {
  const dollars = Math.max(0, Math.round(cents / 100));
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 10_000) return `$${Math.round(dollars / 1000)}k`;
  if (dollars >= 1_000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars}`;
}

type CommunityHubNavigationProp = StackNavigationProp<RootStackParamList>;
type CommunityHubRouteProp = RouteProp<RootStackParamList, "CommunityHub">;

type TabId = "circles" | "sub" | "members" | "activity";

export default function CommunityHubScreen() {
  const navigation = useNavigation<CommunityHubNavigationProp>();
  const route = useRoute<CommunityHubRouteProp>();
  const { t } = useTranslation();
  const { communityId } = route.params;

  const { getCommunityById, getCommunityCircles, getSubCommunities } = useCommunity();

  const community = getCommunityById(communityId);

  // Phase 7 — live hub data. Overrides the stale/mock numbers on the
  // context community object with authoritative counts, and adds the
  // activity feed source. Circles from the hook include every status
  // (context filter drops completed) so counts on the header + the
  // Circles tab agree.
  const {
    membersCount: liveMembersCount,
    circlesCount: liveCirclesCount,
    totalSavedCents: liveTotalSavedCents,
    circles: hubCircles,
    activity,
    loading: hubLoading,
  } = useCommunityHub(communityId);

  // Bug fix: getCommunityCircles and getSubCommunities return Promises
  // (async DB queries in CommunityContext), not plain arrays. Prior code
  // assigned the Promise object directly, so `circles.map(...)` crashed
  // with "circles.map is not a function." Load them into state via a
  // useEffect that awaits both in parallel.
  const [circles, setCircles] = useState<CommunityCircle[]>([]);
  const [subCommunities, setSubCommunities] = useState<SubCommunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!communityId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [c, s] = await Promise.all([
          getCommunityCircles(communityId).catch(() => [] as CommunityCircle[]),
          getSubCommunities(communityId).catch(() => [] as SubCommunity[]),
        ]);
        if (cancelled) return;
        setCircles(c || []);
        setSubCommunities(s || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, getCommunityCircles, getSubCommunities]);

  const [activeTab, setActiveTab] = useState<TabId>("circles");

  if (!community) {
    return (
      <View style={styles.container}>
        <Text>{t("community_hub.error_not_found")}</Text>
      </View>
    );
  }

  // Live counts fall back to the context values while the hub hook is
  // still loading, so the tabs don't briefly show 0 on cold mount.
  const displayCircleCount = hubLoading ? circles.length : liveCirclesCount;
  const displayMemberCount = hubLoading ? community.members : liveMembersCount;
  const displaySavedCents = liveTotalSavedCents;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "circles", label: "Circles", count: displayCircleCount },
    { id: "sub", label: "Sub-communities", count: subCommunities.length },
    { id: "members", label: "Members", count: displayMemberCount },
    { id: "activity", label: "Activity", count: activity.length },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#00C6AE";
      case "forming":
        return "#D97706";
      case "full":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "forming":
        return "Forming";
      case "full":
        return "Full";
      default:
        return status;
    }
  };

  const getCommunityTypeLabel = (type: string) => {
    switch (type) {
      case "diaspora":
        return "Diaspora Community";
      case "religious":
        return "Faith Community";
      case "professional":
        return "Professional Community";
      case "neighborhood":
        return "Local Community";
      case "school":
        return "School/Alumni";
      case "interest":
        return "Interest Group";
      default:
        return "Community";
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
              {/* Parent community breadcrumb */}
              {community.parentName && (
                <TouchableOpacity style={styles.breadcrumb}>
                  <Text style={styles.breadcrumbText}>{community.parentName}</Text>
                  <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
              <View style={styles.titleRow}>
                <Text style={styles.headerTitle}>{community.name}</Text>
                {community.verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.menuButton}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Stats Row — live numbers from useCommunityHub, with
              context fallback while the first hub fetch is in flight. */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{displayMemberCount}</Text>
              <Text style={styles.statLabel}>{t("community_hub.stat_members")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{displayCircleCount}</Text>
              <Text style={styles.statLabel}>{t("community_hub.stat_circles")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxHighlight]}>
              <Text style={[styles.statValue, styles.statValueHighlight]}>
                {formatSavedCents(displaySavedCents)}
              </Text>
              <Text style={styles.statLabel}>{t("community_hub.stat_total_saved")}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Community Card - Overlapping */}
        <View style={styles.communityCard}>
          <View style={styles.communityCardTop}>
            <View style={styles.communityIcon}>
              <Text style={styles.communityIconText}>{community.icon}</Text>
            </View>
            <View style={styles.communityCardInfo}>
              <Text style={styles.communityType}>
                {getCommunityTypeLabel(community.type)}
              </Text>
              <Text style={styles.communityDescription}>
                {community.description}
              </Text>
            </View>
          </View>

          {/* Member Badge */}
          {community.isJoined && (
            <View style={styles.memberBadge}>
              <Ionicons name="checkmark" size={14} color="#00C6AE" />
              <Text style={styles.memberBadgeText}>
                {community.role === "elder"
                  ? "Elder"
                  : community.role === "admin"
                  ? "Admin"
                  : "Member"}
              </Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
              <View style={[styles.tabCount, activeTab === tab.id && styles.tabCountActive]}>
                <Text style={styles.tabCountText}>{tab.count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* CIRCLES TAB */}
          {activeTab === "circles" && (
            <>
              {/* Create Circle CTA — Phase 7: pass communityId so the
                  wizard seeds CircleDraft.targetCommunityId and the new
                  circle lands scoped to this community. */}
              <TouchableOpacity
                style={styles.createCircleButton}
                onPress={() =>
                  navigation.navigate("CreateCircleStart", {
                    communityId,
                    communityName: community.name,
                  } as any)
                }
              >
                <Ionicons name="add-circle-outline" size={20} color="#00C6AE" />
                <Text style={styles.createCircleText}>{t("community_hub.btn_create_circle")}</Text>
              </TouchableOpacity>

              {/* Loading spinner while the async fetch is in flight —
                  avoids a flash of the "no circles" empty state on
                  cold load. */}
              {loading || hubLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color="#00C6AE" />
                </View>
              ) : (
                <>
                  {/* Circles List — Phase 7: rendered from the hub's
                      full list (all statuses) so the visible cards
                      match the header count. Adapts CommunityCircleRow
                      (DB shape) to CommunityCircle (CircleCard prop). */}
                  {hubCircles.map((row: CommunityCircleRow) => {
                    const adapted = {
                      id: row.id,
                      name: row.name,
                      contribution: Number(row.amount) || 0,
                      frequency: (row.frequency ?? "monthly") as CommunityCircle["frequency"],
                      members: row.current_members ?? 0,
                      maxMembers: row.member_count ?? 0,
                      status: (row.status ?? "forming") as CommunityCircle["status"],
                      type: row.type ?? undefined,
                      spotsLeft: Math.max(
                        0,
                        (row.member_count ?? 0) - (row.current_members ?? 0),
                      ),
                    };
                    return (
                      <CircleCard
                        key={row.id}
                        circle={adapted}
                        getStatusColor={getStatusColor}
                        getStatusLabel={getStatusLabel}
                        onJoin={() =>
                          navigation.navigate("JoinCircleConfirm" as any, {
                            circleId: row.id,
                            source: "community",
                          })
                        }
                        onView={() =>
                          navigation.navigate("CircleDetail", { circleId: row.id })
                        }
                      />
                    );
                  })}

                  {hubCircles.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyEmoji}>⭕</Text>
                      <Text style={styles.emptyTitle}>{t("community_hub.empty_no_circles")}</Text>
                      <Text style={styles.emptySubtitle}>
                        Be the first to create a circle in this community
                      </Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* SUB-COMMUNITIES TAB */}
          {activeTab === "sub" && (
            <>
              {subCommunities.length > 0 ? (
                subCommunities.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={styles.subCommunityCard}
                    onPress={() => navigation.navigate("CommunityHub", { communityId: sub.id })}
                  >
                    <View style={styles.subCommunityIcon}>
                      <Text style={styles.subCommunityIconText}>{sub.icon}</Text>
                    </View>
                    <View style={styles.subCommunityInfo}>
                      <Text style={styles.subCommunityName}>{sub.name}</Text>
                      <Text style={styles.subCommunityMembers}>{sub.members} members</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🏘️</Text>
                  <Text style={styles.emptyTitle}>{t("final_polish.communityhub_no_sub_communities_yet")}</Text>
                  <Text style={styles.emptySubtitle}>
                    Create a sub-community to organize members by location or interest
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => navigation.navigate("CreateCommunity", { parentId: communityId })}
                  >
                    <Text style={styles.emptyButtonText}>{t("final_polish.communityhub_create_sub_community")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* MEMBERS TAB */}
          {activeTab === "members" && (
            <View style={styles.membersCard}>
              <View style={styles.membersIconContainer}>
                <Text style={styles.membersEmoji}>👥</Text>
              </View>
              <Text style={styles.membersCount}>{displayMemberCount}</Text>
              <Text style={styles.membersLabel}>{t("community_hub.members_label")}</Text>
              <View style={styles.avgScoreCard}>
                <Text style={styles.avgScoreText}>
                  Avg. XnScore: <Text style={styles.avgScoreValue}>{community.stats?.avgXnScore || 75}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* ACTIVITY TAB — Phase 7. Union of community_feed_items,
              community_arrivals, community_gatherings, and community-
              scoped feed_posts, ordered by recency. Read-only summary
              cards; taps intentionally deferred until a dedicated
              detail screen exists for each source type. */}
          {activeTab === "activity" && (
            <>
              {hubLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator color="#00C6AE" />
                </View>
              ) : activity.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🌱</Text>
                  <Text style={styles.emptyTitle}>No recent activity</Text>
                  <Text style={styles.emptySubtitle}>
                    Post to the community or host a gathering to start
                    the timeline.
                  </Text>
                </View>
              ) : (
                activity.map((item) => (
                  <ActivityCard key={item.id} item={item} />
                ))
              )}
            </>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// Circle Card Component
function CircleCard({
  circle,
  getStatusColor,
  getStatusLabel,
  onJoin,
  onView,
}: {
  circle: CommunityCircle;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  onJoin: () => void;
  onView: () => void;
}) {
  const statusColor = getStatusColor(circle.status);

  return (
    <TouchableOpacity style={styles.circleCard} onPress={onView}>
      <View style={styles.circleHeader}>
        <View style={styles.circleNameRow}>
          <Text style={styles.circleName}>{circle.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(circle.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.circleDetails}>
          ${circle.contribution}/{circle.frequency} • {circle.members}/{circle.maxMembers} members
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${(circle.members / circle.maxMembers) * 100}%`,
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>

      <View style={styles.circleFooter}>
        <View style={styles.circleInfo}>
          {circle.nextPayout && (
            <Text style={styles.nextPayout}>Next payout: {circle.nextPayout}</Text>
          )}
          {circle.spotsLeft && circle.spotsLeft > 0 && (
            <Text style={styles.spotsLeft}>{circle.spotsLeft} spots left</Text>
          )}
        </View>

        {circle.status !== "full" && (
          <TouchableOpacity style={styles.joinCircleButton} onPress={onJoin}>
            <Text style={styles.joinCircleButtonText}>{t("final_polish.communityhub_join")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Activity card — Phase 7. Renders every ActivityItem kind through a
// single card shape (icon + accent bar / name + timestamp / subtitle).
function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityCard}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.activityAvatar} />
      ) : (
        <View
          style={[
            styles.activityIconWrap,
            { backgroundColor: (item.accentColor ?? "#00C6AE") + "20" },
          ]}
        >
          <Ionicons
            name={(item.iconName ?? "megaphone-outline") as any}
            size={18}
            color={item.accentColor ?? "#00C6AE"}
          />
        </View>
      )}
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.activitySubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        ) : null}
        <Text style={styles.activityTime}>{timeAgo(item.createdAt)}</Text>
      </View>
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
    paddingBottom: 80,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  headerTextContainer: {
    flex: 1,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  breadcrumbText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  statBoxHighlight: {
    backgroundColor: "rgba(0,198,174,0.2)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statValueHighlight: {
    color: "#00C6AE",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  communityCard: {
    marginTop: -60,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0A2342",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  communityCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  communityIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  communityIconText: {
    fontSize: 32,
  },
  communityCardInfo: {
    flex: 1,
  },
  communityType: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  communityDescription: {
    fontSize: 14,
    color: "#0A2342",
    lineHeight: 20,
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDFB",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  memberBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00897B",
  },
  tabsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#0A2342",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  tabCount: {
    backgroundColor: "#F5F7FA",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tabCountActive: {
    backgroundColor: "rgba(0,198,174,0.3)",
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#0A2342",
  },
  content: {
    paddingHorizontal: 20,
  },
  createCircleButton: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  createCircleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00897B",
  },
  circleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  circleHeader: {
    marginBottom: 12,
  },
  circleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  circleName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  circleDetails: {
    fontSize: 13,
    color: "#6B7280",
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F5F7FA",
    marginBottom: 12,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  circleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextPayout: {
    fontSize: 12,
    color: "#6B7280",
  },
  spotsLeft: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "500",
  },
  joinCircleButton: {
    backgroundColor: "#00C6AE",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  joinCircleButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  subCommunityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  subCommunityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  subCommunityIconText: {
    fontSize: 24,
  },
  subCommunityInfo: {
    flex: 1,
  },
  subCommunityName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  subCommunityMembers: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  membersCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  membersIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  membersEmoji: {
    fontSize: 28,
  },
  membersCount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  membersLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  avgScoreCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    padding: 14,
    width: "100%",
    alignItems: "center",
  },
  avgScoreText: {
    fontSize: 13,
    color: "#6B7280",
  },
  avgScoreValue: {
    color: "#00C6AE",
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
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
  // Phase 7 — activity feed
  activityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  activityBody: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  activitySubtitle: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 3,
    lineHeight: 17,
  },
  activityTime: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 6,
  },
});
