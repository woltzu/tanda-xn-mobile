// ═══════════════════════════════════════════════════════════════════════════
// ElderOverviewScreen — Phase 8 cross-community elder view
// ═══════════════════════════════════════════════════════════════════════════
//
// One screen listing every community the caller elders (elder or owner
// role, per mig 005's community_memberships role hierarchy). Each card
// summarizes the community and offers two actions: jump into the
// Members tab of that community's hub, or jump to the Elder Dashboard's
// pending-requests queue.
//
// Access: gated at the entry-point layer on ElderDashboardScreen (only
// rendered when useElderCommunities().communities is non-empty). This
// screen also handles the empty case gracefully in the (unlikely)
// event it's opened without any elder-scoped communities.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  useElderCommunities,
  type ElderCommunity,
} from "../hooks/useElderCommunities";

export default function ElderOverviewScreen() {
  const navigation = useNavigation<any>();
  const { communities, loading, refresh } = useElderCommunities();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elder Overview</Text>
        <View style={styles.headerRightSpacer} />
      </View>
      <Text style={styles.subtitle}>
        Every community you elder, with the numbers that matter.
      </Text>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor="#00C6AE"
            colors={["#00C6AE"]}
          />
        }
      >
        {loading && communities.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#00C6AE" />
          </View>
        ) : communities.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="shield-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No elder communities yet</Text>
            <Text style={styles.emptySubtitle}>
              Once you're granted an elder role in a community, it will
              appear here with pending-request and activity summaries.
            </Text>
          </View>
        ) : (
          communities.map((c) => (
            <ElderCommunityCard
              key={c.id}
              community={c}
              onViewMembers={() =>
                navigation.navigate("CommunityHub", {
                  communityId: c.id,
                  initialTab: "members",
                })
              }
              onManageRequests={() => navigation.navigate("ElderDashboard")}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ElderCommunityCard({
  community,
  onViewMembers,
  onManageRequests,
}: {
  community: ElderCommunity;
  onViewMembers: () => void;
  onManageRequests: () => void;
}) {
  const pending = community.pendingRequestsCount;
  const activityTotal =
    community.recent.arrivals +
    community.recent.posts +
    community.recent.gatherings;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {community.icon ? (
          <View style={styles.cardIconWrap}>
            <Text style={styles.cardIconText}>{community.icon}</Text>
          </View>
        ) : (
          <View style={[styles.cardIconWrap, styles.cardIconFallback]}>
            <Ionicons name="people" size={22} color="#4B5563" />
          </View>
        )}
        <View style={styles.cardHeadBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {community.name}
            </Text>
            <View
              style={[
                styles.rolePill,
                community.role === "owner"
                  ? styles.rolePillOwner
                  : styles.rolePillElder,
              ]}
            >
              <Text
                style={[
                  styles.rolePillText,
                  community.role === "owner"
                    ? styles.rolePillTextOwner
                    : styles.rolePillTextElder,
                ]}
              >
                {community.role === "owner" ? "Owner" : "Elder"}
              </Text>
            </View>
          </View>
          {community.description ? (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {community.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statRow}>
        <Stat label="Members" value={community.membersCount} />
        <Stat
          label="Pending"
          value={pending}
          highlight={pending > 0 ? "#DC2626" : undefined}
        />
        <Stat label="7d activity" value={activityTotal} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onViewMembers}
          accessibilityRole="button"
          accessibilityLabel={`View members of ${community.name}`}
        >
          <Ionicons name="people-outline" size={16} color="#0A2342" />
          <Text style={styles.secondaryBtnText}>View Members</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            pending === 0 && styles.primaryBtnMuted,
          ]}
          onPress={onManageRequests}
          accessibilityRole="button"
          accessibilityLabel={`Manage requests for ${community.name}`}
        >
          <Ionicons
            name="mail-outline"
            size={16}
            color={pending === 0 ? "#4B5563" : "#FFFFFF"}
          />
          <Text
            style={[
              styles.primaryBtnText,
              pending === 0 && styles.primaryBtnTextMuted,
            ]}
          >
            Manage Requests
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statValue,
          highlight ? { color: highlight } : null,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  headerRightSpacer: {
    width: 32,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 18,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  loadingWrap: {
    paddingTop: 60,
    alignItems: "center",
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconFallback: {
    backgroundColor: "#F3F4F6",
  },
  cardIconText: {
    fontSize: 26,
  },
  cardHeadBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    flexShrink: 1,
  },
  cardDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    lineHeight: 17,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillElder: {
    backgroundColor: "#F0FDFB",
  },
  rolePillOwner: {
    backgroundColor: "#FEF3C7",
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  rolePillTextElder: {
    color: "#00897B",
  },
  rolePillTextOwner: {
    color: "#92400E",
  },
  statRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 12,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0A2342",
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A2342",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0A2342",
  },
  primaryBtnMuted: {
    backgroundColor: "#F3F4F6",
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  primaryBtnTextMuted: {
    color: "#4B5563",
  },
});
