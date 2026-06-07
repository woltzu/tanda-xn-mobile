// =============================================================================
// ActiveViewersList — horizontal avatar list of room members with
// last_heartbeat in the past 5 minutes.
//
// Used both as a visible-to-everyone presence indicator on SyncRoomScreen
// and as the host's tap-to-open-history surface on HostDashboardScreen.
// The onViewerPress prop drives that distinction — when omitted, the
// avatars render as non-interactive (no host-only modal exposure).
//
// Subscribes to sync_room_members for the room so joins/leaves and
// heartbeat updates reflect immediately without polling.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { supabase } from "../lib/supabase";

interface Viewer {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  roomId: string;
  /** When provided, viewer cells become tappable. Omit for read-only. */
  onViewerPress?: (viewerId: string) => void;
  /** Defaults to "Active Viewers". */
  title?: string;
}

const FIVE_MIN_MS = 5 * 60 * 1000;

const ActiveViewersList: React.FC<Props> = ({
  roomId,
  onViewerPress,
  title = "Active Viewers",
}) => {
  const [viewers, setViewers] = useState<Viewer[]>([]);

  const refresh = useCallback(async () => {
    // Filter client-side on last_heartbeat because the supabase-js .gt()
    // filter needs an ISO string that we recompute on each refresh.
    const cutoff = new Date(Date.now() - FIVE_MIN_MS).toISOString();
    const { data } = await supabase
      .from("sync_room_members")
      .select(
        "user_id, last_heartbeat, profiles:profiles(full_name, avatar_url)"
      )
      .eq("room_id", roomId)
      .gt("last_heartbeat", cutoff);
    const list: Viewer[] = (data ?? []).map((row: any) => ({
      user_id: row.user_id,
      full_name: row.profiles?.full_name ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
    }));
    setViewers(list);
  }, [roomId]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`active-viewers:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_room_members",
          filter: `room_id=eq.${roomId}`,
        },
        () => refresh()
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [refresh, roomId]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>
          {viewers.length} {viewers.length === 1 ? "viewer" : "viewers"}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {viewers.length === 0 ? (
          <Text style={styles.emptyText}>No active viewers right now</Text>
        ) : (
          viewers.map((v) => {
            const cell = (
              <View style={styles.viewerCell}>
                <View style={styles.avatar}>
                  {v.avatar_url ? (
                    <Image
                      source={{ uri: v.avatar_url }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(v.full_name ?? "?").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.viewerName} numberOfLines={1}>
                  {v.full_name ?? "Anonymous"}
                </Text>
              </View>
            );
            return onViewerPress ? (
              <TouchableOpacity
                key={v.user_id}
                onPress={() => onViewerPress(v.user_id)}
                accessibilityRole="button"
                accessibilityLabel={`Open history for ${v.full_name ?? "viewer"}`}
              >
                {cell}
              </TouchableOpacity>
            ) : (
              <View key={v.user_id}>{cell}</View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const NAVY = "#0A2342";
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
  count: { fontSize: 12, color: MUTED, fontWeight: "600" },
  row: { gap: 12, paddingHorizontal: 2, paddingVertical: 2 },
  viewerCell: { alignItems: "center", width: 64 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  viewerName: { fontSize: 11, color: "#1F2937", marginTop: 4, textAlign: "center" },
  emptyText: { fontSize: 13, color: MUTED, paddingVertical: 8 },
});

export default ActiveViewersList;
