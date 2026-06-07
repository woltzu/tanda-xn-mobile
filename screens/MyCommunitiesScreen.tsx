// =============================================================================
// MyCommunitiesScreen — read-only directory of the user's community memberships
//
// Phase 1a of the AI inference rollout. Lists every community the user is
// currently a member of, grouped by community type (Religious / Cultural /
// Neighborhood / Sync Room / etc.). Pull-to-refresh re-fetches via the
// existing CommunityContext.
//
// Deliberately scoped to display-only for 1a — no Leave button, no
// Suggestion accept/decline, no inference triggers. Those land in 1b/1c
// once the consent surface is wired.
//
// The Type column comes from communities.community_type which is free-text
// at the DB layer. We render the value through a label map so legacy
// names ("faith", "diaspora", "local") show as human-readable groupings
// alongside the new 1b-era types ("sync_room", later "religious",
// "neighborhood", "cultural").
// =============================================================================

import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  useCommunity,
  type Community,
  type CommunityType,
} from "../context/CommunityContext";

// ─── Type-bucket presentation ───────────────────────────────────────────────
// One entry per legacy + new community_type. The label is shown in the
// section heading; icon and accent set the visual treatment. Unknown
// types fall through to the "Other" bucket.
type BucketKey =
  | "religious"
  | "cultural"
  | "neighborhood"
  | "professional"
  | "school"
  | "interest"
  | "sync_room"
  | "general"
  | "other";

interface BucketSpec {
  key: BucketKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}

const BUCKET_ORDER: BucketKey[] = [
  "religious",
  "neighborhood",
  "cultural",
  "professional",
  "school",
  "interest",
  "sync_room",
  "general",
  "other",
];

const BUCKETS: Record<BucketKey, BucketSpec> = {
  religious: { key: "religious", label: "Religious", icon: "leaf-outline", accent: "#7C3AED" },
  cultural: { key: "cultural", label: "Cultural", icon: "globe-outline", accent: "#D97706" },
  neighborhood: { key: "neighborhood", label: "Neighborhood", icon: "location-outline", accent: "#0EA5E9" },
  professional: { key: "professional", label: "Professional", icon: "briefcase-outline", accent: "#0F766E" },
  school: { key: "school", label: "School", icon: "school-outline", accent: "#9333EA" },
  interest: { key: "interest", label: "Interest", icon: "star-outline", accent: "#E8A842" },
  sync_room: { key: "sync_room", label: "Sync Rooms", icon: "videocam-outline", accent: "#00C6AE" },
  general: { key: "general", label: "General", icon: "people-outline", accent: "#6B7280" },
  other: { key: "other", label: "Other", icon: "ellipsis-horizontal", accent: "#6B7280" },
};

// Legacy values from migration 005 map onto the new presentation buckets.
// `sync_room` is a 1b-era value but we accept it now so screens render
// correctly the moment migration 132 lands.
const TYPE_TO_BUCKET: Record<string, BucketKey> = {
  faith: "religious",
  religious: "religious",
  diaspora: "cultural",
  cultural: "cultural",
  local: "neighborhood",
  neighborhood: "neighborhood",
  professional: "professional",
  school: "school",
  interest: "interest",
  sync_room: "sync_room",
  general: "general",
};

const bucketForType = (type: CommunityType | string | undefined): BucketKey => {
  if (!type) return "other";
  return TYPE_TO_BUCKET[type] ?? "other";
};

// ─── Screen ────────────────────────────────────────────────────────────────
const NAVY = "#0A2342";
const BG = "#F5F7FA";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

export default function MyCommunitiesScreen() {
  const navigation = useNavigation();
  const { myCommunities, refreshCommunities } = useCommunity() as {
    myCommunities: Community[];
    refreshCommunities?: () => Promise<void>;
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (refreshCommunities) await refreshCommunities();
    } finally {
      setRefreshing(false);
    }
  }, [refreshCommunities]);

  // Group the user's communities into ordered buckets. Empty buckets are
  // omitted from render so the screen doesn't display placeholder
  // sections that would never populate.
  const grouped = useMemo(() => {
    const out = new Map<BucketKey, Community[]>();
    for (const c of myCommunities) {
      const key = bucketForType(c.type);
      const list = out.get(key) ?? [];
      list.push(c);
      out.set(key, list);
    }
    // Sort within each bucket alphabetically for stable presentation.
    for (const list of out.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [myCommunities]);

  const totalCommunities = myCommunities.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Communities</Text>
          <Text style={styles.headerSubtitle}>
            {totalCommunities} {totalCommunities === 1 ? "community" : "communities"}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {totalCommunities === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={36} color={MUTED} />
            <Text style={styles.emptyTitle}>No communities yet</Text>
            <Text style={styles.emptyBody}>
              When you join or are added to a community, it will appear here
              grouped by type.
            </Text>
          </View>
        ) : (
          BUCKET_ORDER.flatMap((key) => {
            const list = grouped.get(key);
            if (!list || list.length === 0) return [];
            const spec = BUCKETS[key];
            return (
              <View key={key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={spec.icon} size={16} color={spec.accent} />
                  <Text style={[styles.sectionTitle, { color: spec.accent }]}>
                    {spec.label}
                  </Text>
                  <Text style={styles.sectionCount}>{list.length}</Text>
                </View>

                {list.map((c) => (
                  <CommunityRow key={c.id} community={c} />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────
// Display-only. Tap is a no-op for 1a — community detail is reached via
// CommunityHub (existing surface). Phase 1b will add a tap target that
// opens the suggestion accept/decline modal when the membership row's
// source is 'inferred_*'.
const CommunityRow: React.FC<{ community: Community }> = ({ community }) => {
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate("CommunityHub" as never, {
          communityId: community.id,
        } as never)
      }
      accessibilityRole="button"
      accessibilityLabel={`Open ${community.name}`}
    >
      <Text style={styles.rowEmoji}>{community.icon ?? "👥"}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {community.name}
        </Text>
        <Text style={styles.rowMeta}>
          {community.members.toLocaleString()}{" "}
          {community.members === 1 ? "member" : "members"}
          {community.role ? ` · ${community.role}` : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={MUTED} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: NAVY,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 12 },

  section: { marginHorizontal: 12, marginBottom: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  sectionCount: {
    marginLeft: "auto",
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  rowEmoji: { fontSize: 22 },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: "700", color: NAVY },
  rowMeta: { fontSize: 12, color: MUTED, marginTop: 2 },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: NAVY, marginTop: 4 },
  emptyBody: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 19 },
});
