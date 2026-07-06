// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminBugReportDetailScreen.tsx — admin bug report detail + actions
// ═══════════════════════════════════════════════════════════════════════════
//
// Loads one bug_reports row (migration 273) + the reporter's profile.
// Lets an admin: change status (open/in_progress/resolved/closed),
// append a note to admin_notes (timestamped), and optionally insert
// a notification row when resolving.
//
// All writes go via direct supabase calls — bug_reports has an admin
// UPDATE policy added in migration 273, and notifications has an
// open INSERT path (used elsewhere e.g. reactivate_user).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Switch,
  Image,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { showToast } from "../components/Toast";
import AdminErrorState from "../components/AdminErrorState";
import AdminFilterChips from "../components/AdminFilterChips";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = colors.textSecondary;

type Params = { AdminBugReportDetail: { reportId: string } };

interface Report {
  id: string;
  user_id: string;
  type: string | null;
  title: string | null;
  category: string | null;
  help_why: string | null;
  screen_name: string | null;
  description: string | null;
  screenshot_url: string | null;
  device_info: any;
  app_version: string | null;
  status: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  bug: { bg: colors.errorBg, fg: "#991B1B" },
  idea: { bg: colors.warningBg, fg: colors.warningLabel },
};

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
}

const STATUS_VALUES = ["open", "in_progress", "resolved", "closed"] as const;

export default function AdminBugReportDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, "AdminBugReportDetail">>();
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const reportId = route.params?.reportId;

  const [report, setReport] = useState<Report | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [notifyOnResolve, setNotifyOnResolve] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: reportRow, error: reportErr } = await supabase
        .from("bug_reports")
        .select(
          "id, user_id, type, title, category, help_why, screen_name, description, screenshot_url, device_info, app_version, status, admin_notes, resolved_at, created_at",
        )
        .eq("id", reportId)
        .maybeSingle();
      if (reportErr) throw new Error(reportErr.message);
      if (!reportRow) throw new Error("Report not found");
      setReport(reportRow as Report);
      setStatusDraft((reportRow as Report).status ?? "open");

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, full_name, email, kyc_status")
        .eq("id", (reportRow as Report).user_id)
        .maybeSingle();
      setProfile((profileRow as Profile | null) ?? null);
    } catch (err) {
      console.warn("[AdminBugReportDetail] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  // Formatted device_info string. JSON pretty-print keeps the diagnostic
  // data readable; truncating would hide the useful bits (user_agent,
  // os_version) that triage often needs.
  const deviceInfoText = useMemo(() => {
    if (!report?.device_info) return "—";
    try {
      return JSON.stringify(report.device_info, null, 2);
    } catch {
      return String(report.device_info);
    }
  }, [report?.device_info]);

  const hasStatusChange =
    report && statusDraft && statusDraft !== (report.status ?? "open");

  const handleAddNote = useCallback(async () => {
    if (!report || !newNote.trim() || addingNote) return;
    setAddingNote(true);
    try {
      const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
      const prefix = `[${stamp}] `;
      const existing = report.admin_notes?.trim() ?? "";
      const next = existing
        ? `${existing}\n\n${prefix}${newNote.trim()}`
        : `${prefix}${newNote.trim()}`;
      const { error: upErr } = await supabase
        .from("bug_reports")
        .update({ admin_notes: next })
        .eq("id", report.id);
      if (upErr) throw new Error(upErr.message);
      showToast(t("admin_bug_reports.note_added"), "success");
      setNewNote("");
      load();
    } catch (err: any) {
      showToast(err?.message ?? t("admin_bug_reports.update_failed"), "error");
    } finally {
      setAddingNote(false);
    }
  }, [report, newNote, addingNote, t, load]);

  const handleSave = useCallback(async () => {
    if (!report || saving) return;
    if (!hasStatusChange) return;
    setSaving(true);
    try {
      const nextStatus = statusDraft!;
      const update: Record<string, any> = { status: nextStatus };
      // Stamp resolved_at when moving INTO resolved; clear it when
      // moving out. Mirrors what a sane status state machine would do.
      if (nextStatus === "resolved" && report.status !== "resolved") {
        update.resolved_at = new Date().toISOString();
      } else if (nextStatus !== "resolved" && report.status === "resolved") {
        update.resolved_at = null;
      }
      const { error: upErr } = await supabase
        .from("bug_reports")
        .update(update)
        .eq("id", report.id);
      if (upErr) throw new Error(upErr.message);

      // Notify the reporter only when the admin explicitly moved to
      // resolved AND the toggle is on. Insert directly — there's no
      // dedicated RPC for this transition.
      if (
        nextStatus === "resolved" &&
        report.status !== "resolved" &&
        notifyOnResolve
      ) {
        const { error: notifErr } = await supabase
          .from("notifications")
          .insert({
            user_id: report.user_id,
            type: "bug_report_resolved",
            title: "Your bug report was resolved",
            body:
              "Thanks for reporting — we've marked your bug as resolved." +
              (report.screen_name ? ` (${report.screen_name})` : ""),
            data: { bug_report_id: report.id, admin_id: me?.id ?? null },
          });
        if (notifErr) {
          console.warn(
            "[AdminBugReportDetail] notify insert failed:",
            notifErr,
          );
        } else {
          showToast(t("admin_bug_reports.notify_success"), "success");
        }
      }

      showToast(t("admin_bug_reports.status_updated"), "success");
      load();
    } catch (err: any) {
      showToast(err?.message ?? t("admin_bug_reports.update_failed"), "error");
    } finally {
      setSaving(false);
    }
  }, [report, saving, statusDraft, hasStatusChange, notifyOnResolve, me?.id, t, load]);

  if (adminLoading || (loading && !report)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.mutedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!report && error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title={t("admin_bug_reports.detail_title")}
          onBack={() => navigation.goBack()}
        />
        <AdminErrorState onRetry={load} />
      </SafeAreaView>
    );
  }
  if (!report) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <Header
        title={t("admin_bug_reports.detail_title")}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title={t("admin_bug_reports.user")}>
          <TouchableOpacity
            style={styles.userBlock}
            onPress={() =>
              navigation.navigate("AdminUserDetail", { userId: report.user_id })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>
                {profile?.full_name || t("admin.users.no_name")}
              </Text>
              <Text style={styles.userMeta}>{profile?.email ?? "—"}</Text>
              <Text style={styles.userMeta}>
                {t("admin.users.kyc_status")}: {profile?.kyc_status ?? "none"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </Section>

        <Section
          title={
            (report.type ?? "bug") === "idea"
              ? t("feedback.admin_idea_section")
              : t("feedback.admin_bug_section")
          }
        >
          <View style={styles.typeBadgeRow}>
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor:
                    (TYPE_COLORS[report.type ?? "bug"] ?? TYPE_COLORS.bug).bg,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  {
                    color:
                      (TYPE_COLORS[report.type ?? "bug"] ?? TYPE_COLORS.bug).fg,
                  },
                ]}
              >
                {t(`feedback.type_${report.type ?? "bug"}`)}
              </Text>
            </View>
          </View>
          {report.title ? (
            <Field label={t("feedback.title_label")} value={report.title} />
          ) : null}
          {report.category ? (
            <Field
              label={t("feedback.category_label")}
              value={t(`feedback.category_${report.category}`)}
            />
          ) : null}
          <Field
            label={t("admin_bug_reports.screen")}
            value={report.screen_name ?? "—"}
          />
          <Field
            label={t("admin_bug_reports.date")}
            value={
              report.created_at
                ? new Date(report.created_at).toLocaleString()
                : "—"
            }
          />
          {report.app_version ? (
            <Field label="App version" value={report.app_version} />
          ) : null}
          <View style={styles.descBlock}>
            <Text style={styles.descText}>{report.description ?? "—"}</Text>
          </View>
          {report.help_why ? (
            <View style={styles.descBlock}>
              <Text style={styles.helpWhyLabel}>
                {t("feedback.help_why_label")}
              </Text>
              <Text style={styles.descText}>{report.help_why}</Text>
            </View>
          ) : null}
        </Section>

        {report.screenshot_url ? (
          <Section title={t("admin_bug_reports.screenshot")}>
            <TouchableOpacity
              onPress={() => Linking.openURL(report.screenshot_url!)}
              style={styles.shotWrap}
            >
              <Image
                source={{ uri: report.screenshot_url }}
                style={styles.shot}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </Section>
        ) : null}

        <Section title={t("admin_bug_reports.device_info")}>
          <View style={styles.deviceBlock}>
            <Text style={styles.deviceText}>{deviceInfoText}</Text>
          </View>
        </Section>

        <Section title={t("admin.filter_status")}>
          <View style={{ paddingVertical: 4 }}>
            <AdminFilterChips
              label=""
              allLabel={t("admin_bug_reports.status_all")}
              value={statusDraft}
              onChange={(v) => setStatusDraft(v ?? (report.status ?? "open"))}
              options={STATUS_VALUES.map((v) => ({
                value: v,
                label: t(`admin_bug_reports.status_${v}`),
              }))}
            />
          </View>
          {statusDraft === "resolved" && report.status !== "resolved" ? (
            <View style={styles.notifyRow}>
              <Text style={styles.notifyLabel}>
                {t("admin_bug_reports.notify_user")}
              </Text>
              <Switch
                value={notifyOnResolve}
                onValueChange={setNotifyOnResolve}
              />
            </View>
          ) : null}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!hasStatusChange || saving) && styles.btnDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasStatusChange || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.cardBg} />
            ) : (
              <Text style={styles.saveBtnText}>
                {t("admin_bug_reports.save")}
              </Text>
            )}
          </TouchableOpacity>
        </Section>

        <Section title={t("admin_bug_reports.admin_notes")}>
          {report.admin_notes ? (
            <View style={styles.notesHistory}>
              <Text style={styles.notesHistoryText}>{report.admin_notes}</Text>
            </View>
          ) : null}
          <TextInput
            style={styles.noteInput}
            placeholder={t("admin_bug_reports.note_placeholder")}
            placeholderTextColor={MUTED}
            value={newNote}
            onChangeText={setNewNote}
            multiline
            maxLength={500}
            editable={!addingNote}
          />
          <TouchableOpacity
            style={[
              styles.addNoteBtn,
              (!newNote.trim() || addingNote) && styles.btnDisabled,
            ]}
            onPress={handleAddNote}
            disabled={!newNote.trim() || addingNote}
          >
            {addingNote ? (
              <ActivityIndicator size="small" color={NAVY} />
            ) : (
              <Text style={styles.addNoteBtnText}>
                {t("admin_bug_reports.add_note")}
              </Text>
            )}
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    textAlign: "center",
  },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  fieldLabel: { fontSize: typography.label, color: MUTED },
  fieldValue: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.medium,
    flexShrink: 1,
    textAlign: "right",
  },
  userBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.bold,
  },
  userMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  descBlock: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F3F4F6",
  },
  descText: { fontSize: typography.body, color: NAVY, lineHeight: 20 },
  typeBadgeRow: { flexDirection: "row", marginBottom: 8 },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: typography.bold,
  },
  helpWhyLabel: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.medium,
    marginBottom: 4,
  },
  shotWrap: {
    width: "100%",
    height: 200,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  shot: { width: "100%", height: "100%" },
  deviceBlock: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: spacing.sm,
  },
  deviceText: {
    fontSize: 11,
    color: NAVY,
    fontFamily: "monospace",
  },
  notifyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  notifyLabel: { fontSize: typography.body, color: NAVY },
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  saveBtnText: {
    color: colors.cardBg,
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
  btnDisabled: { opacity: 0.5 },
  notesHistory: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: spacing.sm,
  },
  notesHistoryText: {
    fontSize: typography.label,
    color: NAVY,
    lineHeight: 18,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
    color: NAVY,
    fontSize: typography.body,
    marginTop: spacing.sm,
  },
  addNoteBtn: {
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  addNoteBtnText: {
    color: NAVY,
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
