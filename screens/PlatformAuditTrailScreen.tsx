// ══════════════════════════════════════════════════════════════════════════════
// screens/PlatformAuditTrailScreen.tsx — Platform-Admin audit log viewer
// ══════════════════════════════════════════════════════════════════════════════
//
// Tab structure (Audit Trail P2):
//   1. Audit logs — get_audit_logs(p_filters, p_limit, p_offset) paged list
//      with filters. Export button enqueues a background CSV job via
//      create_audit_export_job and switches to the Exports tab.
//   2. Anomalies — audit_anomalies surface populated by the
//      detect-audit-anomalies Edge Function. Mark-as-reviewed flips
//      reviewed_at/by via the admin UPDATE RLS policy (mig 163).
//   3. Exports — audit_export_jobs queue. Realtime-driven via
//      admin_audit_export_ready notifications, with 5s polling as
//      fallback while any job is queued/running. Download uses a
//      5-minute signed URL on the private audit-exports bucket (mig 165).
//
// Frontend gate mirrors the rest of the admin suite — useIsAdmin() short-
// circuits before any data hook runs. The underlying RLS on audit_logs is
// admin-SELECT-only via public.is_admin(); the screen gate just avoids
// the wasted query for a non-admin.
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
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { showToast } from "../components/Toast";
import {
  useAuditAnomalies,
  type AuditAnomaly,
  type AnomalySeverity,
  type AnomalyType,
} from "../hooks/useAuditAnomalies";
import {
  useAuditExports,
  type AuditExportJob,
  type AuditExportStatus,
} from "../hooks/useAuditExports";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const TEXT = "#111827";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const PAGE_SIZE = 50;

// Tables the trigger function watches — migration 153 lists exactly
// these. Keep in sync if the migration adds / removes a table.
const TABLE_OPTIONS = [
  "profiles",
  "kyc_verifications",
  "user_wallets",
  "money_transfers",
  "contributions",
  "payouts",
  "dispute_cases",
  "mediation_cases",
  "moderation_actions",
  "circles",
  "circle_members",
  "feed_posts",
  "community_events",
] as const;
const ACTION_OPTIONS = ["INSERT", "UPDATE", "DELETE"] as const;

type AuditFilters = {
  table_name?: string;
  action?: string;
  changed_by?: string;
  record_id?: string;
  date_from?: string;
  date_to?: string;
};

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  source?: string | null;
};

type ActorRow = {
  user_id: string;
  email: string | null;
  last_seen: string;
};

export default function PlatformAuditTrailScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t("platform_audit.header")} onBack={() => navigation.goBack()} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.centerText}>{t("platform_audit.checking")}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title={t("platform_audit.header")} onBack={() => navigation.goBack()} />
        <View style={styles.centerState}>
          <Ionicons name="lock-closed-outline" size={40} color={RED} />
          <Text style={styles.deniedTitle}>{t("platform_audit.denied_title")}</Text>
          <Text style={styles.deniedBody}>{t("platform_audit.denied_body")}</Text>
        </View>
      </SafeAreaView>
    );
  }
  return <AuditBody />;
}

// ══════════════════════════════════════════════════════════════════════════
// Body
// ══════════════════════════════════════════════════════════════════════════

type Tab = "logs" | "anomalies" | "exports";

function AuditBody() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [tab, setTab] = useState<Tab>("logs");
  const [filters, setFilters] = useState<AuditFilters>({});
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [actors, setActors] = useState<ActorRow[]>([]);
  const [actorPickerOpen, setActorPickerOpen] = useState(false);

  const anomaliesApi = useAuditAnomalies();
  const exportsApi = useAuditExports();

  const cleanFilters = useMemo(() => {
    // Drop empty strings — the RPC handles missing keys but a bare
    // "" can confuse a strict equals check, so we strip them here.
    const out: AuditFilters = {};
    (Object.keys(filters) as (keyof AuditFilters)[]).forEach((k) => {
      const v = filters[k];
      if (v && v.trim().length > 0) out[k] = v.trim();
    });
    return out;
  }, [filters]);

  const fetchPage = useCallback(
    async (replace: boolean, currentOffset: number) => {
      const { data, error } = await supabase.rpc("get_audit_logs", {
        p_filters: cleanFilters as Record<string, string>,
        p_limit: PAGE_SIZE,
        p_offset: currentOffset,
      });
      if (error) {
        showToast(
          t("platform_audit.toast_fetch_failed", { msg: error.message }),
          "error",
        );
        return;
      }
      const payload = data as { rows: AuditRow[]; total_count: number } | null;
      const nextRows = payload?.rows ?? [];
      setTotal(payload?.total_count ?? 0);
      setRows((prev) => (replace ? nextRows : [...prev, ...nextRows]));
    },
    [cleanFilters, t],
  );

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    fetchPage(true, 0).finally(() => setLoading(false));
  }, [fetchPage]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("list_distinct_audit_actors")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[audit] actor list failed:", error.message);
          return;
        }
        setActors((data ?? []) as ActorRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(0);
    await fetchPage(true, 0);
    setRefreshing(false);
  }, [fetchPage]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    const nextOffset = offset + PAGE_SIZE;
    await fetchPage(false, nextOffset);
    setOffset(nextOffset);
    setLoadingMore(false);
  }, [fetchPage, loadingMore, offset, rows.length, total]);

  // P2: always enqueue a background job. The worker fans out a
  // notification when the CSV is ready, and the Exports tab surfaces it.
  // The old inline download path is gone — every export is async now.
  const onExport = useCallback(async () => {
    setExportBusy(true);
    const id = await exportsApi.createJob(
      cleanFilters as Record<string, string>,
    );
    setExportBusy(false);
    if (!id) {
      showToast(
        t("platform_audit_p2.toast_export_enqueue_failed", {
          msg: exportsApi.error ?? "",
        }),
        "error",
      );
      return;
    }
    showToast(t("platform_audit_p2.toast_export_queued"), "success");
    setTab("exports");
  }, [cleanFilters, exportsApi, t]);

  const applyFilters = (next: AuditFilters) => {
    setFilters(next);
    setFiltersOpen(false);
  };

  const activeFilterCount = Object.keys(cleanFilters).length;

  return (
    <SafeAreaView style={styles.safe}>
      <Header
        title={t("platform_audit.header")}
        onBack={() => navigation.goBack()}
        rightSlot={
          <TouchableOpacity
            onPress={onExport}
            disabled={exportBusy}
            style={styles.exportBtn}
            accessibilityRole="button"
            accessibilityLabel={t("platform_audit.export")}
          >
            {exportBusy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={14} color="#FFFFFF" />
                <Text style={styles.exportBtnText}>
                  {t("platform_audit.export")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        }
      />

      <View style={styles.retentionBanner}>
        <Ionicons name="time-outline" size={13} color={MUTED} />
        <Text style={styles.retentionText}>
          {t("platform_audit.retention_banner")}
        </Text>
      </View>

      <TabStrip
        active={tab}
        onChange={(next) => {
          setTab(next);
          if (next === "exports") exportsApi.clearNewReady();
        }}
        unreviewedCount={anomaliesApi.anomalies.filter((a) => !a.reviewed_at).length}
        readyBadge={exportsApi.newReadyCount}
        t={t}
      />

      {tab === "logs" ? (
        <>
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={styles.filterTrigger}
              onPress={() => setFiltersOpen(true)}
              accessibilityRole="button"
            >
              <Ionicons name="options-outline" size={14} color={NAVY} />
              <Text style={styles.filterTriggerText}>
                {t("platform_audit.filters")}
              </Text>
              {activeFilterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={styles.totalText}>
              {t("platform_audit.total", { n: total })}
            </Text>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={TEAL} />
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="documents-outline" size={36} color={MUTED} />
              <Text style={styles.emptyTitle}>
                {t("platform_audit.empty_title")}
              </Text>
              <Text style={styles.emptyBody}>
                {t("platform_audit.empty_body")}
              </Text>
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
              {rows.map((r) => (
                <AuditRowCard
                  key={r.id}
                  row={r}
                  actors={actors}
                  onPress={() => setSelected(r)}
                  t={t}
                />
              ))}
              {rows.length < total ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={onLoadMore}
                  disabled={loadingMore}
                  accessibilityRole="button"
                >
                  {loadingMore ? (
                    <ActivityIndicator color={TEAL} />
                  ) : (
                    <Text style={styles.loadMoreText}>
                      {t("platform_audit.load_more", {
                        remaining: total - rows.length,
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          )}
        </>
      ) : tab === "anomalies" ? (
        <AnomaliesTab api={anomaliesApi} t={t} />
      ) : (
        <ExportsTab api={exportsApi} t={t} />
      )}

      <FiltersSheet
        open={filtersOpen}
        initial={filters}
        onApply={applyFilters}
        onClose={() => setFiltersOpen(false)}
        onPickActor={() => setActorPickerOpen(true)}
        t={t}
      />
      <ActorPicker
        open={actorPickerOpen}
        actors={actors}
        onPick={(actor) => {
          setFilters((prev) => ({ ...prev, changed_by: actor?.user_id ?? "" }));
          setActorPickerOpen(false);
        }}
        onClose={() => setActorPickerOpen(false)}
        t={t}
      />
      {selected ? (
        <DetailModal
          row={selected}
          actors={actors}
          onClose={() => setSelected(null)}
          t={t}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Row card
// ══════════════════════════════════════════════════════════════════════════

function AuditRowCard({
  row,
  actors,
  onPress,
  t,
}: {
  row: AuditRow;
  actors: ActorRow[];
  onPress: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const actor = actors.find((a) => a.user_id === row.changed_by);
  const summary = buildSummary(row);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.actionPill,
            { backgroundColor: actionBg(row.action) },
          ]}
        >
          <Text
            style={[styles.actionPillText, { color: actionFg(row.action) }]}
          >
            {row.action}
          </Text>
        </View>
        <Text style={styles.cardTable}>{row.table_name}</Text>
        <Text style={styles.cardDate}>{shortTime(row.changed_at)}</Text>
      </View>
      <Text style={styles.cardActor} numberOfLines={1}>
        {actor?.email ??
          (row.changed_by ? row.changed_by.slice(0, 8) + "…" : t("platform_audit.actor_system"))}
      </Text>
      {summary ? (
        <Text style={styles.cardSummary} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Filters sheet
// ══════════════════════════════════════════════════════════════════════════

function FiltersSheet({
  open,
  initial,
  onApply,
  onClose,
  onPickActor,
  t,
}: {
  open: boolean;
  initial: AuditFilters;
  onApply: (f: AuditFilters) => void;
  onClose: () => void;
  onPickActor: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const [draft, setDraft] = useState<AuditFilters>(initial);
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const reset = () => setDraft({});

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t("platform_audit.filters")}</Text>

          <Text style={styles.fieldLabel}>
            {t("platform_audit.filter_table")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipsRow}>
              <Chip
                label={t("platform_audit.any")}
                active={!draft.table_name}
                onPress={() => setDraft({ ...draft, table_name: undefined })}
              />
              {TABLE_OPTIONS.map((tbl) => (
                <Chip
                  key={tbl}
                  label={tbl}
                  active={draft.table_name === tbl}
                  onPress={() => setDraft({ ...draft, table_name: tbl })}
                />
              ))}
            </View>
          </ScrollView>

          <Text style={styles.fieldLabel}>
            {t("platform_audit.filter_action")}
          </Text>
          <View style={styles.chipsRow}>
            <Chip
              label={t("platform_audit.any")}
              active={!draft.action}
              onPress={() => setDraft({ ...draft, action: undefined })}
            />
            {ACTION_OPTIONS.map((a) => (
              <Chip
                key={a}
                label={a}
                active={draft.action === a}
                onPress={() => setDraft({ ...draft, action: a })}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            {t("platform_audit.filter_actor")}
          </Text>
          <TouchableOpacity
            style={styles.actorPickerBtn}
            onPress={onPickActor}
            accessibilityRole="button"
          >
            <Ionicons name="person-circle-outline" size={18} color={NAVY} />
            <Text style={styles.actorPickerText}>
              {draft.changed_by
                ? draft.changed_by.slice(0, 8) + "…"
                : t("platform_audit.actor_any")}
            </Text>
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>
            {t("platform_audit.filter_record_id")}
          </Text>
          <TextInput
            style={styles.input}
            value={draft.record_id ?? ""}
            onChangeText={(v) => setDraft({ ...draft, record_id: v })}
            placeholder={t("platform_audit.record_placeholder")}
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>
            {t("platform_audit.filter_date_range")}
          </Text>
          <View style={styles.dateRangeRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={draft.date_from ?? ""}
              onChangeText={(v) => setDraft({ ...draft, date_from: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
            />
            <Text style={styles.dateSep}>→</Text>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={draft.date_to ?? ""}
              onChangeText={(v) => setDraft({ ...draft, date_to: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={reset}
              accessibilityRole="button"
            >
              <Text style={styles.resetBtnText}>
                {t("platform_audit.reset")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => onApply(draft)}
              accessibilityRole="button"
            >
              <Text style={styles.applyBtnText}>
                {t("platform_audit.apply")}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Actor picker
// ══════════════════════════════════════════════════════════════════════════

function ActorPicker({
  open,
  actors,
  onPick,
  onClose,
  t,
}: {
  open: boolean;
  actors: ActorRow[];
  onPick: (a: ActorRow | null) => void;
  onClose: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actors;
    return actors.filter(
      (a) =>
        (a.email ?? "").toLowerCase().includes(needle) ||
        a.user_id.toLowerCase().startsWith(needle),
    );
  }, [actors, q]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t("platform_audit.filter_actor")}
          </Text>
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder={t("platform_audit.actor_search_placeholder")}
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.actorRow}
            onPress={() => onPick(null)}
            accessibilityRole="button"
          >
            <Ionicons name="people-outline" size={18} color={MUTED} />
            <Text style={styles.actorRowText}>
              {t("platform_audit.actor_any")}
            </Text>
          </TouchableOpacity>
          <ScrollView style={{ maxHeight: 400 }}>
            {matches.map((a) => (
              <TouchableOpacity
                key={a.user_id}
                style={styles.actorRow}
                onPress={() => onPick(a)}
                accessibilityRole="button"
              >
                <Ionicons name="person-circle-outline" size={18} color={NAVY} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actorRowText} numberOfLines={1}>
                    {a.email ?? a.user_id.slice(0, 8) + "…"}
                  </Text>
                  <Text style={styles.actorRowSub}>
                    {t("platform_audit.last_seen", {
                      when: shortTime(a.last_seen),
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {matches.length === 0 ? (
              <Text style={styles.actorEmpty}>
                {t("platform_audit.actor_none")}
              </Text>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Detail modal
// ══════════════════════════════════════════════════════════════════════════

function DetailModal({
  row,
  actors,
  onClose,
  t,
}: {
  row: AuditRow;
  actors: ActorRow[];
  onClose: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const actor = actors.find((a) => a.user_id === row.changed_by);
  const diff = useMemo(() => diffJsons(row.old_data, row.new_data), [row]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetTall} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.detailHeader}>
            <View
              style={[
                styles.actionPill,
                { backgroundColor: actionBg(row.action) },
              ]}
            >
              <Text
                style={[styles.actionPillText, { color: actionFg(row.action) }]}
              >
                {row.action}
              </Text>
            </View>
            <Text style={styles.sheetTitle}>{row.table_name}</Text>
          </View>

          <ScrollView style={{ marginTop: 6 }}>
            <Meta label={t("platform_audit.detail_when")} value={fullTime(row.changed_at)} />
            <Meta
              label={t("platform_audit.detail_actor")}
              value={actor?.email ?? row.changed_by ?? t("platform_audit.actor_system")}
            />
            <Meta
              label={t("platform_audit.detail_record_id")}
              value={row.record_id}
            />
            {row.ip_address ? (
              <Meta
                label={t("platform_audit.detail_ip")}
                value={row.ip_address}
              />
            ) : null}
            {row.user_agent ? (
              <Meta
                label={t("platform_audit.detail_user_agent")}
                value={row.user_agent}
              />
            ) : null}
            {row.source ? (
              <Meta
                label={t("platform_audit.detail_source")}
                value={row.source}
              />
            ) : null}

            {diff.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>
                  {t("platform_audit.detail_changes")}
                </Text>
                {diff.map((d) => (
                  <View key={d.key} style={styles.diffRow}>
                    <Text style={styles.diffKey}>{d.key}</Text>
                    <View style={styles.diffValues}>
                      <Text style={styles.diffOld} numberOfLines={3}>
                        {stringify(d.before)}
                      </Text>
                      <Ionicons name="arrow-forward" size={12} color={MUTED} />
                      <Text style={styles.diffNew} numberOfLines={3}>
                        {stringify(d.after)}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}

            <Text style={styles.sectionTitle}>
              {t("platform_audit.detail_raw")}
            </Text>
            {row.old_data ? (
              <>
                <Text style={styles.rawLabel}>old_data</Text>
                <View style={styles.rawBlock}>
                  <Text style={styles.rawText} selectable>
                    {JSON.stringify(row.old_data, null, 2)}
                  </Text>
                </View>
              </>
            ) : null}
            {row.new_data ? (
              <>
                <Text style={styles.rawLabel}>new_data</Text>
                <View style={styles.rawBlock}>
                  <Text style={styles.rawText} selectable>
                    {JSON.stringify(row.new_data, null, 2)}
                  </Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function Header({
  title,
  onBack,
  rightSlot,
}: {
  title: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
}) {
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
      <View style={{ minWidth: 36, alignItems: "flex-end" }}>
        {rightSlot}
      </View>
    </LinearGradient>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} selectable>
        {value}
      </Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Tab strip
// ══════════════════════════════════════════════════════════════════════════

function TabStrip({
  active,
  onChange,
  unreviewedCount,
  readyBadge,
  t,
}: {
  active: Tab;
  onChange: (next: Tab) => void;
  unreviewedCount: number;
  readyBadge: number;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  return (
    <View style={styles.tabStrip}>
      <TabButton
        label={t("platform_audit_p2.tab_logs")}
        active={active === "logs"}
        onPress={() => onChange("logs")}
      />
      <TabButton
        label={t("platform_audit_p2.tab_anomalies")}
        active={active === "anomalies"}
        onPress={() => onChange("anomalies")}
        badge={unreviewedCount > 0 ? unreviewedCount : undefined}
        badgeTone="warn"
      />
      <TabButton
        label={t("platform_audit_p2.tab_exports")}
        active={active === "exports"}
        onPress={() => onChange("exports")}
        badge={readyBadge > 0 ? readyBadge : undefined}
        badgeTone="ok"
      />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  badge,
  badgeTone,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
  badgeTone?: "ok" | "warn";
}) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
        {label}
      </Text>
      {typeof badge === "number" ? (
        <View
          style={[
            styles.tabBadge,
            { backgroundColor: badgeTone === "warn" ? AMBER : TEAL },
          ]}
        >
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Anomalies tab
// ══════════════════════════════════════════════════════════════════════════

const ANOMALY_TYPE_KEY: Record<AnomalyType, string> = {
  failed_login_burst: "platform_audit_p2.type_failed_login_burst",
  profile_churn: "platform_audit_p2.type_profile_churn",
  admin_ban_burst: "platform_audit_p2.type_admin_ban_burst",
};

const SEVERITY_BG: Record<AnomalySeverity, string> = {
  high: "#FEE2E2",
  medium: "#FEF3C7",
  low: "#E0E7FF",
};
const SEVERITY_FG: Record<AnomalySeverity, string> = {
  high: RED,
  medium: "#92400E",
  low: "#3730A3",
};

function AnomaliesTab({
  api,
  t,
}: {
  api: ReturnType<typeof useAuditAnomalies>;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await api.refresh();
    setRefreshing(false);
  }, [api]);

  if (api.loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }
  if (api.anomalies.length === 0) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="shield-checkmark-outline" size={36} color={MUTED} />
        <Text style={styles.emptyTitle}>
          {t("platform_audit_p2.anom_empty_title")}
        </Text>
        <Text style={styles.emptyBody}>
          {t("platform_audit_p2.anom_empty_body")}
        </Text>
      </View>
    );
  }

  return (
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
      {api.anomalies.map((a) => (
        <AnomalyCard
          key={a.id}
          row={a}
          t={t}
          onMarkReviewed={async () => {
            const ok = await api.markReviewed(a.id);
            if (ok) {
              showToast(t("platform_audit_p2.anom_marked_toast"), "success");
            } else {
              showToast(
                t("platform_audit_p2.anom_mark_failed_toast", {
                  msg: api.error ?? "",
                }),
                "error",
              );
            }
          }}
        />
      ))}
    </ScrollView>
  );
}

function AnomalyCard({
  row,
  t,
  onMarkReviewed,
}: {
  row: AuditAnomaly;
  t: (k: string, o?: Record<string, unknown>) => string;
  onMarkReviewed: () => void;
}) {
  const reviewed = !!row.reviewed_at;
  return (
    <View style={[styles.card, reviewed && styles.cardReviewed]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.severityPill,
            { backgroundColor: SEVERITY_BG[row.severity] },
          ]}
        >
          <Text
            style={[
              styles.severityPillText,
              { color: SEVERITY_FG[row.severity] },
            ]}
          >
            {t(`platform_audit_p2.severity_${row.severity}`)}
          </Text>
        </View>
        <Text style={styles.cardTable}>
          {t(ANOMALY_TYPE_KEY[row.anomaly_type])}
        </Text>
        <Text style={styles.cardDate}>{shortTime(row.detected_at)}</Text>
      </View>
      <Text style={styles.anomDesc} numberOfLines={3}>
        {row.description}
      </Text>
      {row.related_audit_ids.length > 0 ? (
        <Text style={styles.anomMeta}>
          {t("platform_audit_p2.anom_related", {
            n: row.related_audit_ids.length,
          })}
        </Text>
      ) : null}
      <View style={styles.anomFooter}>
        {reviewed ? (
          <View style={styles.reviewedTag}>
            <Ionicons name="checkmark-circle" size={12} color="#059669" />
            <Text style={styles.reviewedText}>
              {t("platform_audit_p2.anom_reviewed_at", {
                when: shortTime(row.reviewed_at as string),
              })}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={onMarkReviewed}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            <Text style={styles.reviewBtnText}>
              {t("platform_audit_p2.anom_mark_reviewed")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Exports tab
// ══════════════════════════════════════════════════════════════════════════

const STATUS_BG: Record<AuditExportStatus, string> = {
  queued: "#E0E7FF",
  running: "#DBEAFE",
  completed: "#D1FAE5",
  failed: "#FEE2E2",
};
const STATUS_FG: Record<AuditExportStatus, string> = {
  queued: "#3730A3",
  running: "#1E40AF",
  completed: "#065F46",
  failed: RED,
};

function ExportsTab({
  api,
  t,
}: {
  api: ReturnType<typeof useAuditExports>;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await api.refresh();
    setRefreshing(false);
  }, [api]);

  const onDownload = useCallback(
    async (job: AuditExportJob) => {
      if (!job.file_path) return;
      const { url, error } = await api.getDownloadUrl(job.file_path);
      if (!url) {
        showToast(
          t("platform_audit_p2.export_download_failed", { msg: error ?? "" }),
          "error",
        );
        return;
      }
      try {
        await Linking.openURL(url);
      } catch (e: any) {
        showToast(
          t("platform_audit_p2.export_download_failed", {
            msg: e?.message ?? "",
          }),
          "error",
        );
      }
    },
    [api, t],
  );

  if (api.loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }
  if (api.jobs.length === 0) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="download-outline" size={36} color={MUTED} />
        <Text style={styles.emptyTitle}>
          {t("platform_audit_p2.export_empty_title")}
        </Text>
        <Text style={styles.emptyBody}>
          {t("platform_audit_p2.export_empty_body")}
        </Text>
      </View>
    );
  }

  return (
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
      {api.jobs.map((j) => (
        <ExportJobCard
          key={j.id}
          job={j}
          t={t}
          onDownload={() => onDownload(j)}
        />
      ))}
    </ScrollView>
  );
}

function ExportJobCard({
  job,
  t,
  onDownload,
}: {
  job: AuditExportJob;
  t: (k: string, o?: Record<string, unknown>) => string;
  onDownload: () => void;
}) {
  const filterParts = Object.entries(job.filters ?? {})
    .filter(([_, v]) => typeof v === "string" && v.length > 0)
    .map(([k, v]) => `${k}=${v}`);
  const filterText =
    filterParts.length > 0
      ? filterParts.join(" · ")
      : t("platform_audit_p2.export_no_filters");

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.severityPill,
            { backgroundColor: STATUS_BG[job.status] },
          ]}
        >
          <Text
            style={[
              styles.severityPillText,
              { color: STATUS_FG[job.status] },
            ]}
          >
            {t(`platform_audit_p2.export_status_${job.status}`)}
          </Text>
        </View>
        <Text style={styles.cardDate}>{shortTime(job.created_at)}</Text>
      </View>
      <Text style={styles.exportFilters} numberOfLines={2}>
        {filterText}
      </Text>
      {job.status === "completed" ? (
        <>
          <Text style={styles.exportMeta}>
            {t("platform_audit_p2.export_rows", { n: job.total_rows ?? 0 })}
          </Text>
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={onDownload}
            accessibilityRole="button"
          >
            <Ionicons name="download-outline" size={14} color="#FFFFFF" />
            <Text style={styles.downloadBtnText}>
              {t("platform_audit_p2.export_download")}
            </Text>
          </TouchableOpacity>
        </>
      ) : job.status === "failed" ? (
        <Text style={styles.exportError} numberOfLines={3}>
          {job.error_message ?? t("platform_audit_p2.export_unknown_error")}
        </Text>
      ) : (
        <View style={styles.exportPending}>
          <ActivityIndicator size="small" color={TEAL} />
          <Text style={styles.exportPendingText}>
            {t("platform_audit_p2.export_in_progress")}
          </Text>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function actionBg(a: string): string {
  if (a === "INSERT") return "#D1FAE5";
  if (a === "UPDATE") return "#DBEAFE";
  if (a === "DELETE") return "#FEE2E2";
  return "#F3F4F6";
}
function actionFg(a: string): string {
  if (a === "INSERT") return "#059669";
  if (a === "UPDATE") return "#2563EB";
  if (a === "DELETE") return RED;
  return MUTED;
}
function shortTime(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return d.toLocaleDateString();
}
function fullTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
function stringify(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
function diffJsons(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): { key: string; before: unknown; after: unknown }[] {
  if (!before && !after) return [];
  if (!before) {
    return Object.keys(after ?? {}).map((k) => ({
      key: k,
      before: undefined,
      after: (after as Record<string, unknown>)[k],
    }));
  }
  if (!after) {
    return Object.keys(before).map((k) => ({
      key: k,
      before: before[k],
      after: undefined,
    }));
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: { key: string; before: unknown; after: unknown }[] = [];
  keys.forEach((k) => {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ key: k, before: a, after: b });
    }
  });
  return out;
}
function buildSummary(row: AuditRow): string {
  const d = diffJsons(row.old_data, row.new_data).slice(0, 2);
  if (d.length === 0) {
    if (row.action === "INSERT") return `New ${row.table_name} row`;
    if (row.action === "DELETE") return `Deleted ${row.table_name} row`;
    return "";
  }
  return d
    .map((x) => `${x.key}: ${stringify(x.before)} → ${stringify(x.after)}`)
    .join(" · ");
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
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  exportBtnText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },

  retentionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFBEB",
    borderBottomWidth: 1,
    borderBottomColor: "#FCD34D",
  },
  retentionText: { fontSize: 11, color: MUTED, flex: 1 },

  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  filterTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FAFB",
  },
  filterTriggerText: { fontSize: 12, fontWeight: "700", color: NAVY },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: TEAL,
    minWidth: 16,
    alignItems: "center",
  },
  filterBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  totalText: { fontSize: 12, color: MUTED },

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
  emptyTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginTop: 8 },
  emptyBody: { fontSize: 12, color: MUTED, textAlign: "center" },

  listContent: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardTable: { flex: 1, fontSize: 12, fontWeight: "700", color: NAVY },
  cardDate: { fontSize: 11, color: MUTED },
  cardActor: { fontSize: 12, color: TEXT, marginBottom: 4 },
  cardSummary: { fontSize: 11, color: MUTED },

  actionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actionPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },

  loadMoreBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    marginTop: 4,
  },
  loadMoreText: { fontSize: 13, fontWeight: "700", color: TEAL },

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
    maxHeight: "90%",
  },
  sheetTall: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "94%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: NAVY, marginBottom: 10 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: TEXT, marginTop: 12, marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { fontSize: 11, fontWeight: "700", color: NAVY },
  chipTextActive: { color: "#FFFFFF" },

  actorPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FAFB",
  },
  actorPickerText: { fontSize: 13, color: TEXT },

  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT,
  },
  dateRangeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateInput: { flex: 1 },
  dateSep: { fontSize: 14, color: MUTED },

  sheetActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  resetBtnText: { fontSize: 13, fontWeight: "700", color: MUTED },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  applyBtnText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },

  actorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  actorRowText: { fontSize: 13, fontWeight: "600", color: TEXT },
  actorRowSub: { fontSize: 10, color: MUTED, marginTop: 2 },
  actorEmpty: { fontSize: 12, color: MUTED, textAlign: "center", paddingVertical: 12 },

  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  metaLabel: { fontSize: 11, color: MUTED, fontWeight: "700" },
  metaValue: { fontSize: 12, color: TEXT, marginTop: 2 },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: NAVY, marginTop: 14, marginBottom: 6 },

  diffRow: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 6,
  },
  diffKey: { fontSize: 11, fontWeight: "700", color: NAVY, marginBottom: 4 },
  diffValues: { flexDirection: "row", alignItems: "center", gap: 6 },
  diffOld: { flex: 1, fontSize: 11, color: RED, textDecorationLine: "line-through" },
  diffNew: { flex: 1, fontSize: 11, color: "#059669" },

  rawLabel: { fontSize: 10, color: MUTED, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  rawBlock: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 10,
  },
  rawText: { fontSize: 11, color: "#E2E8F0", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // ── Tab strip ────────────────────────────────────────────────────────
  tabStrip: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: TEAL },
  tabBtnText: { fontSize: 12, fontWeight: "700", color: MUTED },
  tabBtnTextActive: { color: NAVY },
  tabBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },

  // ── Anomaly card extras ──────────────────────────────────────────────
  cardReviewed: { opacity: 0.65 },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  severityPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  anomDesc: { fontSize: 12, color: TEXT, marginTop: 4 },
  anomMeta: { fontSize: 10, color: MUTED, marginTop: 4 },
  anomFooter: { marginTop: 10, flexDirection: "row" },
  reviewedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
  },
  reviewedText: { fontSize: 11, color: "#059669", fontWeight: "700" },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: NAVY,
    borderRadius: 8,
  },
  reviewBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  // ── Export card ──────────────────────────────────────────────────────
  exportFilters: { fontSize: 12, color: TEXT, marginTop: 4 },
  exportMeta: { fontSize: 11, color: MUTED, marginTop: 4 },
  exportError: { fontSize: 11, color: RED, marginTop: 6 },
  exportPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  exportPendingText: { fontSize: 11, color: MUTED },
  downloadBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    backgroundColor: TEAL,
    borderRadius: 8,
  },
  downloadBtnText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
});
