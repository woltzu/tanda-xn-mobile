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
import { useTranslation } from "react-i18next";
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

// Phase R5 — added "reverent" for worship rooms. Existing rooms with
// vibe='custom' or unrecognised vibe values still render via the
// fallback in resolveVibe() below.
type Vibe = "chill" | "chaos" | "learning" | "party" | "custom" | "reverent";

// i18n: labelKey resolved per-render via t() so language flips re-paint
// without re-instantiating. Same pattern as DELIVERY_OPTIONS in B3a.
const VIBES: { id: Vibe; labelKey: string; emoji: string; color: string }[] = [
  { id: "chill",    labelKey: "sync_lobby.vibe_chill",    emoji: "🌊", color: "#3B82F6" },
  { id: "chaos",    labelKey: "sync_lobby.vibe_chaos",    emoji: "🎲", color: "#EF4444" },
  { id: "learning", labelKey: "sync_lobby.vibe_learning", emoji: "📚", color: "#8B5CF6" },
  { id: "party",    labelKey: "sync_lobby.vibe_party",    emoji: "🎉", color: "#F59E0B" },
  { id: "reverent", labelKey: "sync_lobby.vibe_reverent", emoji: "🕊️", color: "#D97706" },
  { id: "custom",   labelKey: "sync_lobby.vibe_custom",   emoji: "✨", color: "#10B981" },
];

// Phase R5 — Resolve the displayed vibe for a room. Order:
//   1. Direct match on the vibe column.
//   2. room_type === 'worship' implies 'reverent' even if vibe is
//      stale or unset (worship rooms were created before the
//      'reverent' option existed).
//   3. Fall through to "chill" so the pill is always coloured.
const resolveVibe = (vibe: string | null, roomType: string | null) => {
  const direct = VIBES.find((v) => v.id === vibe);
  if (direct) return direct;
  if (roomType === "worship") {
    return VIBES.find((v) => v.id === "reverent") ?? VIBES[0];
  }
  return VIBES[0];
};

// Phase R5 — Extract a YouTube video id from any common URL shape so
// we can show https://img.youtube.com/vi/{id}/mqdefault.jpg as a card
// thumbnail. Returns null for non-YouTube URLs (caller renders a
// placeholder). Logic mirrors extractYouTubeId in SyncRoomScreen so
// the lobby thumbnail and the player choose the same id.
const extractYouTubeId = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return url.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.replace("/embed/", "").split("/")[0] || null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.replace("/shorts/", "").split("/")[0] || null;
      }
    }
    return null;
  } catch {
    // Not a parseable URL -- could be a raw video id, an Instagram
    // URL, etc. We only thumbnail YouTube for now.
    return null;
  }
};

const getYouTubeThumbnail = (url: string | null): string | null => {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
};

// Five-minute heartbeat window for "active member" filtering on the
// first-3 avatars. Matches the window used in SyncRoomScreen for the
// in-room avatar row.
const ACTIVE_MEMBER_WINDOW_MS = 5 * 60 * 1000;

type Room = {
  id: string;
  name: string;
  vibe: Vibe;
  // R5 — room_type is read so we can fall back to a sensible vibe for
  // worship rooms that pre-date the 'reverent' option.
  room_type: string | null;
  current_content_id: string | null;
  last_active: string;
};

type MemberMini = { room_id: string; user_id: string; avatar_url: string | null; full_name: string | null };

export default function SyncLobbyScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
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
      // R5: also fetch room_type so the vibe fallback can map worship
      // rooms to 'reverent' when their stored vibe is stale.
      const { data: roomRows, error } = await supabase
        .from("sync_rooms")
        .select("id, name, vibe, room_type, current_content_id, last_active")
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
      // R5: filter by last_heartbeat so the "first 3 avatars" reflect
      // people actually present, not historical joiners that the cron
      // reaper hasn't pruned yet. Member count uses the same filter
      // so the displayed number matches the avatars.
      const roomIds = list.map((r) => r.id);
      const activeCutoff = new Date(
        Date.now() - ACTIVE_MEMBER_WINDOW_MS,
      ).toISOString();
      const { data: memberRows } = await supabase
        .from("sync_room_members")
        .select(
          "room_id, user_id, last_heartbeat, profiles:profiles(avatar_url, full_name)",
        )
        .in("room_id", roomIds)
        .gte("last_heartbeat", activeCutoff);

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
      Alert.alert(t("final_polish.synclobby_alert_couldn_t_load_rooms"), msg);
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
      Alert.alert(t("sync_lobby.alert_signin_title"), t("sync_lobby.alert_signin_body"));
      return;
    }
    if (!newName.trim()) {
      Alert.alert(t("sync_lobby.alert_name_title"), t("sync_lobby.alert_name_body"));
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
        throw new Error(result.error || t("sync_lobby.alert_create_failed_default"));
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
      Alert.alert(t("sync_lobby.alert_create_failed_title"), msg);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRoom = (room: Room) => {
    navigation.navigate("SyncRoom", { roomId: room.id });
  };

  const renderRoom = ({ item }: { item: Room }) => {
    const vibe = resolveVibe(item.vibe, item.room_type);
    const avatars = memberAvatars[item.id] ?? [];
    const count = memberCounts[item.id] ?? 0;
    // R5: YouTube thumbnail for the playing content. Falls through to
    // the placeholder header when current_content_id is null or not a
    // YouTube URL.
    const thumb = getYouTubeThumbnail(item.current_content_id);
    const isLive = !!item.current_content_id;

    return (
      <TouchableOpacity
        style={styles.roomCard}
        onPress={() => handleOpenRoom(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
        activeOpacity={0.8}
      >
        {/* Thumbnail strip. Always renders so card heights are uniform;
            falls back to a gradient-like placeholder when no thumbnail
            is available (live but non-YouTube, or queue empty). */}
        <View style={styles.thumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumbImg} />
          ) : (
            <View
              style={[
                styles.thumbPlaceholder,
                { backgroundColor: vibe.color + "22" }, // 13% alpha
              ]}
            >
              <Text style={styles.thumbPlaceholderEmoji}>{vibe.emoji}</Text>
            </View>
          )}
          {isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveBadgeDot} />
              <Text style={styles.liveBadgeText}>{t("sync_lobby.live_badge")}</Text>
            </View>
          ) : null}
          <View
            style={[
              styles.vibePillOnThumb,
              { backgroundColor: vibe.color },
            ]}
          >
            <Text style={styles.vibePillText}>
              {vibe.emoji} {t(vibe.labelKey)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.roomName} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.metaRow}>
            {/* Avatars (first 3 active) */}
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
                    <Image
                      source={{ uri: m.avatar_url }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(m.full_name ?? "?").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
              ))}
              <Text style={styles.metaTextInline}>
                {count > 0
                  ? t("sync_lobby.watching_count", { count })
                  : t("sync_lobby.empty_seat")}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => handleOpenRoom(item)}
              accessibilityRole="button"
              accessibilityLabel={`Join ${item.name}`}
            >
              <Text style={styles.joinBtnText}>{t("sync_lobby.join")}</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>{t("sync_lobby.header")}</Text>
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
              <Text style={styles.emptyTitle}>{t("sync_lobby.empty_title")}</Text>
              <Text style={styles.emptyBody}>{t("sync_lobby.empty_body")}</Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => setCreateOpen(true)}
                accessibilityRole="button"
              >
                <Text style={styles.emptyCtaText}>{t("sync_lobby.empty_cta")}</Text>
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
            <Text style={styles.modalTitle}>{t("sync_lobby.modal_title")}</Text>

            <Text style={styles.modalLabel}>{t("sync_lobby.label_room_name")}</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t("sync_lobby.placeholder_room_name")}
              placeholderTextColor={MUTED}
              maxLength={40}
              accessibilityLabel="Room name"
            />

            <Text style={styles.modalLabel}>{t("sync_lobby.label_pick_vibe")}</Text>
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
                    {v.emoji} {t(v.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>{t("sync_lobby.label_room_type")}</Text>
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

            <Text style={styles.modalLabel}>{t("sync_lobby.label_visibility")}</Text>
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
                    {t("sync_lobby.visibility_public")}
                  </Text>
                  <Text style={[styles.visBtnHint, newIsPublic && { color: "rgba(255,255,255,0.8)" }]}>
                    {t("sync_lobby.visibility_public_hint")}
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
                    {t("sync_lobby.visibility_private")}
                  </Text>
                  <Text style={[styles.visBtnHint, !newIsPublic && { color: "rgba(255,255,255,0.8)" }]}>
                    {t("sync_lobby.visibility_private_hint")}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setCreateOpen(false)}
              >
                <Text style={styles.modalCancelText}>{t("sync_lobby.btn_cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreate, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.modalCreateText}>
                  {creating ? t("sync_lobby.btn_creating") : t("sync_lobby.btn_create")}
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

  // R5: card has zero padding now -- the thumbnail strip fills the
  // top edge-to-edge. cardBody adds inset padding for the text + row.
  roomCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    // Subtle shadow on iOS; elevation on Android. No-op on web.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardBody: { padding: 14 },

  thumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: BG,
    position: "relative",
  },
  thumbImg: { width: "100%", height: "100%" },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholderEmoji: { fontSize: 56, opacity: 0.7 },

  // Live badge -- pulses subtly via the red dot. Sits top-left of
  // the thumbnail.
  liveBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  liveBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Vibe pill moved onto the thumbnail (top-right). Same colour
  // semantics as before; just repositioned for the new layout.
  vibePillOnThumb: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vibePillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  roomName: { fontSize: 16, fontWeight: "700", color: NAVY, marginBottom: 10 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 0,
  },
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
  metaTextInline: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "600",
    marginLeft: 8,
  },

  // R5: explicit Join button replaces the implicit "tap-the-card"
  // affordance. Whole card still navigates on press (kept for habit),
  // but the button is the discoverable action.
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

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
