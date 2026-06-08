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
//   sync_room_reactions    INSERT   -> floating emoji + per-avatar
//                                       popup + auto-skip timer reset
//   sync_room_remixes      INSERT   -> floating sticker overlay (R4a)
// (sync_room_votes subscription removed in Phase R3 along with the
// manual skip-vote UI.)
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
  // Phase R2 — used by the avatar row to filter to recently-active members
  // and to render the "green dot" liveness indicator. ISO string from
  // sync_room_members.last_heartbeat.
  last_heartbeat: string | null;
};

// Phase R2 — one entry per in-flight reaction popup. Multiple can be
// active simultaneously (different users reacting, or the same user
// reacting twice in quick succession). Each carries its own Animated.Value
// so the timeline of each animation is independent.
type AvatarReactionAnim = {
  id: string;
  user_id: string;
  emoji: string;
  anim: Animated.Value;
};

// Liveness windows. Mirror the cron-reaper window (5 min) for "active"
// and a tighter 2 min for the green-dot "in the room right now" badge.
const ACTIVE_MEMBER_WINDOW_MS = 5 * 60 * 1000;
const FRESH_HEARTBEAT_WINDOW_MS = 2 * 60 * 1000;

// Phase R3 — group-attention timeout. Auto-skip triggers if the host's
// client sees no reaction inserts in this window. Per-room override via
// room_settings.auto_skip_timeout_seconds when present.
const DEFAULT_AUTO_SKIP_TIMEOUT_MS = 30 * 1000;
const AUTO_SKIP_NOTICE_MS = 2_500;

// Phase R4a — Swarm remix sticker palette. Static list for now; a future
// commit can promote this to per-room settings so hosts can curate a set
// that matches the vibe of their room. Emojis only — voice notes and
// short video replies arrive in R4b/R4c via the same sync_room_remixes
// table.
const REMIX_STICKERS = ["💥", "🎉", "😂", "❤️‍🔥", "🙌", "🤣", "🥳", "💀"];
// How long the floating sticker overlay stays visible (ms). Slightly
// longer than the floating-reaction echo because the sticker is larger
// and meant to draw attention.
const STICKER_OVERLAY_MS = 2_500;

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
  // Phase R3 — skipCount/hasSkipVote/voting + vote_skip RPC removed.
  // Manual-vote skip is gone; auto-skip (below) handles it now.
  const [queueInput, setQueueInput] = useState("");
  const [adding, setAdding] = useState(false);
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

  // Phase R2 — per-avatar reaction popups. Each entry is a self-contained
  // animation that scales + fades the emoji over its owner's avatar.
  // Cleared automatically when the animation finishes (start callback).
  const [avatarReactionAnims, setAvatarReactionAnims] = useState<
    AvatarReactionAnim[]
  >([]);

  // Phase R3 — group-attention auto-skip. The host's client runs a
  // 30-second timer; any reaction resets it. On expiry we call
  // advance_content (same RPC as the manual "Advance now" button) and
  // briefly show an in-room banner. Only the host runs the timer so
  // there's no concurrent-advance race between member clients.
  const attentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSkipNotice, setAutoSkipNotice] = useState<string | null>(null);
  const autoSkipNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase R4a — Swarm remix. The bottom-sheet modal lets the user pick a
  // sticker; the floating overlay renders any sticker that lands (own
  // taps fire an optimistic overlay, others land via realtime). One
  // sticker at a time -- a second arrival cancels the first by resetting
  // the same Animated.Value; acceptable trade-off for the MVP.
  const [remixSheetVisible, setRemixSheetVisible] = useState(false);
  const [pickingSticker, setPickingSticker] = useState(false);
  const [floatingSticker, setFloatingSticker] = useState<string | null>(null);
  const stickerAnim = useRef(new Animated.Value(0)).current;
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
  // Phase R3 — auto_skip_allowed gates the AUTO-skip timer (the
  // manual vote UI is gone). worship rooms etc. that disable skipping
  // entirely simply never start the timer.
  const autoSkipAllowed = settings.auto_skip_allowed;
  const isEnded = !!room?.ended_at;
  // Phase R3 — read the per-room override if the host has set one.
  // room_settings JSONB may carry `auto_skip_timeout_seconds`; fall
  // back to the global constant when missing or invalid.
  const autoSkipTimeoutMs = useMemo(() => {
    const raw = (room?.room_settings as any)?.auto_skip_timeout_seconds;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0
      ? Math.round(n * 1000)
      : DEFAULT_AUTO_SKIP_TIMEOUT_MS;
  }, [room?.room_settings]);

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
      .select(
        "user_id, last_heartbeat, profiles:profiles(avatar_url, full_name)"
      )
      .eq("room_id", roomId);
    const list = (data ?? []).map((m: any) => ({
      user_id: m.user_id,
      avatar_url: m.profiles?.avatar_url ?? null,
      full_name: m.profiles?.full_name ?? null,
      last_heartbeat: m.last_heartbeat ?? null,
    })) as Member[];
    setMembers(list);
  }, [roomId]);

  // Phase R3 — fetchVotes removed (vote_skip path deleted).

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
      await Promise.all([fetchRoom(), fetchMembers()]);
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
      // Phase R3 — sync_room_votes subscription removed; manual skip
      // vote no longer exists. Auto-skip is driven from sync_room_reactions.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sync_room_reactions", filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          const emoji = payload?.new?.emoji as string | undefined;
          const reactingUserId = payload?.new?.user_id as string | undefined;
          if (emoji) {
            showFloatingReaction(emoji);
            // Phase R2 — also animate over the reacting user's avatar.
            // Skip self because handleReact already fired an optimistic
            // local trigger; otherwise self would double-animate.
            if (reactingUserId && reactingUserId !== user?.id) {
              triggerAvatarReaction(reactingUserId, emoji);
            }
            // Phase R3 — any reaction in the room resets the host's
            // attention timer. Members' clients also call this but the
            // helper short-circuits when !isCreator.
            resetAttentionTimer();
          }
        },
      )
      // Phase R4a — Swarm remix. Stickers from other users land here and
      // trigger the floating overlay. Self echo is skipped because
      // handlePickSticker fires an optimistic overlay locally.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sync_room_remixes", filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          const mediaType = payload?.new?.media_type as string | undefined;
          const mediaUrl = payload?.new?.media_url as string | undefined;
          const remixUserId = payload?.new?.user_id as string | undefined;
          if (mediaType === "sticker" && mediaUrl && remixUserId !== user?.id) {
            showStickerOverlay(mediaUrl);
          }
          // voice_note / video_reply branches land in R4b/R4c.
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

  // Phase R4a — floating sticker overlay. Resets the shared
  // Animated.Value so concurrent arrivals replace rather than queue
  // (acceptable for MVP). Cleared at the end of the animation so the
  // overlay node unmounts.
  const showStickerOverlay = useCallback(
    (emoji: string) => {
      setFloatingSticker(emoji);
      stickerAnim.setValue(0);
      Animated.timing(stickerAnim, {
        toValue: 1,
        duration: STICKER_OVERLAY_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setFloatingSticker(null));
    },
    [stickerAnim]
  );

  // Phase R2 — start a per-avatar reaction popup. Each call adds an entry
  // to avatarReactionAnims with its own Animated.Value, kicks off the
  // animation, then prunes the entry when the animation completes. Safe
  // to call concurrently — entries are keyed on a unique id.
  const triggerAvatarReaction = useCallback(
    (userId: string, emoji: string) => {
      const id = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const anim = new Animated.Value(0);
      setAvatarReactionAnims((prev) => [...prev, { id, user_id: userId, emoji, anim }]);
      Animated.timing(anim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setAvatarReactionAnims((prev) => prev.filter((a) => a.id !== id));
      });
    },
    []
  );

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

  // Phase R3 — handleVoteSkip removed. The manual "Skip vote" path
  // (vote_skip RPC, sync_room_votes, threshold-meter UI) is gone;
  // group attention drives advance_content automatically when no
  // reaction lands inside the timeout window.

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

    // Phase R2 — optimistic per-avatar animation for the current user.
    // Fires immediately so the user gets instant feedback even if the
    // realtime echo or the donation RPC takes a moment. The realtime
    // subscription handler skips self (user_id check) so this won't
    // double-animate.
    triggerAvatarReaction(user.id, emoji);

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

  // Phase R4a — tap a sticker in the bottom sheet. Optimistic local
  // overlay fires immediately, then a row lands in sync_room_remixes.
  // RLS enforces (user_id = auth.uid() AND room membership) so we don't
  // need a server-side RPC. Other members receive the row via the
  // realtime sub above.
  const handlePickSticker = async (emoji: string) => {
    if (pickingSticker || !user?.id) return;
    setPickingSticker(true);
    showStickerOverlay(emoji);
    setRemixSheetVisible(false);
    try {
      const { error } = await supabase.from("sync_room_remixes").insert({
        room_id: roomId,
        user_id: user.id,
        media_type: "sticker",
        media_url: emoji,
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      // Soft fail -- the optimistic overlay already played and a sticker
      // failing to broadcast isn't worth a blocking alert. Log for
      // diagnostics only.
      // eslint-disable-next-line no-console
      console.warn("[remix] insert failed:", err);
    } finally {
      setPickingSticker(false);
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

  // ------- Phase R3: group-attention auto-skip -------
  //
  // Pattern: the timer lives in a useEffect whose deps include a "tick"
  // counter. Any reaction (own or others') bumps the counter, which
  // re-runs the effect: the previous setTimeout is cleared (cleanup) and
  // a fresh one is started. This keeps the realtime subscription's
  // closure simple — it only needs the stable `resetAttentionTimer`
  // callback — and avoids the ref-mutation timer pattern.
  const [attentionResetTick, setAttentionResetTick] = useState(0);
  const resetAttentionTimer = useCallback(() => {
    setAttentionResetTick((t) => t + 1);
  }, []);

  const queueLen = room?.content_queue?.length ?? 0;
  const currentContentId = room?.current_content_id ?? null;

  useEffect(() => {
    // Gates: only the host runs the timer (avoids concurrent
    // advance_content calls between member clients); only when the room
    // type allows skipping; only when content is playing AND something
    // is queued to advance TO; never when the room has ended.
    if (!isCreator || !autoSkipAllowed || isEnded) return;
    if (!currentContentId || queueLen === 0) return;

    attentionTimer.current = setTimeout(async () => {
      try {
        const { error } = await supabase.rpc("advance_content", {
          p_room_id: roomId,
        });
        if (error) {
          // Soft fail. A common cause is a race against end_sync_room;
          // we just stop trying and let the next room UPDATE settle state.
          return;
        }
        // Brief in-room banner. Cleared after AUTO_SKIP_NOTICE_MS so it
        // doesn't pile up if multiple advances happen rapidly.
        setAutoSkipNotice("Moving on — no reactions for a moment.");
        if (autoSkipNoticeTimer.current) {
          clearTimeout(autoSkipNoticeTimer.current);
        }
        autoSkipNoticeTimer.current = setTimeout(() => {
          setAutoSkipNotice(null);
        }, AUTO_SKIP_NOTICE_MS);
      } catch {
        // Swallow — same reasoning as above.
      }
    }, autoSkipTimeoutMs);

    return () => {
      if (attentionTimer.current) {
        clearTimeout(attentionTimer.current);
        attentionTimer.current = null;
      }
    };
  }, [
    isCreator,
    autoSkipAllowed,
    isEnded,
    currentContentId,
    queueLen,
    autoSkipTimeoutMs,
    attentionResetTick,
    roomId,
  ]);

  // Clean up the notice timer on unmount. The attention timer is
  // already cleaned up by the effect's own teardown above.
  useEffect(() => {
    return () => {
      if (autoSkipNoticeTimer.current) {
        clearTimeout(autoSkipNoticeTimer.current);
        autoSkipNoticeTimer.current = null;
      }
    };
  }, []);

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
        {/* Phase R3 — auto-skip notification banner. Renders for
            AUTO_SKIP_NOTICE_MS after the timer fires successfully. */}
        {autoSkipNotice ? (
          <View style={styles.autoSkipBanner} pointerEvents="none">
            <Ionicons name="play-skip-forward" size={14} color="#FFFFFF" />
            <Text style={styles.autoSkipBannerText}>{autoSkipNotice}</Text>
          </View>
        ) : null}

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

        {/* Members — Phase R2: filtered to active (last_heartbeat in last 5 min),
            with a green dot for very recent (< 2 min) and per-avatar reaction
            popups when any user reacts. The full members list is still
            kept in state so we can derive active off it without re-fetching
            on every clock tick. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>In the room</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {members
              .filter((m) => {
                if (!m.last_heartbeat) return true; // legacy rows with no heartbeat — keep visible
                try {
                  return (
                    Date.now() - new Date(m.last_heartbeat).getTime() <
                    ACTIVE_MEMBER_WINDOW_MS
                  );
                } catch {
                  return true;
                }
              })
              .map((m) => {
                const isFresh = !!m.last_heartbeat
                  ? Date.now() - new Date(m.last_heartbeat).getTime() <
                    FRESH_HEARTBEAT_WINDOW_MS
                  : false;
                const popups = avatarReactionAnims.filter(
                  (a) => a.user_id === m.user_id
                );
                return (
                  <View key={m.user_id} style={styles.memberCell}>
                    {/* Per-avatar reaction popups float UP and OUT. Each
                        has its own Animated.Value. Stacked when concurrent. */}
                    {popups.map((a) => (
                      <Animated.Text
                        key={a.id}
                        pointerEvents="none"
                        style={[
                          styles.memberAvatarReactionEmoji,
                          {
                            opacity: a.anim.interpolate({
                              inputRange: [0, 0.15, 1],
                              outputRange: [0, 1, 0],
                            }),
                            transform: [
                              {
                                translateY: a.anim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -42],
                                }),
                              },
                              {
                                scale: a.anim.interpolate({
                                  inputRange: [0, 0.3, 1],
                                  outputRange: [0.6, 1.4, 1.1],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {a.emoji}
                      </Animated.Text>
                    ))}

                    <View style={[styles.avatar, isFresh && styles.avatarFresh]}>
                      {m.avatar_url ? (
                        <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInitial}>
                          {(m.full_name ?? "?").slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                      {/* Green dot for very-recent activity. */}
                      {isFresh && <View style={styles.activeDot} />}
                    </View>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.full_name ?? "?"}
                    </Text>
                  </View>
                );
              })}
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
          {/* Phase R4a — Remix entry point. Sits below the reaction row in
              the same section. Tapping opens a bottom sheet with the
              sticker grid; future R4b/R4c will add voice / video tabs. */}
          <TouchableOpacity
            style={styles.remixOpenBtn}
            onPress={() => setRemixSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open remix sticker picker"
          >
            <Text style={styles.remixOpenBtnEmoji}>🎨</Text>
            <Text style={styles.remixOpenBtnText}>Remix</Text>
          </TouchableOpacity>
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

        {/* Phase R3 — Host controls. Manual "Skip vote" UI removed;
            advance is auto-driven by group attention (see the timer
            effect above). The host's "Advance now" button is still
            here for explicit overrides — tapping it triggers the
            same advance_content RPC that the timer would. The room
            UPDATE that follows resets the timer naturally. */}
        {isCreator ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Host controls</Text>
            <View style={styles.voteCard}>
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
              {autoSkipAllowed && !isEnded ? (
                <Text style={styles.skipHint}>
                  Auto-advance after{" "}
                  {Math.round(autoSkipTimeoutMs / 1000)}s of silence.
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

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

      {/* Phase R4a — Swarm remix sticker picker. Slide-up sheet with a
          grid of preset stickers. Tap fires handlePickSticker which
          starts the optimistic overlay and inserts a row into
          sync_room_remixes. */}
      <Modal
        visible={remixSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !pickingSticker && setRemixSheetVisible(false)}
      >
        <View style={styles.remixBackdrop}>
          <View style={styles.remixSheet}>
            <View style={styles.remixHandle} />
            <Text style={styles.remixTitle}>Pick a sticker</Text>
            <View style={styles.stickerGrid}>
              {REMIX_STICKERS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stickerCell, pickingSticker && { opacity: 0.5 }]}
                  onPress={() => handlePickSticker(s)}
                  disabled={pickingSticker}
                  accessibilityRole="button"
                  accessibilityLabel={`Send ${s} sticker`}
                >
                  <Text style={styles.stickerCellEmoji}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.remixCancel}
              onPress={() => !pickingSticker && setRemixSheetVisible(false)}
              disabled={pickingSticker}
            >
              <Text style={styles.remixCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Phase R4a — Floating sticker overlay. Sits at the very end of
          the JSX so it paints on top of everything (except open modals,
          which is acceptable -- a user with a sheet open doesn't need
          to see the sticker layer). pointerEvents:none so it never
          intercepts taps even while opacity > 0. */}
      {floatingSticker ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.floatingSticker,
            {
              opacity: stickerAnim.interpolate({
                inputRange: [0, 0.15, 0.75, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  scale: stickerAnim.interpolate({
                    inputRange: [0, 0.25, 1],
                    outputRange: [0.5, 1.3, 1.0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.floatingStickerEmoji}>{floatingSticker}</Text>
        </Animated.View>
      ) : null}
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

  // Phase R2 — memberCell is the anchor for the per-avatar reaction popup
  // (position:absolute children) so it needs position:relative.
  memberCell: { alignItems: "center", width: 56, position: "relative" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Phase R2 — teal ring around the avatar of a very-recently-active
  // member. Distinct from the green dot — ring = "actively in the room
  // right now", dot adds redundant signal for accessibility.
  avatarFresh: {
    borderWidth: 2,
    borderColor: TEAL,
  },
  // Phase R2 — small green liveness dot at the top-right of the avatar.
  // Placed inside the avatar's overflow:hidden bounds so we don't need to
  // restructure the cell. White border lets it read against any avatar.
  activeDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  // Phase R2 — per-avatar reaction emoji. Absolute-positioned over the
  // top of the member cell so the Animated.Value can lift it upward via
  // translateY (negative Y). Multiple can overlap for rapid-fire reacts;
  // useNativeDriver-compatible (only opacity / transform animated).
  memberAvatarReactionEmoji: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    fontSize: 24,
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

  // voteCard reused by the Phase R3 Host controls card. voteRow style
  // is gone (manual skip-vote row removed). voteCount/voteBtn/voteBtnText
  // and the progress bar styles removed with the skip-vote UI.
  voteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },

  skipHint: { marginTop: 8, fontSize: 11, color: MUTED, fontStyle: "italic" },

  // Phase R3 — small banner near the top of the scroll view that fires
  // for AUTO_SKIP_NOTICE_MS after an auto-advance. pointerEvents:none
  // so it doesn't intercept taps while it's showing.
  autoSkipBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    margin: 12,
  },
  autoSkipBannerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Phase R4a — Swarm remix UI
  remixOpenBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
  },
  remixOpenBtnEmoji: { fontSize: 18 },
  remixOpenBtnText: { fontSize: 13, fontWeight: "700", color: NAVY },

  remixBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  remixSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  remixHandle: {
    width: 40,
    height: 4,
    backgroundColor: BORDER,
    borderRadius: 2,
    alignSelf: "center",
  },
  remixTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },
  stickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    gap: 4,
  },
  stickerCell: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
    borderRadius: 12,
    backgroundColor: BG,
  },
  stickerCellEmoji: { fontSize: 36 },
  remixCancel: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  remixCancelText: { color: NAVY, fontWeight: "700" },

  // Floating sticker overlay -- absolute, top: 30% so it sits in the
  // upper-middle area where the YouTube embed lives (so the sticker
  // visibly reacts to the content). zIndex large so it paints above
  // the ScrollView content. pointerEvents:none is on the View itself.
  floatingSticker: {
    position: "absolute",
    top: "30%",
    alignSelf: "center",
    zIndex: 1000,
  },
  floatingStickerEmoji: {
    fontSize: 120,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },

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
