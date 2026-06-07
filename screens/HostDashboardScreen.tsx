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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";

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
      Alert.alert("Couldn't load", err instanceof Error ? err.message : String(err));
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
      Alert.alert("Couldn't send", err instanceof Error ? err.message : String(err));
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
        <Text style={styles.headerTitle}>Host Dashboard</Text>
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
            Candles · {candles.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "mass" && styles.tabActive]}
          onPress={() => setTab("mass")}
        >
          <Text style={[styles.tabText, tab === "mass" && styles.tabTextActive]}>
            Mass · {intentions.length}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={TEAL} />
          </View>
        ) : tab === "candles" ? (
          candles.length === 0 ? (
            <Text style={styles.empty}>No pending candle requests.</Text>
          ) : (
            candles.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardName}>
                    {c.full_name ?? "Someone"}
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
                  <Text style={styles.resolveBtnText}>Mark as lit</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : intentions.length === 0 ? (
          <Text style={styles.empty}>No pending mass intentions.</Text>
        ) : (
          intentions.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardName}>
                  {m.full_name ?? "Someone"}
                </Text>
                <Text style={styles.cardAmount}>{fmtDollars(m.donation_cents)}</Text>
              </View>
              <Text style={styles.cardBody}>
                For {m.name} ({m.is_deceased ? "+" : "living"}) · {m.preferred_date}
              </Text>
              <TouchableOpacity
                style={styles.resolveBtn}
                onPress={() => openResolve("mass", m.id)}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                <Text style={styles.resolveBtnText}>Mark as celebrated</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

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
              {resolveKind === "candle" ? "Mark candle as lit" : "Mark mass as celebrated"}
            </Text>
            <Text style={styles.modalLabel}>Message to the requester</Text>
            <TextInput
              style={styles.modalInput}
              value={resolveMsg}
              onChangeText={setResolveMsg}
              multiline
              maxLength={300}
              placeholder="Type your response..."
              placeholderTextColor={MUTED}
              accessibilityLabel="Templated response"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !resolving && setResolveOpen(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, resolving && { opacity: 0.6 }]}
                onPress={handleResolve}
                disabled={resolving}
              >
                <Text style={styles.sendText}>
                  {resolving ? "Sending..." : "Send & Mark"}
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
});
