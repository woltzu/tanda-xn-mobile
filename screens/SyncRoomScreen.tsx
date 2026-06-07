// =============================================================================
// SyncRoomScreen -- the shared room experience.
//
// Wires the 6 RPCs from migration 124 (+ heartbeat from 125) into a
// single screen with live realtime updates.
//
// Realtime subscriptions (all on the same channel for efficiency):
//   sync_rooms             UPDATE   -> reflect current_content_id +
//                                       content_queue changes
//   sync_room_members      INSERT/DELETE -> presence list churn
//   sync_room_votes        *        -> skip-count progress bar
//   sync_room_reactions    INSERT   -> floating emoji
//
// YouTube embed: we detect the host pattern and render via WebView with
// the embed URL. Non-YouTube URLs surface as a "Content URL" card with
// the link; broader player support is a future pass.
//
// Heartbeat: 30-second interval calls heartbeat_sync_room(roomId) so a
// future reaper cron can DELETE stale presence rows. Stops on unmount.
//
// Leave is wired to the navigation header so a back-press from the OS
// alone won't strand the row (we also pre-leave on willBlur as a belt).
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Image,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MUTED = "#6B7280";

type Vibe = "chill" | "chaos" | "learning" | "party" | "custom";

type Room = {
  id: string;
  name: string;
  vibe: Vibe;
  current_content_id: string | null;
  content_queue: Array<{ url: string; added_by?: string; added_at?: string }>;
  created_by: string;
};

type Member = {
  user_id: string;
  avatar_url: string | null;
  full_name: string | null;
};

const REACTION_EMOJI = ["👍", "😂", "😮", "❤️", "🔥"] as const;

// Pulls a YouTube video id out of common URL shapes. Returns null for
// anything we don't recognize so the screen can fall back to a generic
// "Content URL" card without crashing on null video id.
function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // /embed/<id> path
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

type SyncRoomRouteParams = { roomId: string };

export default function SyncRoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ SyncRoom: SyncRoomRouteParams }, "SyncRoom">>();
  const roomId = route.params.roomId;
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [skipCount, setSkipCount] = useState(0);
  const [hasSkipVote, setHasSkipVote] = useState(false);
  const [queueInput, setQueueInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [voting, setVoting] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [floatReaction, setFloatReaction] = useState<string | null>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;

  const isCreator = room?.created_by === user?.id;
  const memberCount = members.length;
  const threshold = Math.max(1, Math.ceil(memberCount / 2));

  // ------- Fetch helpers -------

  const fetchRoom = useCallback(async () => {
    const { data } = await supabase
      .from("sync_rooms")
      .select("id, name, vibe, current_content_id, content_queue, created_by")
      .eq("id", roomId)
      .maybeSingle();
    if (data) setRoom(data as Room);
  }, [roomId]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from("sync_room_members")
      .select("user_id, profiles:profiles(avatar_url, full_name)")
      .eq("room_id", roomId);
    const list = (data ?? []).map((m: any) => ({
      user_id: m.user_id,
      avatar_url: m.profiles?.avatar_url ?? null,
      full_name: m.profiles?.full_name ?? null,
    })) as Member[];
    setMembers(list);
  }, [roomId]);

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from("sync_room_votes")
      .select("user_id, vote_skip")
      .eq("room_id", roomId)
      .eq("vote_skip", true);
    const list = data ?? [];
    setSkipCount(list.length);
    setHasSkipVote(list.some((v: any) => v.user_id === user?.id));
  }, [roomId, user?.id]);

  // ------- Mount: join + initial fetch + realtime + heartbeat -------

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      // Make sure we're a member -- join is idempotent. Then prime
      // the three queries.
      try {
        await supabase.rpc("join_sync_room", { p_room_id: roomId });
      } catch {
        // join failure (e.g. inactive room) is surfaced via fetchRoom
        // returning null; we let the render path handle the empty state.
      }
      if (cancelled) return;
      await Promise.all([fetchRoom(), fetchMembers(), fetchVotes()]);
    })();

    // Realtime: one channel, three filters tied to roomId so the
    // server only pushes us deltas for this room.
    const ch = supabase
      .channel(`sync-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sync_rooms", filter: `id=eq.${roomId}` },
        () => { fetchRoom(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sync_room_members", filter: `room_id=eq.${roomId}` },
        () => { fetchMembers(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sync_room_votes", filter: `room_id=eq.${roomId}` },
        () => { fetchVotes(); },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sync_room_reactions", filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          const emoji = payload?.new?.emoji as string | undefined;
          if (emoji) showFloatingReaction(emoji);
        },
      )
      .subscribe();

    // Heartbeat every 30s so the reaper cron (future) can purge stale
    // members. Server returns silently on success; we don't surface
    // failures (a transient network drop shouldn't spam alerts).
    heartbeatTimer = setInterval(() => {
      supabase.rpc("heartbeat_sync_room", { p_room_id: roomId }).then(() => {});
    }, 30_000);

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      supabase.removeChannel(ch);
      // Best-effort leave. supabase.rpc returns a PostgrestFilterBuilder
      // (thenable, not Promise) so we await-wrap in an IIFE rather than
      // calling .catch on it directly.
      void (async () => {
        try {
          await supabase.rpc("leave_sync_room", { p_room_id: roomId });
        } catch {
          // unmount-path swallow
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  // ------- Floating reaction animation -------

  const showFloatingReaction = (emoji: string) => {
    setFloatReaction(emoji);
    floatAnim.setValue(0);
    Animated.timing(floatAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setFloatReaction(null));
  };

  // ------- Actions -------

  const handleAddToQueue = async () => {
    if (!queueInput.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.rpc("add_to_queue", {
        p_room_id: roomId,
        p_content_url: queueInput.trim(),
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) throw new Error(r.error || "Couldn't add to queue");
      setQueueInput("");
      // Don't fetchRoom() here -- the realtime subscription on
      // sync_rooms UPDATE will pull the new queue automatically.
    } catch (err) {
      Alert.alert("Couldn't add", err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleVoteSkip = async () => {
    if (voting || hasSkipVote) return;
    setVoting(true);
    try {
      const { error } = await supabase.rpc("vote_skip", { p_room_id: roomId });
      if (error) throw new Error(error.message);
      // The RPC may have triggered advance_content -- realtime will pull
      // both the updated room state and the cleared votes.
    } catch (err) {
      Alert.alert("Couldn't vote", err instanceof Error ? err.message : String(err));
    } finally {
      setVoting(false);
    }
  };

  const handleReact = async (emoji: string) => {
    if (reacting || !user?.id) return;
    setReacting(true);
    try {
      await supabase.from("sync_room_reactions").insert({
        room_id: roomId,
        user_id: user.id,
        emoji,
      });
      // Local optimistic float so the user sees their own reaction even
      // before the realtime echo arrives.
      showFloatingReaction(emoji);
    } catch (err) {
      // Soft fail -- reactions are decorative.
    } finally {
      setReacting(false);
    }
  };

  const handleLeave = async () => {
    try {
      await supabase.rpc("leave_sync_room", { p_room_id: roomId });
    } catch {
      // Even if leave fails, navigate back -- the unmount cleanup also
      // tries.
    }
    navigation.goBack();
  };

  const handleAdvance = async () => {
    if (!isCreator) return;
    try {
      const { error } = await supabase.rpc("advance_content", { p_room_id: roomId });
      if (error) throw new Error(error.message);
    } catch (err) {
      Alert.alert("Couldn't advance", err instanceof Error ? err.message : String(err));
    }
  };

  // ------- Render -------

  const youTubeId = useMemo(
    () => extractYouTubeId(room?.current_content_id ?? null),
    [room?.current_content_id],
  );

  if (!room) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={styles.headerBtn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleLeave}
          accessibilityRole="button"
          accessibilityLabel="Leave room"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{room.name}</Text>
          <Text style={styles.headerSub}>{room.vibe} · {memberCount} watching</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleLeave}
          accessibilityRole="button"
          accessibilityLabel="Leave"
        >
          <Ionicons name="exit-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Player */}
        <View style={styles.playerBox}>
          {youTubeId ? (
            <WebView
              style={styles.player}
              source={{ uri: `https://www.youtube.com/embed/${youTubeId}?playsinline=1` }}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
            />
          ) : room.current_content_id ? (
            <View style={styles.playerFallback}>
              <Ionicons name="link" size={28} color="#FFFFFF" />
              <Text style={styles.playerFallbackTitle}>Content URL</Text>
              <Text style={styles.playerFallbackUrl} numberOfLines={2}>
                {room.current_content_id}
              </Text>
              <Text style={styles.playerFallbackHint}>
                YouTube embeds play inline; other sources need a tap-out for now.
              </Text>
            </View>
          ) : (
            <View style={styles.playerEmpty}>
              <Ionicons name="play-skip-forward-outline" size={28} color="#FFFFFF" />
              <Text style={styles.playerEmptyText}>
                Queue is empty. Add something below.
              </Text>
            </View>
          )}

          {/* Floating reaction overlay */}
          {floatReaction ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.floatReaction,
                {
                  opacity: floatAnim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -80],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.floatReactionEmoji}>{floatReaction}</Text>
            </Animated.View>
          ) : null}
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>In the room</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {members.map((m) => (
              <View key={m.user_id} style={styles.memberCell}>
                <View style={styles.avatar}>
                  {m.avatar_url ? (
                    <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(m.full_name ?? "?").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.full_name ?? "?"}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Reactions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>React</Text>
          <View style={styles.reactionRow}>
            {REACTION_EMOJI.map((e) => (
              <TouchableOpacity
                key={e}
                style={styles.reactionBtn}
                onPress={() => handleReact(e)}
                accessibilityRole="button"
                accessibilityLabel={`React ${e}`}
              >
                <Text style={styles.reactionEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Skip vote */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Skip vote</Text>
          <View style={styles.voteCard}>
            <View style={styles.voteRow}>
              <Text style={styles.voteCount}>
                {skipCount} / {threshold}
              </Text>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  (hasSkipVote || voting) && { opacity: 0.5 },
                ]}
                onPress={handleVoteSkip}
                disabled={hasSkipVote || voting}
                accessibilityRole="button"
                accessibilityLabel="Vote to skip"
              >
                <Ionicons name="play-skip-forward" size={14} color="#FFFFFF" />
                <Text style={styles.voteBtnText}>
                  {hasSkipVote ? "Voted" : voting ? "..." : "Skip"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (skipCount / threshold) * 100)}%` },
                ]}
              />
            </View>
            {isCreator ? (
              <TouchableOpacity
                style={styles.adminAdvance}
                onPress={handleAdvance}
                accessibilityLabel="Admin: advance content"
              >
                <Text style={styles.adminAdvanceText}>Advance now (creator)</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Queue */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Up next</Text>
          {room.content_queue?.length ? (
            room.content_queue.map((q, i) => (
              <View key={`${q.url}-${i}`} style={styles.queueRow}>
                <Text style={styles.queueIdx}>{i + 1}</Text>
                <Text style={styles.queueUrl} numberOfLines={1}>{q.url}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.queueEmpty}>Nothing queued yet.</Text>
          )}

          <View style={styles.queueInputRow}>
            <TextInput
              style={styles.queueInput}
              value={queueInput}
              onChangeText={setQueueInput}
              placeholder="Paste a YouTube URL"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Add to queue input"
            />
            <TouchableOpacity
              style={[styles.queueAdd, (adding || !queueInput.trim()) && { opacity: 0.5 }]}
              onPress={handleAddToQueue}
              disabled={adding || !queueInput.trim()}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: NAVY,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  headerBtn: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  playerBox: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000000",
    position: "relative",
  },
  player: { flex: 1 },
  playerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 4,
  },
  playerFallbackTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginTop: 6 },
  playerFallbackUrl: { color: "#FFFFFF", fontSize: 12, textAlign: "center" },
  playerFallbackHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
  playerEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  playerEmptyText: { color: "rgba(255,255,255,0.85)", fontSize: 13 },

  floatReaction: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
  },
  floatReactionEmoji: { fontSize: 44 },

  section: { paddingHorizontal: 16, paddingTop: 14 },
  sectionLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  memberCell: { alignItems: "center", width: 56 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 14, fontWeight: "700", color: NAVY },
  memberName: { fontSize: 11, color: NAVY, marginTop: 4, maxWidth: 56 },

  reactionRow: { flexDirection: "row", gap: 8 },
  reactionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: { fontSize: 22 },

  voteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  voteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  voteCount: { fontSize: 14, fontWeight: "700", color: NAVY },
  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  voteBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },

  progressBar: {
    height: 6,
    backgroundColor: BG,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 10,
  },
  progressFill: { height: 6, backgroundColor: TEAL },

  adminAdvance: { marginTop: 10, alignSelf: "flex-end" },
  adminAdvanceText: { color: TEAL, fontSize: 12, fontWeight: "700" },

  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 6,
  },
  queueIdx: {
    width: 22,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
  },
  queueUrl: { flex: 1, fontSize: 12, color: NAVY },
  queueEmpty: { fontSize: 12, color: MUTED, fontStyle: "italic", marginBottom: 6 },

  queueInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  queueInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: NAVY,
    backgroundColor: "#FFFFFF",
  },
  queueAdd: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
});
