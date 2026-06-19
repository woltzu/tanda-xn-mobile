// ══════════════════════════════════════════════════════════════════════════════
// AdminTemplateQueueScreen — admin triage for community submissions
// ══════════════════════════════════════════════════════════════════════════════
// Phase 5 (templates 2A). Active admins see every community
// template_submission and can approve / reject from here. Approve calls
// the SECURITY DEFINER RPC which atomically inserts a goal_templates row
// and flips submission.status='approved'; reject only writes notes +
// status. Both fire a notification back to the submitter.
//
// Mirrors AdminVerificationQueueScreen (escrow 2C) in shape: chip filter
// for status, list cards with full details inline, action row in pending
// rows only.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  TemplateSubmissionItem,
  TemplateSubmissionStatus,
  useAdminTemplateQueue,
  approveSubmission,
  rejectSubmission,
} from "../hooks/useAdminTemplateQueue";

function fmt(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FILTERS: TemplateSubmissionStatus[] = ["pending", "approved", "rejected"];

export default function AdminTemplateQueueScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TemplateSubmissionStatus>("pending");
  const { items, loading, refetch } = useAdminTemplateQueue(filter);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewItem, setReviewItem] = useState<TemplateSubmissionItem | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("admin_template_queue.title")}
          {filter === "pending" && items.length > 0 ? ` (${items.length})` : ""}
        </Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {t(`admin_template_queue.filter_${f}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C6AE" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-done-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyText}>
                {t(`admin_template_queue.empty_${filter}`)}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <QueueRow item={item} onReview={() => setReviewItem(item)} />
          )}
        />
      )}

      <ReviewSheet
        item={reviewItem}
        onClose={() => setReviewItem(null)}
        onDone={async () => {
          setReviewItem(null);
          await refetch();
        }}
      />
    </View>
  );
}

function QueueRow({
  item,
  onReview,
}: {
  item: TemplateSubmissionItem;
  onReview: () => void;
}) {
  const { t } = useTranslation();
  const statusColor =
    item.status === "approved"
      ? "#059669"
      : item.status === "rejected"
      ? "#EF4444"
      : "#F59E0B";
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {t(`admin_template_queue.status_${item.status}`)}
          </Text>
        </View>
      </View>
      <Text style={styles.cardSubtitle}>
        {t(`submit_template.category_${item.category}`, { defaultValue: item.category })}
        {item.country ? ` · ${item.country}` : ""}
      </Text>
      {item.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={13} color="#6B7280" />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.submitter_name ?? t("admin_template_queue.unknown_submitter")}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="cash-outline" size={13} color="#6B7280" />
        <Text style={styles.metaText}>
          {fmt(item.target_cents)}
          {item.timeline_months
            ? ` · ${t("admin_template_queue.timeline_months", { months: item.timeline_months })}`
            : ""}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={13} color="#6B7280" />
        <Text style={styles.metaText}>
          {t("admin_template_queue.submitted_on", { date: fmtDate(item.created_at) })}
        </Text>
      </View>

      <TouchableOpacity style={styles.reviewBtn} onPress={onReview}>
        <Text style={styles.reviewBtnText}>
          {t("admin_template_queue.review_button")}
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

function ReviewSheet({
  item,
  onClose,
  onDone,
}: {
  item: TemplateSubmissionItem | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState<"approve" | "reject" | null>(null);

  React.useEffect(() => {
    if (!item) setNotes("");
  }, [item]);

  if (!item) return null;
  const isPending = item.status === "pending";

  const handleApprove = async () => {
    setWorking("approve");
    const res = await approveSubmission(item.id, notes.trim() || undefined);
    setWorking(null);
    if (!res.ok) {
      Alert.alert(t("admin_template_queue.error_title"), res.message ?? "");
      return;
    }
    await onDone();
  };

  const handleReject = async () => {
    if (notes.trim().length < 8) {
      Alert.alert(
        t("admin_template_queue.error_title"),
        t("admin_template_queue.reject_needs_notes"),
      );
      return;
    }
    setWorking("reject");
    const res = await rejectSubmission(item.id, notes.trim());
    setWorking(null);
    if (!res.ok) {
      Alert.alert(t("admin_template_queue.error_title"), res.message ?? "");
      return;
    }
    await onDone();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.sheetBackdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={styles.sheetTitle}>{item.name}</Text>
              <Text style={styles.sheetCategory}>
                {t(`submit_template.category_${item.category}`, { defaultValue: item.category })}
                {item.country ? ` · ${item.country}` : ""}
              </Text>
              {item.description ? (
                <Text style={styles.sheetBody}>{item.description}</Text>
              ) : null}

              <View style={styles.sheetMetaRow}>
                <Text style={styles.sheetMetaLabel}>
                  {t("admin_template_queue.target")}
                </Text>
                <Text style={styles.sheetMetaValue}>{fmt(item.target_cents)}</Text>
              </View>
              {item.timeline_months ? (
                <View style={styles.sheetMetaRow}>
                  <Text style={styles.sheetMetaLabel}>
                    {t("admin_template_queue.timeline")}
                  </Text>
                  <Text style={styles.sheetMetaValue}>
                    {t("admin_template_queue.timeline_months", {
                      months: item.timeline_months,
                    })}
                  </Text>
                </View>
              ) : null}

              {item.milestones.length > 0 ? (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>
                    {t("admin_template_queue.section_milestones")}
                  </Text>
                  {item.milestones.map((m, i) => (
                    <View key={i} style={styles.lineRow}>
                      <Text style={styles.lineLabel} numberOfLines={1}>
                        {i + 1}. {m.name}
                      </Text>
                      <Text style={styles.linePercent}>{m.default_percent}%</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {item.cost_breakdown.length > 0 ? (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>
                    {t("admin_template_queue.section_costs")}
                  </Text>
                  {item.cost_breakdown.map((c, i) => (
                    <View key={i} style={styles.lineRow}>
                      <Text style={styles.lineLabel} numberOfLines={1}>
                        {c.item}
                      </Text>
                      <Text style={styles.lineCost}>{fmt(c.cost_cents)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {item.provider_categories && item.provider_categories.length > 0 ? (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>
                    {t("admin_template_queue.section_providers")}
                  </Text>
                  <Text style={styles.sheetBody}>
                    {item.provider_categories.join(", ")}
                  </Text>
                </View>
              ) : null}

              {!isPending && item.admin_notes ? (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>
                    {t("admin_template_queue.admin_notes")}
                  </Text>
                  <Text style={styles.sheetBody}>{item.admin_notes}</Text>
                </View>
              ) : null}

              {isPending ? (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>
                    {t("admin_template_queue.notes_label")}
                  </Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder={t("admin_template_queue.notes_placeholder")}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    maxLength={500}
                  />
                </View>
              ) : null}
            </ScrollView>

            {isPending ? (
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnDanger, { flex: 1, marginRight: 8 }]}
                  onPress={handleReject}
                  disabled={working !== null}
                >
                  {working === "reject" ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.btnDangerText}>
                      {t("admin_template_queue.reject_button")}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
                  onPress={handleApprove}
                  disabled={working !== null}
                >
                  {working === "approve" ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>
                      {t("admin_template_queue.approve_button")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { flex: 1 }]}
                  onPress={onClose}
                >
                  <Text style={styles.btnSecondaryText}>
                    {t("admin_template_queue.close")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },

  filtersWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 6,
  },
  chipActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  chipTextActive: { color: "#FFFFFF" },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280", textAlign: "center", paddingHorizontal: 24 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: "#0A2342", marginRight: 8 },
  cardSubtitle: { fontSize: 12, fontWeight: "600", color: "#0A2342", marginBottom: 6, textTransform: "capitalize" },
  cardDescription: { fontSize: 13, color: "#374151", marginBottom: 8, lineHeight: 18 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
  },
  metaText: { fontSize: 13, color: "#374151" },

  reviewBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#00C6AE",
  },
  reviewBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  // ─── Review sheet ─────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#0A2342" },
  sheetCategory: { fontSize: 12, fontWeight: "700", color: "#6B7280", marginTop: 4, textTransform: "capitalize" },
  sheetBody: { fontSize: 13, color: "#374151", marginTop: 6, lineHeight: 18 },
  sheetMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 8,
  },
  sheetMetaLabel: { fontSize: 13, color: "#6B7280" },
  sheetMetaValue: { fontSize: 13, fontWeight: "800", color: "#0A2342" },

  sheetSection: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  sheetSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  lineLabel: { flex: 1, fontSize: 13, color: "#374151", marginRight: 8 },
  lineCost: { fontSize: 13, fontWeight: "700", color: "#0A2342" },
  linePercent: { fontSize: 12, fontWeight: "800", color: "#00C6AE" },

  notesInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#0A2342",
    textAlignVertical: "top",
  },

  sheetActions: { flexDirection: "row", marginTop: 14 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  btnSecondary: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  btnSecondaryText: { color: "#0A2342", fontSize: 14, fontWeight: "700" },
  btnDanger: { backgroundColor: "#EF4444" },
  btnDangerText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
