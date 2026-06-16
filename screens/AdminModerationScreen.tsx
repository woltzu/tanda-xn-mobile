// ══════════════════════════════════════════════════════════════════════════════
// screens/AdminModerationScreen.tsx — Platform-Admin moderation queue
// ══════════════════════════════════════════════════════════════════════════════
//
// Two tabs:
//   • Content    — content_reports WHERE status='pending'
//   • Users      — user_reports    WHERE status='pending'
//
// Tap a row to open a detail view (modal) with the content preview /
// reported-user info, the reporter, and an action set. Actions call into
// the SECURITY DEFINER RPCs from migration 152:
//   • Dismiss        → resolve_report(action='dismiss')
//   • Delete content → apply_moderation_action(delete_content) then
//                      auto-dismisses every other report on the same content
//   • Warn user      → apply_moderation_action(warn)        + resolve_report
//   • Suspend user   → apply_moderation_action(suspend, P_INTERVAL)
//   • Ban user       → apply_moderation_action(ban)
//
// Realtime: subscribes to both tables so new pending rows land at the top
// of the list without a manual refresh.
//
// Frontend access guard mirrors AIJobsHealthScreen — we short-circuit
// before any data hook runs if useIsAdmin() resolves negative. The RLS
// policies on these tables are admin-only-SELECT anyway, so the screen
// would render empty for a non-admin even without the guard; the guard
// just makes the failure mode visible and skips the wasted queries.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { showToast } from "../components/Toast";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const TEXT = "#111827";
const RED = "#DC2626";
const AMBER = "#F59E0B";

type TabKey = "content" | "users";

type ReportPriority = "low" | "normal" | "high";

type ContentReport = {
  id: string;
  reporter_user_id: string;
  content_type: "dream_post" | "comment" | "event" | "circle_message";
  content_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  // P2 (migration 162) — priority queue + auto-flag tags
  priority?: ReportPriority;
  tags?: string[];
};

type UserReport = {
  id: string;
  reporter_user_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  priority?: ReportPriority;
  tags?: string[];
};

// P2 — priority ordering helper. Used for stable sort across both lists.
const PRIORITY_RANK: Record<ReportPriority, number> = { high: 0, normal: 1, low: 2 };
function sortByPriority<T extends { priority?: ReportPriority; created_at: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? "normal"];
    const pb = PRIORITY_RANK[b.priority ?? "normal"];
    if (pa !== pb) return pa - pb;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

// Tables to fetch a preview from per content_type. Keys match the CHECK
// constraint on content_reports.content_type.
const PREVIEW_TABLES: Record<ContentReport["content_type"], string> = {
  dream_post: "feed_posts",
  comment: "feed_comments",
  event: "community_events",
  circle_message: "circle_messages",
};
const PREVIEW_FIELDS: Record<ContentReport["content_type"], string> = {
  dream_post: "id, user_id, content, image_url, created_at",
  comment: "id, user_id, content, created_at",
  event: "id, user_id, title, full_address, event_datetime, image_url",
  circle_message: "id, user_id, circle_id, body, created_at",
};

// ══════════════════════════════════════════════════════════════════════════
// Screen entry — admin gate first
// ══════════════════════════════════════════════════════════════════════════

export default function AdminModerationScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t("moderation_admin.header")} onBack={() => navigation.goBack()} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.centerText}>{t("moderation_admin.checking")}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t("moderation_admin.header")} onBack={() => navigation.goBack()} />
        <View style={styles.centerState}>
          <Ionicons name="lock-closed-outline" size={40} color={RED} />
          <Text style={styles.deniedTitle}>{t("moderation_admin.denied_title")}</Text>
          <Text style={styles.deniedBody}>
            {t("moderation_admin.denied_body")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <ModerationQueue />;
}

// ══════════════════════════════════════════════════════════════════════════
// ModerationQueue — main body once admin is confirmed
// ══════════════════════════════════════════════════════════════════════════

function ModerationQueue() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("content");
  const [contentReports, setContentReports] = useState<ContentReport[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentReport | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserReport | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: c, error: cErr }, { data: u, error: uErr }] = await Promise.all([
      supabase
        .from("content_reports")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("user_reports")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (cErr) console.warn("[moderation] content_reports fetch failed:", cErr.message);
    if (uErr) console.warn("[moderation] user_reports fetch failed:", uErr.message);
    // P2 — sort by priority desc, then created_at desc, so high-priority
    // reports always head the queue regardless of arrival order.
    setContentReports(sortByPriority((c ?? []) as ContentReport[]));
    setUserReports(sortByPriority((u ?? []) as UserReport[]));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));

    // Realtime: a new pending report should appear at the top without
    // forcing the admin to pull-to-refresh.
    const channel = supabase
      .channel("moderation_queue")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "content_reports" },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_reports" },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const handleContentActionComplete = () => {
    setSelectedContent(null);
    fetchAll();
  };
  const handleUserActionComplete = () => {
    setSelectedUser(null);
    fetchAll();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header
        title={t("moderation_admin.header")}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.tabsBar}>
        <TabPill
          label={t("moderation_admin.tab_content")}
          count={contentReports.length}
          active={tab === "content"}
          onPress={() => setTab("content")}
        />
        <TabPill
          label={t("moderation_admin.tab_users")}
          count={userReports.length}
          active={tab === "users"}
          onPress={() => setTab("users")}
        />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={TEAL}
            />
          }
        >
          {tab === "content" ? (
            contentReports.length === 0 ? (
              <Empty
                icon="shield-checkmark-outline"
                title={t("moderation_admin.empty_content_title")}
                body={t("moderation_admin.empty_content_body")}
              />
            ) : (
              contentReports.map((r) => (
                <ContentReportCard
                  key={r.id}
                  report={r}
                  onPress={() => setSelectedContent(r)}
                  t={t}
                />
              ))
            )
          ) : userReports.length === 0 ? (
            <Empty
              icon="people-outline"
              title={t("moderation_admin.empty_users_title")}
              body={t("moderation_admin.empty_users_body")}
            />
          ) : (
            userReports.map((r) => (
              <UserReportCard
                key={r.id}
                report={r}
                onPress={() => setSelectedUser(r)}
                t={t}
              />
            ))
          )}
        </ScrollView>
      )}

      {selectedContent ? (
        <ContentReportDetail
          report={selectedContent}
          onClose={() => setSelectedContent(null)}
          onActionComplete={handleContentActionComplete}
          t={t}
        />
      ) : null}
      {selectedUser ? (
        <UserReportDetail
          report={selectedUser}
          onClose={() => setSelectedUser(null)}
          onActionComplete={handleUserActionComplete}
          t={t}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Cards
// ══════════════════════════════════════════════════════════════════════════

function ContentReportCard({
  report,
  onPress,
  t,
}: {
  report: ContentReport;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const priority = report.priority ?? "normal";
  const tags = report.tags ?? [];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.cardHeader}>
        <View
          style={[styles.typeBadge, { backgroundColor: typeBg(report.content_type) }]}
        >
          <Text style={[styles.typeBadgeText, { color: typeColor(report.content_type) }]}>
            {t(`moderation_admin.type_${report.content_type}`)}
          </Text>
        </View>
        {/* P2 — priority pill. 'normal' hides because it's the default. */}
        {priority !== "normal" ? (
          <View
            style={[
              styles.priorityPill,
              { backgroundColor: priorityBg(priority), borderColor: priorityFg(priority) },
            ]}
          >
            <Text style={[styles.priorityPillText, { color: priorityFg(priority) }]}>
              {t(`moderation_p2.priority_${priority}`)}
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardDate}>{relTime(report.created_at)}</Text>
      </View>
      <Text style={styles.cardReason}>
        {t(`moderation.reason_${report.reason}_label`)}
      </Text>
      {report.details ? (
        <Text style={styles.cardDetails} numberOfLines={2}>
          {report.details}
        </Text>
      ) : null}
      {/* P2 — auto-flag tag chips */}
      {tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.slice(0, 4).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function UserReportCard({
  report,
  onPress,
  t,
}: {
  report: UserReport;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const priority = report.priority ?? "normal";
  const tags = report.tags ?? [];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: "#FEE2E2" }]}>
          <Text style={[styles.typeBadgeText, { color: RED }]}>
            {t("moderation_admin.type_user")}
          </Text>
        </View>
        {priority !== "normal" ? (
          <View
            style={[
              styles.priorityPill,
              { backgroundColor: priorityBg(priority), borderColor: priorityFg(priority) },
            ]}
          >
            <Text style={[styles.priorityPillText, { color: priorityFg(priority) }]}>
              {t(`moderation_p2.priority_${priority}`)}
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardDate}>{relTime(report.created_at)}</Text>
      </View>
      <Text style={styles.cardReason}>
        {t(`moderation.reason_${report.reason}_label`)}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {t("moderation_admin.against_user", {
          id: report.reported_user_id.slice(0, 8),
        })}
      </Text>
      {report.details ? (
        <Text style={styles.cardDetails} numberOfLines={2}>
          {report.details}
        </Text>
      ) : null}
      {tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.slice(0, 4).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Content report detail + action modal
// ══════════════════════════════════════════════════════════════════════════

function ContentReportDetail({
  report,
  onClose,
  onActionComplete,
  t,
}: {
  report: ContentReport;
  onClose: () => void;
  onActionComplete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    supabase
      .from(PREVIEW_TABLES[report.content_type])
      .select(PREVIEW_FIELDS[report.content_type])
      .eq("id", report.content_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPreview(data);
      })
      .then(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report.content_id, report.content_type]);

  const previewText = useMemo(() => {
    if (!preview) return null;
    if (report.content_type === "event") return preview.title;
    if (report.content_type === "dream_post") return preview.content;
    if (report.content_type === "comment") return preview.content;
    if (report.content_type === "circle_message") return preview.body;
    return null;
  }, [preview, report.content_type]);

  const dismiss = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("resolve_report", {
      p_report_id: report.id,
      p_report_kind: "content",
      p_action_taken: "dismiss",
      p_admin_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      showToast(t("moderation_admin.toast_failed", { msg: error.message }), "error");
      return;
    }
    showToast(t("moderation_admin.toast_dismissed"), "success");
    onActionComplete();
  };

  const deleteContent = async () => {
    setBusy(true);
    const { error: actionErr } = await supabase.rpc("apply_moderation_action", {
      p_action: "delete_content",
      p_target_type: "content",
      p_target_id: report.content_id,
      p_reason: notes.trim() || t("moderation_admin.default_reason_delete"),
      p_duration: null,
      p_source_report_id: report.id,
      p_source_report_kind: "content",
    });
    setBusy(false);
    if (actionErr) {
      showToast(
        t("moderation_admin.toast_failed", { msg: actionErr.message }),
        "error",
      );
      return;
    }
    // The RPC auto-dismisses every pending content_report tied to the
    // same content_id, so we don't also call resolve_report here.
    showToast(t("moderation_admin.toast_deleted"), "success");
    onActionComplete();
  };

  const warnAuthor = async () => {
    if (!preview?.user_id) {
      showToast(t("moderation_admin.toast_no_author"), "error");
      return;
    }
    setBusy(true);
    const { data: actionId, error: actionErr } = await supabase.rpc(
      "apply_moderation_action",
      {
        p_action: "warn",
        p_target_type: "user",
        p_target_id: preview.user_id,
        p_reason: notes.trim() || t("moderation_admin.default_reason_warn"),
        p_duration: null,
        p_source_report_id: report.id,
        p_source_report_kind: "content",
      },
    );
    if (actionErr) {
      setBusy(false);
      showToast(
        t("moderation_admin.toast_failed", { msg: actionErr.message }),
        "error",
      );
      return;
    }
    const { error: resolveErr } = await supabase.rpc("resolve_report", {
      p_report_id: report.id,
      p_report_kind: "content",
      p_action_taken: "warn",
      p_admin_notes: notes.trim() || null,
    });
    setBusy(false);
    if (resolveErr) {
      console.warn("[moderation] resolve after warn failed:", resolveErr.message);
    }
    showToast(t("moderation_admin.toast_warned"), "success");
    onActionComplete();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t("moderation_admin.detail_title_content")}
          </Text>

          <Text style={styles.sheetLabel}>
            {t(`moderation_admin.type_${report.content_type}`)}
          </Text>

          <View style={styles.previewBox}>
            {previewLoading ? (
              <ActivityIndicator color={TEAL} />
            ) : previewText ? (
              <Text style={styles.previewText} numberOfLines={6}>
                {previewText}
              </Text>
            ) : (
              <Text style={styles.previewMissing}>
                {t("moderation_admin.preview_missing")}
              </Text>
            )}
          </View>

          <DetailMeta
            label={t("moderation_admin.reporter_label")}
            value={report.reporter_user_id.slice(0, 8) + "…"}
          />
          <DetailMeta
            label={t("moderation_admin.reason_label")}
            value={t(`moderation.reason_${report.reason}_label`)}
          />
          {report.details ? (
            <DetailMeta
              label={t("moderation_admin.details_label")}
              value={report.details}
            />
          ) : null}

          <Text style={styles.fieldLabel}>{t("moderation_admin.notes_label")}</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("moderation_admin.notes_placeholder")}
            placeholderTextColor={MUTED}
            multiline
            editable={!busy}
          />

          <View style={styles.actionsCol}>
            <ActionBtn
              label={t("moderation_admin.action_dismiss")}
              onPress={dismiss}
              disabled={busy}
              variant="ghost"
            />
            <ActionBtn
              label={t("moderation_admin.action_warn_author")}
              onPress={warnAuthor}
              disabled={busy}
              variant="warn"
            />
            <ActionBtn
              label={t("moderation_admin.action_delete_content")}
              onPress={deleteContent}
              disabled={busy}
              variant="danger"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// User report detail + action modal
// ══════════════════════════════════════════════════════════════════════════

function UserReportDetail({
  report,
  onClose,
  onActionComplete,
  t,
}: {
  report: UserReport;
  onClose: () => void;
  onActionComplete: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [suspendDays, setSuspendDays] = useState("7");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("id, full_name, suspended_until, banned")
      .eq("id", report.reported_user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data);
      })
      .then(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report.reported_user_id]);

  const runAction = async (
    action: "warn" | "suspend" | "ban" | "dismiss",
  ) => {
    setBusy(true);
    if (action === "dismiss") {
      const { error } = await supabase.rpc("resolve_report", {
        p_report_id: report.id,
        p_report_kind: "user",
        p_action_taken: "dismiss",
        p_admin_notes: notes.trim() || null,
      });
      setBusy(false);
      if (error) {
        showToast(
          t("moderation_admin.toast_failed", { msg: error.message }),
          "error",
        );
        return;
      }
      showToast(t("moderation_admin.toast_dismissed"), "success");
      onActionComplete();
      return;
    }

    // Build the duration for suspend. Days × seconds, then PG interval.
    const duration =
      action === "suspend"
        ? `${Math.max(1, parseInt(suspendDays, 10) || 7)} days`
        : null;

    const { error: actionErr } = await supabase.rpc("apply_moderation_action", {
      p_action: action,
      p_target_type: "user",
      p_target_id: report.reported_user_id,
      p_reason:
        notes.trim() ||
        t(`moderation_admin.default_reason_${action}`),
      p_duration: duration,
      p_source_report_id: report.id,
      p_source_report_kind: "user",
    });
    if (actionErr) {
      setBusy(false);
      showToast(
        t("moderation_admin.toast_failed", { msg: actionErr.message }),
        "error",
      );
      return;
    }
    const { error: resolveErr } = await supabase.rpc("resolve_report", {
      p_report_id: report.id,
      p_report_kind: "user",
      p_action_taken: action,
      p_admin_notes: notes.trim() || null,
    });
    setBusy(false);
    if (resolveErr) {
      console.warn("[moderation] resolve after action failed:", resolveErr.message);
    }
    showToast(t(`moderation_admin.toast_${action}ed`), "success");
    onActionComplete();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t("moderation_admin.detail_title_user")}
          </Text>

          <View style={styles.previewBox}>
            {profileLoading ? (
              <ActivityIndicator color={TEAL} />
            ) : profile ? (
              <>
                <Text style={styles.profileName}>
                  {profile.full_name ?? t("moderation_admin.unnamed_user")}
                </Text>
                {profile.banned ? (
                  <View style={[styles.statusPill, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.statusPillText, { color: RED }]}>
                      {t("moderation_admin.status_banned")}
                    </Text>
                  </View>
                ) : profile.suspended_until ? (
                  <View style={[styles.statusPill, { backgroundColor: "#FEF3C7" }]}>
                    <Text style={[styles.statusPillText, { color: AMBER }]}>
                      {t("moderation_admin.status_suspended_until", {
                        date: new Date(profile.suspended_until).toLocaleString(),
                      })}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.previewMissing}>
                {t("moderation_admin.profile_missing")}
              </Text>
            )}
          </View>

          <DetailMeta
            label={t("moderation_admin.reporter_label")}
            value={report.reporter_user_id.slice(0, 8) + "…"}
          />
          <DetailMeta
            label={t("moderation_admin.reason_label")}
            value={t(`moderation.reason_${report.reason}_label`)}
          />
          {report.details ? (
            <DetailMeta
              label={t("moderation_admin.details_label")}
              value={report.details}
            />
          ) : null}

          <Text style={styles.fieldLabel}>
            {t("moderation_admin.suspend_days_label")}
          </Text>
          <TextInput
            style={[styles.input, { minHeight: 40 }]}
            value={suspendDays}
            onChangeText={setSuspendDays}
            placeholder="7"
            placeholderTextColor={MUTED}
            keyboardType="numeric"
            editable={!busy}
          />

          <Text style={styles.fieldLabel}>{t("moderation_admin.notes_label")}</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder={t("moderation_admin.notes_placeholder")}
            placeholderTextColor={MUTED}
            multiline
            editable={!busy}
          />

          <View style={styles.actionsCol}>
            <ActionBtn
              label={t("moderation_admin.action_dismiss")}
              onPress={() => runAction("dismiss")}
              disabled={busy}
              variant="ghost"
            />
            <ActionBtn
              label={t("moderation_admin.action_warn")}
              onPress={() => runAction("warn")}
              disabled={busy}
              variant="warn"
            />
            <ActionBtn
              label={t("moderation_admin.action_suspend")}
              onPress={() => runAction("suspend")}
              disabled={busy}
              variant="warn"
            />
            <ActionBtn
              label={t("moderation_admin.action_ban")}
              onPress={() => runAction("ban")}
              disabled={busy}
              variant="danger"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <LinearGradient
      colors={[NAVY, "#143654"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </LinearGradient>
  );
}

function TabPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
      {count > 0 ? (
        <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function Empty({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={42} color={MUTED} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

function ActionBtn({
  label,
  onPress,
  disabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "ghost" | "warn" | "danger";
}) {
  const style =
    variant === "ghost"
      ? styles.actionBtnGhost
      : variant === "warn"
      ? styles.actionBtnWarn
      : styles.actionBtnDanger;
  const textStyle =
    variant === "ghost"
      ? styles.actionBtnGhostText
      : styles.actionBtnFilledText;
  return (
    <TouchableOpacity
      style={[style, disabled && styles.actionBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function relTime(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return d.toLocaleDateString();
}
function typeColor(c: string): string {
  if (c === "dream_post") return "#7C3AED";
  if (c === "comment") return "#2563EB";
  if (c === "event") return "#059669";
  if (c === "circle_message") return AMBER;
  return MUTED;
}
function typeBg(c: string): string {
  if (c === "dream_post") return "#EDE9FE";
  if (c === "comment") return "#DBEAFE";
  if (c === "event") return "#D1FAE5";
  if (c === "circle_message") return "#FEF3C7";
  return "#F3F4F6";
}

// P2 — priority palette
function priorityBg(p: ReportPriority): string {
  if (p === "high") return "#FEE2E2";
  if (p === "low") return "#F3F4F6";
  return "#E0E7FF";
}
function priorityFg(p: ReportPriority): string {
  if (p === "high") return RED;
  if (p === "low") return MUTED;
  return NAVY;
}

// ══════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  centerText: { fontSize: 13, color: MUTED },
  deniedTitle: { fontSize: 16, fontWeight: "700", color: TEXT, marginTop: 6 },
  deniedBody: { fontSize: 13, color: MUTED, textAlign: "center" },

  tabsBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  tabActive: { backgroundColor: NAVY },
  tabText: { fontSize: 13, fontWeight: "700", color: MUTED },
  tabTextActive: { color: "#FFFFFF" },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeActive: { backgroundColor: TEAL },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: NAVY },

  listContent: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardDate: { fontSize: 11, color: MUTED },
  cardReason: { fontSize: 14, fontWeight: "700", color: TEXT },
  cardSub: { fontSize: 12, color: MUTED, marginTop: 4 },
  cardDetails: { fontSize: 12, color: MUTED, marginTop: 6 },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  // P2 — priority pill + auto-flag tag chips
  priorityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 6,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  tagChipText: { fontSize: 10, fontWeight: "700", color: "#92400E" },

  empty: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginTop: 8 },
  emptyBody: { fontSize: 12, color: MUTED, textAlign: "center" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 35, 66, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "92%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 12,
  },
  sheetLabel: { fontSize: 11, color: MUTED, fontWeight: "700", marginBottom: 4 },

  previewBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
    minHeight: 60,
    justifyContent: "center",
  },
  previewText: { fontSize: 13, color: TEXT, lineHeight: 19 },
  previewMissing: { fontSize: 12, color: MUTED, fontStyle: "italic" },
  profileName: { fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 6 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: { fontSize: 11, fontWeight: "700" },

  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  metaLabel: { width: 90, fontSize: 12, color: MUTED, fontWeight: "700" },
  metaValue: { flex: 1, fontSize: 12, color: TEXT },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: TEXT, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 6,
  },

  actionsCol: { gap: 8, marginTop: 14 },
  actionBtnGhost: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  actionBtnGhostText: { fontSize: 13, fontWeight: "700", color: MUTED },
  actionBtnWarn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: AMBER,
  },
  actionBtnDanger: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: RED,
  },
  actionBtnFilledText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  actionBtnDisabled: { opacity: 0.5 },
});
