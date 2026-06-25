// ═══════════════════════════════════════════════════════════════════════════
// screens/DisputeDetailScreen.tsx — Phase 2, migration 261
// ═══════════════════════════════════════════════════════════════════════════
//
// Single-dispute view. Sections:
//   1. Header (title + status chip)
//   2. Details (description + filer + respondent metadata)
//   3. Message timeline
//   4. Composer (auth users involved in the dispute)
//   5. Mediator actions (assign-to-self, resolve, reject)
//
// Mediator selection is currently SELF-ASSIGN only — any elder calling
// assign_mediator takes the dispute themselves. Full picker (choose from
// list of elders) is a follow-up.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useDispute, DisputeStatus } from "../hooks/useDisputes";
import { useAuth } from "../context/AuthContext";
import { useRoles } from "../hooks/useRoles";
import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";

type Rt = RouteProp<RootStackParamList, "DisputeDetail">;
type Nav = StackNavigationProp<RootStackParamList, "DisputeDetail">;

const STATUS_COLOR: Record<DisputeStatus, { bg: string; fg: string }> = {
  open:          { bg: "#FEF3C7", fg: "#92400E" },
  under_review:  { bg: "#DBEAFE", fg: "#1E40AF" },
  resolved:      { bg: "#DCFCE7", fg: "#166534" },
  rejected:      { bg: "#FEE2E2", fg: "#991B1B" },
  closed:        { bg: "#E5E7EB", fg: "#374151" },
};

function promptText(title: string, message: string): Promise<string | null> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const result = window.prompt(`${title}\n\n${message}`);
    return Promise.resolve(result);
  }
  // RN Alert.prompt is iOS-only. On Android we fall back to a no-arg prompt
  // by chaining an immediate "ok" click — the resolution_note becomes a
  // placeholder. Better Android UX would be a dedicated bottom-sheet form.
  return new Promise((resolve) => {
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        title,
        message,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
          { text: "OK", onPress: (text: string) => resolve(text ?? "") },
        ],
        "plain-text",
      );
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        { text: "OK", onPress: () => resolve("") },
      ]);
    }
  });
}

export default function DisputeDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<Rt>();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { disputeId } = route.params;
  const { dispute, messages, isLoading, error, refresh, postMessage } =
    useDispute(disputeId);
  const { isElder, permissions } = useRoles(user?.id);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const meIsParty = !!user && dispute && (
    dispute.reporter_user_id === user.id ||
    dispute.against_user_id === user.id ||
    dispute.assigned_to === user.id
  );
  const canPost = meIsParty || isElder;
  const meIsMediator = !!user && !!dispute && dispute.assigned_to === user.id;
  // Phase 2 (migration 262) — mediator actions now require the
  // can_mediate_disputes permission (all elder tiers have it, but the
  // booleans are the source of truth and future-proof against tier
  // policy changes). Admin path still handled server-side
  // (resolve_dispute checks admin_users).
  const canResolve =
    permissions.canMediateDisputes &&
    meIsMediator &&
    dispute &&
    dispute.status !== "resolved" &&
    dispute.status !== "rejected" &&
    dispute.status !== "closed";
  const canAssign =
    permissions.canMediateDisputes &&
    dispute &&
    !dispute.assigned_to &&
    dispute.status === "open";

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return;
    try {
      setSending(true);
      await postMessage(draft.trim(), false);
      setDraft("");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to send", "error");
    } finally {
      setSending(false);
    }
  }, [draft, sending, postMessage]);

  const handleAssignSelf = useCallback(async () => {
    if (!user || !dispute) return;
    try {
      const { error: e } = await supabase.rpc("assign_mediator", {
        p_dispute_id: dispute.id,
        p_mediator_id: user.id,
      });
      if (e) throw new Error(e.message);
      showToast(t("dispute.mediator_assigned"), "success");
      await refresh();
    } catch (e: any) {
      showToast(e?.message ?? "Failed to assign", "error");
    }
  }, [user, dispute, refresh, t]);

  const handleResolve = useCallback(
    async (status: "resolved" | "rejected") => {
      if (!dispute) return;
      const note = await promptText(
        t(`dispute.${status === "resolved" ? "resolve" : "reject"}`),
        t("dispute.resolution_note"),
      );
      if (note === null) return; // user cancelled
      try {
        const { error: e } = await supabase.rpc("resolve_dispute", {
          p_dispute_id: dispute.id,
          p_resolution: note,
          p_status: status,
        });
        if (e) throw new Error(e.message);
        showToast(
          t(status === "resolved" ? "dispute.resolve_success" : "dispute.reject_success"),
          "success",
        );
        await refresh();
      } catch (e: any) {
        showToast(e?.message ?? "Failed to resolve", "error");
      }
    },
    [dispute, refresh, t],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (error || !dispute) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? t("dispute.no_disputes")}</Text>
      </View>
    );
  }

  const color = STATUS_COLOR[dispute.status] ?? STATUS_COLOR.open;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      >
        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{dispute.title}</Text>
          <View style={[styles.statusChip, { backgroundColor: color.bg }]}>
            <Text style={[styles.statusChipText, { color: color.fg }]}>
              {t(`dispute.status_${dispute.status}`)}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t("dispute.reason")}</Text>
          <Text style={styles.cardBody}>{dispute.description}</Text>
          {dispute.resolution ? (
            <>
              <Text style={[styles.cardLabel, { marginTop: 12 }]}>
                {t("dispute.resolution_note")}
              </Text>
              <Text style={styles.cardBody}>{dispute.resolution}</Text>
            </>
          ) : null}
        </View>

        {/* Mediator actions */}
        {(canAssign || canResolve) && (
          <View style={styles.actionsCard}>
            {canAssign && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleAssignSelf}
              >
                <Text style={styles.primaryBtnText}>
                  {t("dispute.assign_mediator")}
                </Text>
              </TouchableOpacity>
            )}
            {canResolve && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.resolveBtn]}
                  onPress={() => handleResolve("resolved")}
                >
                  <Text style={styles.resolveBtnText}>{t("dispute.resolve")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleResolve("rejected")}
                >
                  <Text style={styles.rejectBtnText}>{t("dispute.reject")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Messages */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t("dispute.messages_title")}</Text>
          {messages.length === 0 ? (
            <Text style={styles.empty}>{t("dispute.no_messages")}</Text>
          ) : (
            messages.map((m) => {
              const mine = m.sender_user_id === user?.id;
              return (
                <View
                  key={m.id}
                  style={[styles.msg, mine ? styles.msgMine : styles.msgOther]}
                >
                  {m.is_private && (
                    <Text style={styles.msgPrivate}>internal</Text>
                  )}
                  <Text style={styles.msgBody}>{m.message}</Text>
                  <Text style={styles.msgMeta}>
                    {new Date(m.created_at).toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {canPost && (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder={t("dispute.message_placeholder")}
            placeholderTextColor="#9CA3AF"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!draft.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
          >
            <Text style={styles.sendBtnText}>{t("dispute.submit")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  errorText: { color: "#991B1B", fontSize: 14, textAlign: "center" },
  scroll: { padding: 16, paddingBottom: 32 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111827" },
  statusChip: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardBody: { fontSize: 14, color: "#111827", lineHeight: 20 },
  empty: { color: "#9CA3AF", fontSize: 13, fontStyle: "italic" },
  actionsCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  actionsRow: { flexDirection: "row", gap: 8 },
  primaryBtn: {
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  resolveBtn: { backgroundColor: "#DCFCE7" },
  resolveBtnText: { color: "#166534", fontWeight: "700" },
  rejectBtn: { backgroundColor: "#FEE2E2" },
  rejectBtnText: { color: "#991B1B", fontWeight: "700" },
  msg: {
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    maxWidth: "85%",
  },
  msgMine: { backgroundColor: "#E0F2FE", alignSelf: "flex-end" },
  msgOther: { backgroundColor: "#F3F4F6", alignSelf: "flex-start" },
  msgPrivate: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400E",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  msgBody: { fontSize: 14, color: "#111827" },
  msgMeta: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  sendBtn: {
    backgroundColor: "#00C6AE",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#FFFFFF", fontWeight: "700" },
});
