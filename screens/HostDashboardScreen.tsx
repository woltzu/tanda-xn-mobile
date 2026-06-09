// =============================================================================
// HostDashboardScreen -- room creator's pending-requests inbox.
//
// Reached from SyncRoomScreen via the gear icon (only visible when the
// current user is the room's created_by). Two tabs: Candles + Mass
// intentions. Real-time subscriptions keep both lists fresh; mark
// actions open a Resolve modal where the host can edit the templated
// message before sending.
//
// Server enforces the host gate on every mutation -- this screen does
// the visibility gating but is not the authoritative permission check.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import AudienceMoodCard from "../components/AudienceMoodCard";
import ActiveViewersList from "../components/ActiveViewersList";
import ViewerHistoryModal from "../components/ViewerHistoryModal";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MUTED = "#6B7280";

type Candle = {
  id: string;
  user_id: string;
  full_name: string | null;
  intention: string;
  donation_cents: number;
  created_at: string;
};

type MassIntention = {
  id: string;
  user_id: string;
  full_name: string | null;
  name: string;
  is_deceased: boolean;
  preferred_date: string;
  donation_cents: number;
  created_at: string;
};

const DEFAULT_CANDLE_MSG =
  "Your candle has been lit in the church. God bless you.";
const DEFAULT_MASS_MSG =
  "Your mass intention has been celebrated. May it bring peace.";

type RouteParams = { roomId: string };

export default function HostDashboardScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ HostDashboard: RouteParams }, "HostDashboard">>();
  const { t } = useTranslation();
  const roomId = route.params.roomId;

  const [tab, setTab] = useState<"candles" | "mass">("candles");
  const [loading, setLoading] = useState(true);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [intentions, setIntentions] = useState<MassIntention[]>([]);

  // Resolve modal state.
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveKind, setResolveKind] = useState<"candle" | "mass">("candle");
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveMsg, setResolveMsg] = useState("");
  const [resolving, setResolving] = useState(false);

  // Phase 6b — viewer history modal state.
  const [historyViewerId, setHistoryViewerId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Phase 6b — scripture overlay editor state. Initial text is fetched
  // from sync_rooms.room_settings on mount; saving calls
  // set_scripture_overlay RPC which UPDATEs the row, which fires the
  // viewer-side realtime subscription on SyncRoomScreen.
  const [scriptureText, setScriptureText] = useState("");
  const [scriptureSaving, setScriptureSaving] = useState(false);

  // Phase 1b — religion picker for worship rooms. Initial value loaded
  // alongside the scripture text. Drives the inference engine: when set
  // to a specific value (not 'other'), the trigger on sync_room_members
  // INSERT fires and creates community suggestions for joining viewers.
  const [religion, setReligion] = useState<string>("other");
  const [religionSaving, setReligionSaving] = useState(false);
  const [isWorshipRoom, setIsWorshipRoom] = useState(false);

  // Phase R6 — adaptive-queue host controls. autoSuggestEnabled mirrors
  // room_settings.auto_suggest_enabled (defaults to true when missing).
  // refreshingSuggestion gates the "Refresh suggestions" button so the
  // host can't pile up RPC calls.
  const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(true);
  const [autoSuggestSaving, setAutoSuggestSaving] = useState(false);
  const [refreshingSuggestion, setRefreshingSuggestion] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_pending_requests", {
        p_room_id: roomId,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as {
        success?: boolean;
        candles?: Candle[];
        mass_intentions?: MassIntention[];
        error?: string;
      };
      if (!r.success) throw new Error(r.error || "Couldn't load");
      setCandles(r.candles || []);
      setIntentions(r.mass_intentions || []);
    } catch (err) {
      Alert.alert(t("final_polish.hostdashboard_alert_couldn_t_load"), err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    refresh();

    // Realtime: any change to candle/mass rows for this room refetches.
    // Cheap because both queries are bounded by pending status.
    const ch = supabase
      .channel(`host-dashboard-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_room_candle_requests",
          filter: `room_id=eq.${roomId}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_room_mass_intentions",
          filter: `room_id=eq.${roomId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId, refresh]);

  // Phase 6b — initial scripture text load. Re-runs only on roomId change.
  // The set_scripture_overlay RPC fires sync_rooms UPDATE which doesn't
  // re-trigger this hook; the viewer side picks it up via realtime
  // subscription on SyncRoomScreen. We only refresh here on mount because
  // the host sees their own typed text in the input field directly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("sync_rooms")
        .select("room_type, room_settings")
        .eq("id", roomId)
        .maybeSingle();
      if (cancelled) return;
      const settings = data?.room_settings as
        | {
            scripture_overlay_text?: string;
            religion?: string;
            auto_suggest_enabled?: boolean;
          }
        | null;
      setScriptureText(settings?.scripture_overlay_text ?? "");
      setIsWorshipRoom(data?.room_type === "worship");
      setReligion(settings?.religion ?? "other");
      // R6 — defaults to true when the key is absent (newly created
      // rooms haven't run set_room_auto_suggest yet).
      setAutoSuggestEnabled(settings?.auto_suggest_enabled !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Phase R6 — flip the per-room auto-suggest flag. Optimistic update +
  // revert on failure to keep the Switch responsive.
  const handleToggleAutoSuggest = async (next: boolean) => {
    if (autoSuggestSaving) return;
    const previous = autoSuggestEnabled;
    setAutoSuggestEnabled(next);
    setAutoSuggestSaving(true);
    try {
      const { data, error } = await supabase.rpc("set_room_auto_suggest", {
        p_room_id: roomId,
        p_enabled: next,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) {
        throw new Error(r.error ?? "Couldn't save");
      }
    } catch (err) {
      setAutoSuggestEnabled(previous);
      Alert.alert(
        "Couldn't update setting",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setAutoSuggestSaving(false);
    }
  };

  // Phase R6 — manual suggest. RPC server-side either sets
  // current_content_id (if nothing playing) or appends to the queue.
  // Either way the room UPDATE fires and the viewer-side state catches up.
  const handleRefreshSuggestion = async () => {
    if (refreshingSuggestion) return;
    setRefreshingSuggestion(true);
    try {
      const { data, error } = await supabase.rpc("suggest_next_video", {
        p_room_id: roomId,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as {
        success?: boolean;
        error?: string;
        placement?: string;
      };
      if (!r.success) {
        throw new Error(
          r.error === "auto_suggest_disabled"
            ? "Auto-suggest is off for this room."
            : r.error ?? "No suggestion available",
        );
      }
      Alert.alert(
        "Suggestion added",
        r.placement === "current"
          ? "Started playing the suggested video."
          : "Added to the end of the queue.",
      );
    } catch (err) {
      Alert.alert(
        "Couldn't fetch a suggestion",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setRefreshingSuggestion(false);
    }
  };

  const handleSetReligion = async (next: string) => {
    if (religionSaving || next === religion) return;
    setReligionSaving(true);
    const previous = religion;
    setReligion(next);
    try {
      const { data, error } = await supabase.rpc("update_room_religion", {
        p_room_id: roomId,
        p_religion: next,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) throw new Error(r.error ?? "Couldn't save religion");
    } catch (err) {
      setReligion(previous);
      Alert.alert(
        "Couldn't update religion",
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setReligionSaving(false);
    }
  };

  const handleSaveScripture = async () => {
    if (scriptureSaving) return;
    setScriptureSaving(true);
    try {
      const { data, error } = await supabase.rpc("set_scripture_overlay", {
        p_room_id: roomId,
        p_text: scriptureText,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) throw new Error(r.error ?? "Couldn't save");
    } catch (err) {
      Alert.alert(
        "Couldn't save scripture",
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setScriptureSaving(false);
    }
  };

  const handleClearScripture = async () => {
    if (scriptureSaving) return;
    setScriptureText("");
    setScriptureSaving(true);
    try {
      await supabase.rpc("set_scripture_overlay", {
        p_room_id: roomId,
        p_text: "",
      });
    } finally {
      setScriptureSaving(false);
    }
  };

  const openViewerHistory = (viewerId: string) => {
    setHistoryViewerId(viewerId);
    setHistoryOpen(true);
  };
  const closeViewerHistory = () => {
    setHistoryOpen(false);
  };

  const openResolve = (kind: "candle" | "mass", id: string) => {
    setResolveKind(kind);
    setResolveId(id);
    setResolveMsg(kind === "candle" ? DEFAULT_CANDLE_MSG : DEFAULT_MASS_MSG);
    setResolveOpen(true);
  };

  const handleResolve = async () => {
    if (!resolveId || resolving) return;
    setResolving(true);
    try {
      const rpc = resolveKind === "candle" ? "mark_candle_lit" : "mark_mass_celebrated";
      const paramKey = resolveKind === "candle" ? "p_request_id" : "p_intention_id";
      const { data, error } = await supabase.rpc(rpc, {
        [paramKey]: resolveId,
        p_message: resolveMsg,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) throw new Error(r.error || "Couldn't resolve");
      setResolveOpen(false);
    } catch (err) {
      Alert.alert(t("final_polish.hostdashboard_alert_couldn_t_send"), err instanceof Error ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  };

  const fmtDollars = (c: number) =>
    c >= 100 ? `$${(c / 100).toFixed(2)}` : `${c}¢`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("host_dashboard.header")}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={refresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "candles" && styles.tabActive]}
          onPress={() => setTab("candles")}
        >
          <Text style={[styles.tabText, tab === "candles" && styles.tabTextActive]}>
            {t("host_dashboard.tab_candles", { count: candles.length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "mass" && styles.tabActive]}
          onPress={() => setTab("mass")}
        >
          <Text style={[styles.tabText, tab === "mass" && styles.tabTextActive]}>
            {t("host_dashboard.tab_mass", { count: intentions.length })}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 0, paddingBottom: 32 }}>
        {/* Phase 6b — audience stats (group, visible-to-all on viewer side
            too — host just sees the same card here for convenience). */}
        <AudienceMoodCard roomId={roomId} />

        {/* Phase 6b — active viewers with tap-to-open history (host-only;
            server enforces via get_viewer_summary). */}
        <ActiveViewersList roomId={roomId} onViewerPress={openViewerHistory} />

        {/* Phase R6 — adaptive queue. When the queue and current_content_id
            both empty, the host's SyncRoomScreen client auto-fires
            suggest_next_video. The toggle below disables that behaviour
            per-room; the button below manually triggers it on-demand
            (e.g. to pre-queue a video while one's still playing). */}
        <View style={styles.scriptureCard}>
          <Text style={styles.scriptureCardTitle}>{t("host_dashboard.card_adaptive_queue_title")}</Text>
          <Text style={styles.scriptureCardHint}>
            {t("host_dashboard.card_adaptive_queue_hint")}
          </Text>
          <View style={styles.r6ToggleRow}>
            <Text style={styles.r6ToggleLabel}>{t("host_dashboard.auto_suggest_toggle")}</Text>
            <Switch
              value={autoSuggestEnabled}
              onValueChange={handleToggleAutoSuggest}
              disabled={autoSuggestSaving}
              trackColor={{ false: BORDER, true: TEAL }}
              thumbColor="#FFFFFF"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.scriptureBtn,
              styles.scriptureSaveBtn,
              refreshingSuggestion && { opacity: 0.6 },
            ]}
            onPress={handleRefreshSuggestion}
            disabled={refreshingSuggestion}
            accessibilityRole="button"
            accessibilityLabel="Refresh suggestion"
          >
            {refreshingSuggestion ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.scriptureSaveBtnText}>
                {t("host_dashboard.refresh_suggestion_btn")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Phase 6b — scripture overlay editor. Host-only via
            set_scripture_overlay RPC. Empty value clears the overlay. */}
        <View style={styles.scriptureCard}>
          <Text style={styles.scriptureCardTitle}>{t("host_dashboard.card_scripture_title")}</Text>
          <Text style={styles.scriptureCardHint}>
            {t("host_dashboard.card_scripture_hint")}
          </Text>
          <TextInput
            style={styles.scriptureInput}
            value={scriptureText}
            onChangeText={(s) => setScriptureText(s.slice(0, 280))}
            placeholder={t("host_dashboard.scripture_placeholder")}
            placeholderTextColor={MUTED}
            multiline
            maxLength={280}
            editable={!scriptureSaving}
          />
          <Text style={styles.scriptureCounter}>{scriptureText.length} / 280</Text>
          <View style={styles.scriptureBtnRow}>
            <TouchableOpacity
              style={[styles.scriptureBtn, styles.scriptureSecondaryBtn]}
              onPress={handleClearScripture}
              disabled={scriptureSaving}
              accessibilityRole="button"
            >
              <Text style={styles.scriptureSecondaryBtnText}>{t("host_dashboard.scripture_clear")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scriptureBtn, styles.scriptureSaveBtn]}
              onPress={handleSaveScripture}
              disabled={scriptureSaving}
              accessibilityRole="button"
            >
              {scriptureSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.scriptureSaveBtnText}>{t("host_dashboard.scripture_save")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Phase 1b — religion picker. Only shown for worship rooms.
            Setting a specific religion (not 'other') triggers the
            community-suggestion engine for viewers who join after the
            value is set. */}
        {isWorshipRoom && (
          <View style={styles.scriptureCard}>
            <Text style={styles.scriptureCardTitle}>{t("host_dashboard.card_religion_title")}</Text>
            <Text style={styles.scriptureCardHint}>
              {t("host_dashboard.card_religion_hint", {
                value: religion === "other" ? t("host_dashboard.religion_dash") : t(`host_dashboard.religion_${religion}`),
              })}
            </Text>
            <View style={styles.religionChipsRow}>
              {([
                "catholic",
                "protestant",
                "orthodox",
                "muslim",
                "jewish",
                "buddhist",
                "hindu",
                "other",
              ] as const).map((value) => {
                const isActive = religion === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.religionChip,
                      isActive && styles.religionChipActive,
                    ]}
                    onPress={() => handleSetReligion(value)}
                    disabled={religionSaving}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[
                        styles.religionChipText,
                        isActive && styles.religionChipTextActive,
                      ]}
                    >
                      {t(`host_dashboard.religion_${value}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {religionSaving && (
              <ActivityIndicator
                color={TEAL}
                size="small"
                style={{ marginTop: 8 }}
              />
            )}
          </View>
        )}

        <View style={{ padding: 16, paddingTop: 0 }}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={TEAL} />
          </View>
        ) : tab === "candles" ? (
          candles.length === 0 ? (
            <Text style={styles.empty}>{t("host_dashboard.empty_candles")}</Text>
          ) : (
            candles.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardName}>
                    {c.full_name ?? t("host_dashboard.card_default_name")}
                  </Text>
                  <Text style={styles.cardAmount}>{fmtDollars(c.donation_cents)}</Text>
                </View>
                <Text style={styles.cardBody}>{c.intention}</Text>
                <TouchableOpacity
                  style={styles.resolveBtn}
                  onPress={() => openResolve("candle", c.id)}
                  accessibilityRole="button"
                >
                  <Ionicons name="flame" size={14} color="#FFFFFF" />
                  <Text style={styles.resolveBtnText}>{t("host_dashboard.mark_as_lit")}</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : intentions.length === 0 ? (
          <Text style={styles.empty}>{t("host_dashboard.empty_mass")}</Text>
        ) : (
          intentions.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardName}>
                  {m.full_name ?? t("host_dashboard.card_default_name")}
                </Text>
                <Text style={styles.cardAmount}>{fmtDollars(m.donation_cents)}</Text>
              </View>
              <Text style={styles.cardBody}>
                For {m.name} ({m.is_deceased ? "+" : t("host_dashboard.card_mass_living")}) · {m.preferred_date}
              </Text>
              <TouchableOpacity
                style={styles.resolveBtn}
                onPress={() => openResolve("mass", m.id)}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                <Text style={styles.resolveBtnText}>{t("host_dashboard.mark_as_celebrated")}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        </View>
      </ScrollView>

      {/* Phase 6b — host-only viewer history modal */}
      <ViewerHistoryModal
        visible={historyOpen}
        viewerId={historyViewerId}
        roomId={roomId}
        onClose={closeViewerHistory}
      />

      {/* Resolve modal */}
      <Modal
        visible={resolveOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !resolving && setResolveOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {resolveKind === "candle" ? t("host_dashboard.modal_candle_title") : t("host_dashboard.modal_mass_title")}
            </Text>
            <Text style={styles.modalLabel}>{t("host_dashboard.modal_label")}</Text>
            <TextInput
              style={styles.modalInput}
              value={resolveMsg}
              onChangeText={setResolveMsg}
              multiline
              maxLength={300}
              placeholder={t("host_dashboard.modal_placeholder")}
              placeholderTextColor={MUTED}
              accessibilityLabel="Templated response"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !resolving && setResolveOpen(false)}
              >
                <Text style={styles.cancelText}>{t("host_dashboard.modal_cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, resolving && { opacity: 0.6 }]}
                onPress={handleResolve}
                disabled={resolving}
              >
                <Text style={styles.sendText}>
                  {resolving ? t("host_dashboard.modal_sending") : t("host_dashboard.modal_send")}
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
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  tabRow: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  tabTextActive: { color: NAVY },

  loadingBox: { paddingVertical: 32, alignItems: "center" },
  empty: { fontSize: 13, color: MUTED, fontStyle: "italic", textAlign: "center", paddingVertical: 30 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardName: { fontSize: 13, fontWeight: "700", color: NAVY },
  cardAmount: { fontSize: 13, fontWeight: "700", color: TEAL },
  cardBody: { fontSize: 13, color: NAVY, marginBottom: 10, lineHeight: 19 },

  resolveBtn: {
    backgroundColor: NAVY,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resolveBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
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
  modalTitle: { fontSize: 16, fontWeight: "700", color: NAVY, marginBottom: 4 },
  modalLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: NAVY,
    minHeight: 90,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  cancelText: { color: NAVY, fontWeight: "700", fontSize: 14 },
  sendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: NAVY,
    alignItems: "center",
  },
  sendText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  // Phase 6b — scripture overlay editor card
  scriptureCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  scriptureCardTitle: { fontSize: 14, fontWeight: "700", color: NAVY },
  scriptureCardHint: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    marginBottom: 10,
  },
  scriptureInput: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: NAVY,
    textAlignVertical: "top",
  },
  scriptureCounter: {
    fontSize: 11,
    color: MUTED,
    textAlign: "right",
    marginTop: 4,
  },
  scriptureBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  scriptureBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  scriptureSecondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  scriptureSecondaryBtnText: { color: NAVY, fontWeight: "700", fontSize: 14 },
  scriptureSaveBtn: { backgroundColor: TEAL },
  scriptureSaveBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  // Phase R6 — adaptive queue toggle row
  r6ToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginVertical: 4,
  },
  r6ToggleLabel: { fontSize: 14, fontWeight: "600", color: NAVY },

  // Phase 1b — religion picker chips
  religionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  religionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: BORDER,
  },
  religionChipActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  religionChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: NAVY,
  },
  religionChipTextActive: {
    color: "#FFFFFF",
  },
});
