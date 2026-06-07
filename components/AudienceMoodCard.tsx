// =============================================================================
// AudienceMoodCard — group-level engagement snapshot for SyncRoom + HostDashboard
//
// Calls public.get_room_engagement_stats(room_id) on mount and on a 30-second
// interval. Renders:
//   - concurrent viewers (last 5 min)
//   - engagement score 0-100 (progress bar)
//   - reaction-emoji chips (last 15 min)
//   - donations total $ (last 15 min, sync_room_donations only)
//
// Visible to all room members — no host gate.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "../lib/supabase";

interface EngagementStats {
  success: boolean;
  concurrent_viewers: number;
  reactions: Record<string, number>;
  donations_cents: number;
  candle_requests: number;
  mass_intentions: number;
  engagement_score: number;
}

interface Props {
  roomId: string;
  /** Defaults to 30,000 ms. Pass a smaller value for tests. */
  refreshIntervalMs?: number;
}

const formatCents = (c: number): string =>
  `$${(c / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AudienceMoodCard: React.FC<Props> = ({
  roomId,
  refreshIntervalMs = 30000,
}) => {
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_room_engagement_stats", {
      p_room_id: roomId,
    });
    if (!error && data && (data as EngagementStats).success !== false) {
      setStats(data as EngagementStats);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, refreshIntervalMs]);

  if (!stats && loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Audience Mood</Text>
        <ActivityIndicator color={TEAL} style={{ marginTop: 8 }} />
      </View>
    );
  }
  if (!stats) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Audience Mood</Text>
        <Text style={styles.subtle}>Stats unavailable</Text>
      </View>
    );
  }

  const reactionEntries = Object.entries(stats.reactions ?? {});

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Audience Mood</Text>
        <Text style={styles.viewers}>{stats.concurrent_viewers} watching</Text>
      </View>

      {/* Engagement score (0-100). Bar clamps because the score is capped
          at 100 inside the RPC. */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Engagement</Text>
        <View style={styles.scoreTrack}>
          <View
            style={[
              styles.scoreFill,
              { width: `${Math.max(0, Math.min(100, stats.engagement_score))}%` },
            ]}
          />
        </View>
        <Text style={styles.scoreValue}>{stats.engagement_score}</Text>
      </View>

      {/* Reaction chips. Hidden when nobody has reacted in the window so the
          card doesn't ship an empty placeholder row. */}
      {reactionEntries.length > 0 && (
        <View style={styles.reactionsRow}>
          {reactionEntries.map(([emoji, count]) => (
            <View key={emoji} style={styles.reactionChip}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={styles.reactionCount}>{count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Donation total — only the sync_room_donations sum per the approved
          scope. Candle/mass donations are NOT folded in here (follow-up). */}
      {stats.donations_cents > 0 && (
        <View style={styles.donationRow}>
          <Text style={styles.donationLabel}>Donations (last 15 min)</Text>
          <Text style={styles.donationValue}>
            {formatCents(stats.donations_cents)}
          </Text>
        </View>
      )}
    </View>
  );
};

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: { fontSize: 14, fontWeight: "700", color: NAVY },
  viewers: { fontSize: 12, color: MUTED, fontWeight: "600" },
  subtle: { fontSize: 13, color: MUTED, marginTop: 4 },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  scoreLabel: { fontSize: 12, color: MUTED, width: 80 },
  scoreTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreFill: { height: "100%", backgroundColor: TEAL },
  scoreValue: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    minWidth: 32,
    textAlign: "right",
  },

  reactionsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 12, fontWeight: "600", color: "#1F2937" },

  donationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  donationLabel: { fontSize: 12, color: MUTED },
  donationValue: { fontSize: 14, fontWeight: "700", color: "#059669" },
});

export default AudienceMoodCard;
