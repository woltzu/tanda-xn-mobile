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
  Share,
  Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import AudienceMoodCard from "../components/AudienceMoodCard";
import {
  resolveRoomSettings,
  DEFAULT_REACTION_EMOJIS,
  type RoomSettings,
  type RoomType,
} from "../config/sync-room-presets";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_SECONDS = 30;

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
  // Added by migration 127.
  is_public?: boolean;
  invite_code?: string | null;
  // Added by migration 128 (phase 5).
  room_type?: RoomType | string;
  room_settings?: Partial<RoomSettings> | null;
  ended_at?: string | null;
};

type Member = {
  user_id: string;
  avatar_url: string | null;
  full_name: string | null;
};

// Reactions are now per-room (driven by room_settings.reaction_emojis,
// resolved against the room_type preset). The constant below is the
// safety-net default used only if both the room row and the preset
// resolution produce nothing useful.
const FALLBACK_REACTIONS = DEFAULT_REACTION_EMOJIS;

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

type SyncRoomRouteParams = {
  roomId: string;
  // Optional inviteCode -- set when the screen is entered via a deep
  // link (tandaxn://sync-room?id=...&invite=...) or right after create.
  // Passed straight through to join_sync_room so private-room joins
  // succeed in the same flow as public-room joins.
  inviteCode?: string;
};

export default function SyncRoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ SyncRoom: SyncRoomRouteParams }, "SyncRoom">>();
  const roomId = route.params.roomId;
  const inviteCode = route.params.inviteCode ?? null;
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [skipCount, setSkipCount] = useState(0);
  const [hasSkipVote, setHasSkipVote] = useState(false);
  const [queueInput, setQueueInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [voting, setVoting] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [floatReaction, setFloatReaction] = useState<string | null>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Worship-extension state (phase 6).
  const [reactionPrefs, setReactionPrefs] = useState<Record<string, number>>({});
  // Phase R1 — inline editor for the per-emoji donation amount. Long-pressing
  // a reaction button opens a small modal with +/- steppers (mirrors the
  // DonationPreferencesScreen pattern so the storage call site is identical).
  // editingEmoji = null hides the modal; non-null = the emoji being edited.
  const [editingEmoji, setEditingEmoji] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [candleOpen, setCandleOpen] = useState(false);
  const [candleIntention, setCandleIntention] = useState("");
  const [candleDonation, setCandleDonation] = useState("0");
  const [submittingCandle, setSubmittingCandle] = useState(false);
  const [candleSuccess, setCandleSuccess] = useState(false);   // drives the flame modal
  const candleAnim = useRef(new Animated.Value(0)).current;

  const [massOpen, setMassOpen] = useState(false);
  const [massName, setMassName] = useState("");
  const [massIsDeceased, setMassIsDeceased] = useState(false);
  const [massDate, setMassDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [massShowPicker, setMassShowPicker] = useState(false);
  const [massDonation, setMassDonation] = useState("10");      // dollars; default $10
  const [submittingMass, setSubmittingMass] = useState(false);

  const isCreator = room?.created_by === user?.id;
  const memberCount = members.length;
  const threshold = Math.max(1, Math.ceil(memberCount / 2));

  // Resolve room settings (with preset fallback for legacy rows that
  // pre-date phase 5). Memoize so the reaction array reference stays
  // stable across re-renders.
  const settings = useMemo(
    () => resolveRoomSettings(room?.room_type, room?.room_settings),
    [room?.room_type, room?.room_settings],
  );
  const reactions = settings.reaction_emojis.length > 0
    ? settings.reaction_emojis
    : FALLBACK_REACTIONS;
  const skipDisabledByType = !settings.auto_skip_allowed;
  const skipHostOnly = settings.skip_voter_role === "host_only";
  const skipBlocked = skipDisabledByType || (skipHostOnly && !isCreator);
  const isEnded = !!room?.ended_at;

  // ------- Fetch helpers -------

  const fetchRoom = useCallback(async () => {
    const { data } = await supabase
      .from("sync_rooms")
      .select(
        "id, name, vibe, current_content_id, content_queue, created_by, " +
          "is_public, invite_code, room_type, room_settings, ended_at",
      )
      .eq("id", roomId)
      .maybeSingle();
    if (data) setRoom(data as unknown as Room);
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
      // Make sure we're a member -- join is idempotent. The invite
      // code passes through unconditionally; the server ignores it on
      // public rooms and uses it on private ones.
      try {
        const { data: joinData } = await supabase.rpc("join_sync_room", {
          p_room_id: roomId,
          p_invite_code: inviteCode,
        });
        const r = (joinData ?? {}) as { success?: boolean; error?: string };
        if (r.success === false && r.error === "invite_required") {
          // Surface the gate so a user who deep-linked without the code
          // gets a clear "ask your friend for the link" message instead
          // of silently failing to join.
          Alert.alert(
            "Invite required",
            "This room is private. Ask the host to share the invite link.",
          );
        }
      } catch {
        // join failure surfaces via fetchRoom returning null; empty
        // state handles the render.
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

    // Load the user's per-emoji donation amounts so handleReact can
    // show "Donated 5¢" feedback without an extra round trip per tap.
    void (async () => {
      try {
        const { data } = await supabase.rpc("get_user_reaction_preferences");
        const r = (data ?? {}) as { preferences?: Record<string, number> };
        if (!cancelled && r.preferences) setReactionPrefs(r.preferences);
      } catch {
        // Silent fallback to empty -- handleReact will just not show a
        // donation amount.
      }
    })();

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
    if (voting || hasSkipVote || skipBlocked) return;
    setVoting(true);
    try {
      const { data, error } = await supabase.rpc("vote_skip", { p_room_id: roomId });
      if (error) throw new Error(error.message);
      // Server can reject for two reasons even when the client thought
      // it was allowed: legacy room with stale room_settings, or a
      // race against an end_sync_room call. Surface either as an
      // alert so the user understands why their tap was a no-op.
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (r.success === false) {
        const msg =
          r.error === "skip_not_allowed"
            ? "Skip is disabled for this room type."
            : r.error === "skip_host_only"
              ? "Only the host can skip in this room."
              : r.error || "Vote rejected.";
        Alert.alert("Couldn't vote", msg);
      }
    } catch (err) {
      Alert.alert("Couldn't vote", err instanceof Error ? err.message : String(err));
    } finally {
      setVoting(false);
    }
  };

  const handleEndRoom = async () => {
    if (!isCreator || isEnded) return;
    Alert.alert(
      "End the room?",
      "Members lose the live stream. Reactions stay; the room drops from the lobby.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc("end_sync_room", { p_room_id: roomId });
              if (error) throw new Error(error.message);
              navigation.goBack();
            } catch (err) {
              Alert.alert(
                "Couldn't end",
                err instanceof Error ? err.message : String(err),
              );
            }
          },
        },
      ],
    );
  };

  // Phase R1 — adjust the user's stored donation amount for a single emoji.
  // Optimistic local update + RPC + revert on failure. `editSaving` guards
  // against concurrent in-flight saves so a long press-hold on +/- doesn't
  // pile up RPC calls. Matches the pattern in DonationPreferencesScreen.
  const handleAdjustReactionAmount = async (emoji: string, delta: number) => {
    if (editSaving) return;
    const current = reactionPrefs[emoji] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;

    setEditSaving(true);
    setReactionPrefs((prev) => ({ ...prev, [emoji]: next }));
    try {
      const { data, error } = await supabase.rpc("set_user_reaction_preference", {
        p_emoji: emoji,
        p_amount_cents: next,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) throw new Error(r.error ?? "Couldn't save");
    } catch (err) {
      setReactionPrefs((prev) => ({ ...prev, [emoji]: current }));
      Alert.alert(
        "Couldn't update amount",
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleReact = async (emoji: string) => {
    if (reacting || !user?.id) return;
    setReacting(true);
    try {
      // Always log the reaction (so the floating echo appears for
      // every room member). Insert in parallel with the donation RPC --
      // they don't depend on each other.
      const reactionInsert = supabase.from("sync_room_reactions").insert({
        room_id: roomId,
        user_id: user.id,
        emoji,
      });

      let donationResult: { donated?: boolean; amount_cents?: number; error?: string } = {};
      if ((reactionPrefs[emoji] ?? 0) > 0) {
        const { data } = await supabase.rpc("send_reaction_donation", {
          p_room_id: roomId,
          p_emoji: emoji,
        });
        donationResult = (data ?? {}) as typeof donationResult;
      }
      await reactionInsert;

      showFloatingReaction(emoji);

      if (donationResult.error === "insufficient_balance") {
        Alert.alert("Top up to give", "Your wallet doesn't cover this donation.");
      }
    } catch {
      // Soft fail -- reactions are decorative.
    } finally {
      setReacting(false);
    }
  };

  const handleSubmitCandle = async () => {
    if (submittingCandle) return;
    const intention = candleIntention.trim();
    if (!intention) {
      Alert.alert("Add your intention", "What would you like the candle lit for?");
      return;
    }
    const cents = Math.max(0, Math.round(parseFloat(candleDonation || "0") * 100));
    setSubmittingCandle(true);
    try {
      const { data, error } = await supabase.rpc("request_candle", {
        p_room_id: roomId,
        p_intention: intention,
        p_donation_cents: cents,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) {
        if (r.error === "insufficient_balance") {
          throw new Error("Your wallet doesn't cover this donation.");
        }
        throw new Error(r.error || "Couldn't submit");
      }
      // Close the form modal, show the flame animation modal.
      setCandleOpen(false);
      setCandleIntention("");
      setCandleDonation("0");
      setCandleSuccess(true);
      candleAnim.setValue(0);
      Animated.sequence([
        Animated.timing(candleAnim, {
          toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(candleAnim, {
          toValue: 0, duration: 500, useNativeDriver: true,
        }),
      ]).start(() => setCandleSuccess(false));
    } catch (err) {
      Alert.alert("Couldn't request", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingCandle(false);
    }
  };

  const handleSubmitMass = async () => {
    if (submittingMass) return;
    const name = massName.trim();
    if (!name) {
      Alert.alert("Who is the mass for?", "Add the name of the person.");
      return;
    }
    const cents = Math.max(0, Math.round(parseFloat(massDonation || "0") * 100));
    setSubmittingMass(true);
    try {
      const { data, error } = await supabase.rpc("request_mass_intention", {
        p_room_id: roomId,
        p_name: name,
        p_is_deceased: massIsDeceased,
        p_preferred_date: massDate.toISOString().slice(0, 10),
        p_donation_cents: cents,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) {
        if (r.error === "insufficient_balance") {
          throw new Error("Your wallet doesn't cover this donation.");
        }
        throw new Error(r.error || "Couldn't submit");
      }
      setMassOpen(false);
      setMassName("");
      setMassIsDeceased(false);
      Alert.alert("Submitted", "Your mass intention has been added.");
    } catch (err) {
      Alert.alert("Couldn't request", err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingMass(false);
    }
  };

  const handleShareInvite = async () => {
    if (!room?.invite_code) {
      Alert.alert("Couldn't share", "Invite code is still loading.");
      return;
    }
    const url =
      `tandaxn://sync-room?id=${roomId}&invite=${encodeURIComponent(room.invite_code)}`;
    const label = room.is_public === false ? "private room" : "room";
    try {
      await Share.share({
        message:
          `Join my ${label} on TandaXn -- "${room.name}". ` +
          `Tap the link to drop in: ${url}`,
      });
    } catch (err) {
      Alert.alert("Couldn't share", err instanceof Error ? err.message : String(err));
    }
  };

  const handleUploadVideo = async () => {
    if (uploading || !user?.id) return;
    setUploading(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow library access to upload a video.",
        );
        return;
      }

      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: MAX_UPLOAD_SECONDS,
        quality: 0.8,
        allowsEditing: false,
      });
      if (pick.canceled || !pick.assets?.length) return;

      const asset = pick.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
        Alert.alert(
          "Too large",
          `That file is over the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB cap. Trim it and try again.`,
        );
        return;
      }
      if (asset.duration && asset.duration > MAX_UPLOAD_SECONDS * 1000) {
        Alert.alert(
          "Too long",
          `Videos must be ${MAX_UPLOAD_SECONDS}s or shorter.`,
        );
        return;
      }

      // Convert the local file URI to a blob the storage client can
      // upload. fetch(uri).blob() is the React Native idiom -- works
      // for file:// and content:// (Android) URIs.
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();

      // Path layout: <userId>/<roomId>_<timestamp>.mp4. The storage
      // RLS policy requires the first folder segment to equal
      // auth.uid()::text, which prevents a malicious client from
      // overwriting someone else's video.
      const ts = Math.floor(Date.now() / 1000);
      const path = `${user.id}/${roomId}_${ts}.mp4`;

      const { error: upErr } = await supabase.storage
        .from("room-videos")
        .upload(path, blob, {
          contentType: "video/mp4",
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from("room-videos").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { data: queueData, error: queueErr } = await supabase.rpc("add_to_queue", {
        p_room_id: roomId,
        p_content_url: publicUrl,
      });
      if (queueErr) throw new Error(queueErr.message);
      const r = (queueData ?? {}) as { success?: boolean; error?: string };
      if (!r.success) throw new Error(r.error || "Couldn't queue uploaded video");

      Alert.alert("Uploaded", "Your video is in the queue.");
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
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
          <Text style={styles.headerSub}>
            {room.vibe} · {memberCount} watching
            {room.is_public === false ? " · private" : ""}
          </Text>
        </View>
        {isCreator ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate("HostDashboard" as never, { roomId } as never)}
            accessibilityRole="button"
            accessibilityLabel="Host dashboard"
          >
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleShareInvite}
          accessibilityRole="button"
          accessibilityLabel="Share invite"
        >
          <Ionicons name="share-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
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

          {/* Scripture overlay (Phase 6b) — host sets via
              set_scripture_overlay RPC; viewers see the text reactively
              because SyncRoomScreen already subscribes to sync_rooms
              UPDATE and re-fetches room on any change. Empty / missing
              key renders nothing. */}
          {(() => {
            const scripture =
              ((room?.room_settings as { scripture_overlay_text?: string } | null)
                ?.scripture_overlay_text ?? "").trim();
            if (!scripture) return null;
            return (
              <View style={styles.scriptureOverlay} pointerEvents="none">
                <Text style={styles.scriptureText} numberOfLines={3}>
                  {scripture}
                </Text>
              </View>
            );
          })()}
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

        {/* Audience Mood (Phase 6b) — group stats from
            get_room_engagement_stats. Visible to all room members; the
            host sees the same data (no extra fields). Refreshes every
            30 seconds via the card's own timer. */}
        <AudienceMoodCard roomId={roomId} />

        {/* Reactions -- driven by the room's room_settings.reaction_emojis
            with a preset fallback for legacy rooms. Each button now
            also shows the user's per-emoji donation amount underneath
            if they've configured one (Profile -> Donation Preferences). */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>React</Text>
          <View style={styles.reactionRow}>
            {reactions.map((e) => {
              const cents = reactionPrefs[e] ?? 0;
              return (
                <TouchableOpacity
                  key={e}
                  style={styles.reactionBtn}
                  onPress={() => handleReact(e)}
                  // Phase R1 — long-press opens the in-room amount editor.
                  onLongPress={() => setEditingEmoji(e)}
                  delayLongPress={400}
                  accessibilityRole="button"
                  accessibilityLabel={`React ${e}, long press to change amount`}
                >
                  <Text style={styles.reactionEmoji}>{e}</Text>
                  {cents > 0 ? (
                    <Text style={styles.reactionPrice}>
                      {cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents}¢`}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Worship actions (visible on worship rooms only). */}
        {room.room_type === "worship" ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Worship actions</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setCandleOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Light a candle"
              >
                <Text style={styles.actionEmoji}>🕯️</Text>
                <Text style={styles.actionLabel}>Light a candle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setMassOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Request a mass"
              >
                <Text style={styles.actionEmoji}>✝️</Text>
                <Text style={styles.actionLabel}>Request mass</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Skip vote. Disabled (with explanation) when room_settings
            says so, or when only the host may vote and we're not. */}
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
                  (hasSkipVote || voting || skipBlocked) && { opacity: 0.5 },
                ]}
                onPress={handleVoteSkip}
                disabled={hasSkipVote || voting || skipBlocked}
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
            {skipBlocked ? (
              <Text style={styles.skipHint}>
                {skipDisabledByType
                  ? "Skip is off for this room type."
                  : "Only the host can skip in this room."}
              </Text>
            ) : null}
            {isCreator ? (
              <View style={styles.creatorActions}>
                <TouchableOpacity
                  style={styles.adminAdvance}
                  onPress={handleAdvance}
                  accessibilityLabel="Advance content"
                >
                  <Text style={styles.adminAdvanceText}>Advance now</Text>
                </TouchableOpacity>
                {!isEnded ? (
                  <TouchableOpacity
                    style={styles.endRoomBtn}
                    onPress={handleEndRoom}
                    accessibilityLabel="End the room"
                  >
                    <Ionicons name="stop-circle-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.endRoomText}>End room</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.endedTag}>Ended</Text>
                )}
              </View>
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

          {/* Upload from device (room-videos bucket, 50 MB / 30 s cap
              enforced both client-side here and server-side by the
              storage bucket config in migration 127). */}
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
            onPress={handleUploadVideo}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Upload a video"
          >
            <Ionicons name="cloud-upload-outline" size={16} color={NAVY} />
            <Text style={styles.uploadBtnText}>
              {uploading ? "Uploading..." : "Upload a video (up to 30s)"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Candle request modal */}
      <Modal
        visible={candleOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submittingCandle && setCandleOpen(false)}
      >
        <View style={styles.worshipBackdrop}>
          <View style={styles.worshipCard}>
            <Text style={styles.worshipTitle}>🕯️ Light a candle</Text>
            <Text style={styles.worshipLabel}>Intention</Text>
            <TextInput
              style={styles.worshipInput}
              value={candleIntention}
              onChangeText={setCandleIntention}
              placeholder="For peace, for my family…"
              placeholderTextColor={MUTED}
              multiline
              maxLength={200}
            />
            <Text style={styles.worshipLabel}>Donation (optional, in dollars)</Text>
            <TextInput
              style={styles.worshipInput}
              value={candleDonation}
              onChangeText={setCandleDonation}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={MUTED}
              maxLength={8}
            />
            <View style={styles.worshipActions}>
              <TouchableOpacity
                style={styles.worshipCancel}
                onPress={() => !submittingCandle && setCandleOpen(false)}
              >
                <Text style={styles.worshipCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.worshipSubmit, submittingCandle && { opacity: 0.6 }]}
                onPress={handleSubmitCandle}
                disabled={submittingCandle}
              >
                <Text style={styles.worshipSubmitText}>
                  {submittingCandle ? "Sending…" : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mass intention modal */}
      <Modal
        visible={massOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submittingMass && setMassOpen(false)}
      >
        <View style={styles.worshipBackdrop}>
          <View style={styles.worshipCard}>
            <Text style={styles.worshipTitle}>✝️ Request a mass</Text>
            <Text style={styles.worshipLabel}>For whom</Text>
            <TextInput
              style={styles.worshipInput}
              value={massName}
              onChangeText={setMassName}
              placeholder="Full name"
              placeholderTextColor={MUTED}
              maxLength={80}
            />
            <View style={styles.worshipRow}>
              <TouchableOpacity
                style={[styles.worshipChip, !massIsDeceased && styles.worshipChipActive]}
                onPress={() => setMassIsDeceased(false)}
              >
                <Text style={[styles.worshipChipText, !massIsDeceased && { color: "#FFFFFF" }]}>
                  Living
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.worshipChip, massIsDeceased && styles.worshipChipActive]}
                onPress={() => setMassIsDeceased(true)}
              >
                <Text style={[styles.worshipChipText, massIsDeceased && { color: "#FFFFFF" }]}>
                  Deceased
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.worshipLabel}>Preferred date</Text>
            <TouchableOpacity
              style={styles.worshipInput}
              onPress={() => setMassShowPicker(true)}
            >
              <Text style={{ color: NAVY }}>{massDate.toISOString().slice(0, 10)}</Text>
            </TouchableOpacity>
            {massShowPicker ? (
              <DateTimePicker
                value={massDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(_e, d) => {
                  setMassShowPicker(false);
                  if (d) setMassDate(d);
                }}
              />
            ) : null}
            <Text style={styles.worshipLabel}>Donation (in dollars)</Text>
            <TextInput
              style={styles.worshipInput}
              value={massDonation}
              onChangeText={setMassDonation}
              keyboardType="decimal-pad"
              placeholder="10"
              placeholderTextColor={MUTED}
              maxLength={8}
            />
            <View style={styles.worshipActions}>
              <TouchableOpacity
                style={styles.worshipCancel}
                onPress={() => !submittingMass && setMassOpen(false)}
              >
                <Text style={styles.worshipCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.worshipSubmit, submittingMass && { opacity: 0.6 }]}
                onPress={handleSubmitMass}
                disabled={submittingMass}
              >
                <Text style={styles.worshipSubmitText}>
                  {submittingMass ? "Sending…" : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Candle success animation */}
      <Modal visible={candleSuccess} transparent animationType="fade">
        <Animated.View
          style={[
            styles.candleAnimBackdrop,
            {
              opacity: candleAnim,
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.candleAnimFlame,
              {
                transform: [
                  { scale: candleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) },
                ],
              },
            ]}
          >
            🕯️
          </Animated.Text>
          <Text style={styles.candleAnimText}>
            Your candle has been lit in the church
          </Text>
        </Animated.View>
      </Modal>

      {/* Phase R1 — in-room donation amount editor. Opened via long-press
          on a reaction button. Stepper rows mirror DonationPreferencesScreen
          so the storage call site (set_user_reaction_preference) and step
          values stay aligned. */}
      <Modal
        visible={editingEmoji !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !editSaving && setEditingEmoji(null)}
      >
        <View style={styles.worshipBackdrop}>
          <View style={styles.worshipCard}>
            {(() => {
              const emoji = editingEmoji ?? "";
              const cents = reactionPrefs[emoji] ?? 0;
              const label =
                cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents}¢`;
              return (
                <>
                  <Text style={styles.worshipTitle}>
                    {emoji}  Donation amount
                  </Text>
                  <Text style={styles.reactionEditAmount}>{label}</Text>
                  <Text style={styles.reactionEditHint}>
                    Tap to adjust. Saves automatically.
                  </Text>

                  <View style={styles.reactionStepperRow}>
                    {[100, 25, 10, 5, 1].map((step) => (
                      <TouchableOpacity
                        key={`minus-${step}`}
                        style={styles.reactionStepBtn}
                        onPress={() => handleAdjustReactionAmount(emoji, -step)}
                        disabled={editSaving || cents === 0}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease by ${step} cents`}
                      >
                        <Text style={styles.reactionStepBtnText}>-{step}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.reactionStepperRow}>
                    {[1, 5, 10, 25, 100].map((step) => (
                      <TouchableOpacity
                        key={`plus-${step}`}
                        style={[styles.reactionStepBtn, styles.reactionStepBtnPlus]}
                        onPress={() => handleAdjustReactionAmount(emoji, step)}
                        disabled={editSaving}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase by ${step} cents`}
                      >
                        <Text style={styles.reactionStepBtnTextPlus}>+{step}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.worshipActions}>
                    <TouchableOpacity
                      style={styles.worshipSubmit}
                      onPress={() => setEditingEmoji(null)}
                      disabled={editSaving}
                    >
                      <Text style={styles.worshipSubmitText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
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

  // Scripture overlay (Phase 6b). Anchored to the bottom of the player
  // box, full-width, semi-transparent black background, white text.
  // pointerEvents="none" on the View itself so taps pass through to the
  // player.
  scriptureOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scriptureText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    fontStyle: "italic",
  },

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

  skipHint: { marginTop: 8, fontSize: 11, color: MUTED, fontStyle: "italic" },

  creatorActions: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  adminAdvance: { paddingVertical: 4 },
  adminAdvanceText: { color: TEAL, fontSize: 12, fontWeight: "700" },
  endRoomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  endRoomText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  endedTag: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    fontStyle: "italic",
  },

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
  reactionPrice: {
    fontSize: 10,
    fontWeight: "700",
    color: TEAL,
    marginTop: 2,
  },

  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 12, fontWeight: "700", color: NAVY },

  worshipBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  worshipCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  worshipTitle: { fontSize: 17, fontWeight: "700", color: NAVY, marginBottom: 6 },
  worshipLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  worshipInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: NAVY,
    minHeight: 44,
  },
  worshipRow: { flexDirection: "row", gap: 8 },
  worshipChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  worshipChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  worshipChipText: { fontSize: 12, fontWeight: "700", color: NAVY },
  worshipActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  worshipCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  worshipCancelText: { color: NAVY, fontWeight: "700" },
  worshipSubmit: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: NAVY,
    alignItems: "center",
  },
  worshipSubmitText: { color: "#FFFFFF", fontWeight: "700" },

  // Phase R1 — donation amount editor
  reactionEditAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
    marginTop: 8,
  },
  reactionEditHint: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  reactionStepperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 8,
  },
  reactionStepBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  reactionStepBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  reactionStepBtnPlus: {
    backgroundColor: "#F0FDFA",
    borderColor: TEAL,
  },
  reactionStepBtnTextPlus: {
    fontSize: 12,
    fontWeight: "700",
    color: TEAL,
  },

  candleAnimBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  candleAnimFlame: { fontSize: 90 },
  candleAnimText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 32,
  },

  uploadBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadBtnText: { fontSize: 13, fontWeight: "700", color: NAVY },
});
