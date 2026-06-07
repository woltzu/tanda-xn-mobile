// =============================================================================
// SyncLobbyScreen -- list of active SyncStream rooms + create CTA.
// Phase 2 of SyncStream. Pairs with SyncRoomScreen.
//
// Data:
//   * Active rooms: sync_rooms WHERE is_active AND last_active > NOW() - 1h.
//     Sort by last_active desc so "hot" rooms surface first.
//   * Member count per room: count(*) on sync_room_members for each row.
//     Done client-side in one extra round trip (one query, IN list) to
//     avoid a per-room loop.
//   * Member avatars (first 3 per room): a second query that joins
//     sync_room_members to profiles for the room ids in the list.
//
// Create modal: simple inline Modal with name input + 5 vibe chips,
// calls create_sync_room(name, vibe) RPC. On success, navigates to
// SyncRoom with the returned room_id.
//
// Realtime: a single channel on sync_rooms INSERT/UPDATE triggers a
// refetch. We don't subscribe per-room here -- that's SyncRoomScreen's
// job. The lobby just needs to know "a new room appeared" or "an
// existing one went inactive".
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  ROOM_TYPE_PRESETS,
  type RoomType,
} from "../config/sync-room-presets";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MUTED = "#6B7280";

type Vibe = "chill" | "chaos" | "learning" | "party" | "custom";

const VIBES: { id: Vibe; label: string; emoji: string; color: string }[] = [
  { id: "chill",    label: "Chill",    emoji: "🌊", color: "#3B82F6" },
  { id: "chaos",    label: "Chaos",    emoji: "🎲", color: "#EF4444" },
  { id: "learning", label: "Learning", emoji: "📚", color: "#8B5CF6" },
  { id: "party",    label: "Party",    emoji: "🎉", color: "#F59E0B" },
  { id: "custom",   label: "Custom",   emoji: "✨", color: "#10B981" },
];

type Room = {
  id: string;
  name: string;
  vibe: Vibe;
  current_content_id: string | null;
  last_active: string;
};

type MemberMini = { room_id: string; user_id: string; avatar_url: string | null; full_name: string | null };

export default function SyncLobbyScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [memberAvatars, setMemberAvatars] = useState<Record<string, MemberMini[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVibe, setNewVibe] = useState<Vibe>("chill");
  // Public/private toggle added in phase 4. Defaults to public so the
  // most common case (open to anyone) is the no-extra-tap path.
  const [newIsPublic, setNewIsPublic] = useState(true);
  // Room-type picker added in phase 5. Drives the room_settings preset
  // applied by the server when we send NULL settings. Most users land
  // on "general" so the picker collapses cleanly when not touched.
  const [newRoomType, setNewRoomType] = useState<RoomType>("general");
  const [creating, setCreating] = useState(false);

  const oneHourAgo = useMemo(
    () => new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    [], // recomputed only on mount; the predicate doesn't need to be sub-second-fresh
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // is_public=true gate added in migration 127. Private rooms are
      // discoverable only via the deep-link/invite-code path -- the
      // lobby intentionally hides them.
      const { data: roomRows, error } = await supabase
        .from("sync_rooms")
        .select("id, name, vibe, current_content_id, last_active")
        .eq("is_active", true)
        .eq("is_public", true)
        .gte("last_active", oneHourAgo)
        .order("last_active", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);
      const list = (roomRows ?? []) as Room[];
      setRooms(list);

      if (list.length === 0) {
        setMemberCounts({});
        setMemberAvatars({});
        return;
      }

      // One extra round trip for member-with-avatar joins -- cheaper
      // than a per-room loop and the limit:50 above caps the IN list.
      const roomIds = list.map((r) => r.id);
      const { data: memberRows } = await supabase
        .from("sync_room_members")
        .select("room_id, user_id, profiles:profiles(avatar_url, full_name)")
        .in("room_id", roomIds);

      const counts: Record<string, number> = {};
      const avatars: Record<string, MemberMini[]> = {};
      // PostgREST embedded selects return the joined relation as an
      // array (even on a 1:1 FK) -- so profiles is typed as
      // {avatar_url, full_name}[] and we pick the first row.
      for (const m of (memberRows ?? []) as unknown as Array<{
        room_id: string;
        user_id: string;
        profiles: Array<{ avatar_url: string | null; full_name: string | null }> | null;
      }>) {
        counts[m.room_id] = (counts[m.room_id] ?? 0) + 1;
        const arr = avatars[m.room_id] ?? [];
        if (arr.length < 3) {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : null;
          arr.push({
            room_id: m.room_id,
            user_id: m.user_id,
            avatar_url: profile?.avatar_url ?? null,
            full_name: profile?.full_name ?? null,
          });
          avatars[m.room_id] = arr;
        }
      }
      setMemberCounts(counts);
      setMemberAvatars(avatars);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Couldn't load rooms", msg);
    } finally {
      setLoading(false);
    }
  }, [oneHourAgo]);

  useEffect(() => {
    refresh();

    // Lobby-wide subscription: any INSERT/UPDATE on sync_rooms triggers
    // a refetch. Cheap because the lobby query is small (max 50 rooms).
    const ch = supabase
      .channel("sync-lobby")
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_rooms" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const onPullRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "We need a signed-in session to create a room.");
      return;
    }
    if (!newName.trim()) {
      Alert.alert("Pick a name", "Give your room a short name first.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_sync_room", {
        p_name: newName.trim(),
        p_vibe: newVibe,
        p_is_public: newIsPublic,
        p_room_type: newRoomType,
        // Pass NULL so the server applies the type-specific preset --
        // the server is the source of truth for defaults so we don't
        // double-encode the preset map on the client write path.
        // (The client-side preset map in config/sync-room-presets.ts
        // is still used for read fallbacks in SyncRoomScreen.)
        p_room_settings: null,
      });
      if (error) throw new Error(error.message);
      const result = (data ?? {}) as {
        success?: boolean;
        room_id?: string;
        invite_code?: string;
        error?: string;
      };
      if (!result.success || !result.room_id) {
        throw new Error(result.error || "Couldn't create the room");
      }
      setCreateOpen(false);
      setNewName("");
      setNewVibe("chill");
      setNewIsPublic(true);
      setNewRoomType("general");
      // Pass the invite code so the room screen can render the share
      // sheet without an extra round trip to fetch it.
      navigation.navigate("SyncRoom", {
        roomId: result.room_id,
        inviteCode: result.invite_code,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Couldn't create room", msg);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRoom = (room: Room) => {
    navigation.navigate("SyncRoom", { roomId: room.id });
  };

  const renderRoom = ({ item }: { item: Room }) => {
    const vibe = VIBES.find((v) => v.id === item.vibe) ?? VIBES[0];
    const avatars = memberAvatars[item.id] ?? [];
    const count = memberCounts[item.id] ?? 0;

    return (
      <TouchableOpacity
        style={styles.roomCard}
        onPress={() => handleOpenRoom(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
      >
        <View style={[styles.vibePill, { backgroundColor: vibe.color }]}>
          <Text style={styles.vibePillText}>
            {vibe.emoji} {vibe.label}
          </Text>
        </View>

        <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>

        <View style={styles.metaRow}>
          {/* Avatars (first 3) */}
          <View style={styles.avatarStack}>
            {avatars.map((m, i) => (
              <View
                key={m.user_id}
                style={[
                  styles.avatar,
                  { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i },
                ]}
              >
                {m.avatar_url ? (
                  <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {(m.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
            ))}
            {avatars.length === 0 ? (
              <Text style={styles.emptyAvatarText}>nobody here yet</Text>
            ) : null}
          </View>
          <Text style={styles.metaText}>
            {count} watching{item.current_content_id ? " · live" : ""}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Sync</Text>
        <TouchableOpacity
          style={styles.headerCta}
          onPress={() => setCreateOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Create room"
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        renderItem={renderRoom}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={TEAL} />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyBox}>
              <Ionicons name="play-circle-outline" size={42} color={MUTED} />
              <Text style={styles.emptyTitle}>No active rooms</Text>
              <Text style={styles.emptyBody}>
                Be the first to create one and invite friends.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => setCreateOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.emptyCtaText}>Create a room</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Create modal */}
      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create a Sync Room</Text>

            <Text style={styles.modalLabel}>Room name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Sunday Lo-Fi"
              placeholderTextColor={MUTED}
              maxLength={40}
              accessibilityLabel="Room name"
            />

            <Text style={styles.modalLabel}>Pick a vibe</Text>
            <View style={styles.vibeRow}>
              {VIBES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.vibeChip,
                    newVibe === v.id && { backgroundColor: v.color, borderColor: v.color },
                  ]}
                  onPress={() => setNewVibe(v.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newVibe === v.id }}
                >
                  <Text
                    style={[
                      styles.vibeChipText,
                      newVibe === v.id && { color: "#FFFFFF" },
                    ]}
                  >
                    {v.emoji} {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Room type</Text>
            <View style={styles.roomTypeRow}>
              {(Object.entries(ROOM_TYPE_PRESETS) as Array<[RoomType, typeof ROOM_TYPE_PRESETS[RoomType]]>).map(
                ([id, cfg]) => {
                  const active = newRoomType === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.roomTypeChip, active && styles.roomTypeChipActive]}
                      onPress={() => setNewRoomType(id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.roomTypeEmoji, active && { color: "#FFFFFF" }]}>
                        {cfg.emoji}
                      </Text>
                      <Text style={[styles.roomTypeLabel, active && { color: "#FFFFFF" }]}>
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>
            <Text style={styles.roomTypeHint} numberOfLines={2}>
              {ROOM_TYPE_PRESETS[newRoomType].description}
            </Text>

            <Text style={styles.modalLabel}>Visibility</Text>
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visBtn, newIsPublic && styles.visBtnActive]}
                onPress={() => setNewIsPublic(true)}
                accessibilityRole="button"
                accessibilityState={{ selected: newIsPublic }}
              >
                <Ionicons
                  name="globe-outline"
                  size={16}
                  color={newIsPublic ? "#FFFFFF" : NAVY}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.visBtnTitle, newIsPublic && { color: "#FFFFFF" }]}>
                    Public
                  </Text>
                  <Text style={[styles.visBtnHint, newIsPublic && { color: "rgba(255,255,255,0.8)" }]}>
                    Anyone signed in can find it.
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visBtn, !newIsPublic && styles.visBtnActive]}
                onPress={() => setNewIsPublic(false)}
                accessibilityRole="button"
                accessibilityState={{ selected: !newIsPublic }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={!newIsPublic ? "#FFFFFF" : NAVY}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.visBtnTitle, !newIsPublic && { color: "#FFFFFF" }]}>
                    Private
                  </Text>
                  <Text style={[styles.visBtnHint, !newIsPublic && { color: "rgba(255,255,255,0.8)" }]}>
                    Invite-link only.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setCreateOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreate, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.modalCreateText}>
                  {creating ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: NAVY,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  headerCta: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    justifyContent: "center",
    alignItems: "center",
  },

  roomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  vibePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  vibePillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  roomName: { fontSize: 16, fontWeight: "700", color: NAVY, marginBottom: 8 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BG,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 11, fontWeight: "700", color: NAVY },
  emptyAvatarText: { fontSize: 11, color: MUTED, fontStyle: "italic" },
  metaText: { fontSize: 12, color: MUTED, fontWeight: "600" },

  emptyBox: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: NAVY, marginTop: 8 },
  emptyBody: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 19 },
  emptyCta: {
    marginTop: 14,
    backgroundColor: TEAL,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyCtaText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 35, 66, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: NAVY, marginBottom: 4 },
  modalLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: NAVY,
  },
  vibeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vibeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  vibeChipText: { fontSize: 12, fontWeight: "600", color: NAVY },

  roomTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  roomTypeChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  roomTypeEmoji: { fontSize: 14 },
  roomTypeLabel: { fontSize: 12, fontWeight: "600", color: NAVY },
  roomTypeHint: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
    fontStyle: "italic",
  },

  visibilityRow: { flexDirection: "row", gap: 8 },
  visBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  visBtnActive: { backgroundColor: NAVY, borderColor: NAVY },
  visBtnTitle: { fontSize: 13, fontWeight: "700", color: NAVY },
  visBtnHint: { fontSize: 11, color: MUTED, marginTop: 1 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  modalCancelText: { color: NAVY, fontWeight: "700", fontSize: 14 },
  modalCreate: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: NAVY,
    alignItems: "center",
  },
  modalCreateText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
