// ══════════════════════════════════════════════════════════════════════════════
// ProviderDashboardScreen — the provider's own surface
// ══════════════════════════════════════════════════════════════════════════════
// Phase 1C. Header (business name + verification badge + status), stat row
// (jobs done, total earned, rating, jobs in progress), four tabs:
//   • Overview     — stats summary + recent payment activity
//   • Jobs         — every goal_provider_links row tied to the provider
//   • Earnings     — provider_payment credit history + running total
//   • Verification — current level + summary; full upgrade flow lives in
//                    ProviderVerificationScreen
// Data comes from `useProviderDashboard` (extended in Phase 1C).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  Provider,
  ProviderJob,
  ProviderEarning,
  ProviderVerificationStep,
  useProviderDashboard,
} from "../hooks/useProviders";
import { supabase } from "../lib/supabase";
import {
  DisbursementMilestone,
  DisbursementMilestoneStatus,
} from "../hooks/useGoalDisbursementMilestones";

type Tab = "overview" | "jobs" | "earnings" | "milestones" | "verification";

type DisbursementMilestoneWithGoal = DisbursementMilestone & { goal_name: string };

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function verificationLevelLabel(t: any, level: number): string {
  switch (level) {
    case 3:
      return t("provider_list.level_premium");
    case 2:
      return t("provider_list.level_standard");
    default:
      return t("provider_list.level_basic");
  }
}

function verificationLevelColor(level: number): string {
  switch (level) {
    case 3:
      return "#7C3AED";
    case 2:
      return "#059669";
    default:
      return "#00C6AE";
  }
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case "verified":
      return "#059669";
    case "rejected":
      return "#EF4444";
    default:
      return "#F59E0B";
  }
}

export default function ProviderDashboardScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const {
    provider,
    steps,
    jobs,
    earnings,
    totalEarnedCents,
    loading,
    refetch,
  } = useProviderDashboard();

  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Phase 2A — staged-disbursement milestones the provider is working on,
  // keyed by goal. Pulled in parallel with the existing useProviderDashboard
  // queries; if the lookup fails the tab simply renders empty.
  const [disbMilestones, setDisbMilestones] = useState<DisbursementMilestoneWithGoal[]>([]);
  useEffect(() => {
    if (!provider?.id) {
      setDisbMilestones([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("goal_disbursement_milestones")
        .select(
          "*, goal:user_savings_goals!goal_id(name)",
        )
        .eq("provider_id", provider.id)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      const rows = ((data ?? []) as any[]).map((r) => ({
        ...r,
        goal_name: r.goal?.name ?? "—",
      })) as DisbursementMilestoneWithGoal[];
      setDisbMilestones(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [provider?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const jobsInProgress = useMemo(
    () => jobs.filter((j) => j.status === "active" || j.status === "pending").length,
    [jobs],
  );

  if (loading && !provider) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} title={t("provider_dashboard.title")} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("provider_dashboard.no_provider")}</Text>
        </View>
      </View>
    );
  }

  const color = verificationLevelColor(provider.verification_level);
  const statusColor = statusBadgeColor(provider.verification_status);

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} title={t("provider_dashboard.title")} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />}
      >
        {/* Identity + verification status */}
        <View style={styles.identityCard}>
          <Text style={styles.businessName}>{provider.business_name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.levelBadge, { backgroundColor: `${color}22` }]}>
              <Ionicons name="shield-checkmark-outline" size={12} color={color} />
              <Text style={[styles.levelBadgeText, { color }]}>
                {verificationLevelLabel(t, provider.verification_level)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {t(`provider_dashboard.status_${provider.verification_status}`)}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="briefcase-outline"
            label={t("provider_dashboard.stats_jobs")}
            value={String(provider.total_jobs_completed)}
          />
          <StatCard
            icon="cash-outline"
            label={t("provider_dashboard.stats_earned")}
            value={fmt(totalEarnedCents)}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            icon="star"
            label={t("provider_dashboard.stats_rating")}
            value={
              provider.rating_count > 0
                ? `${provider.rating_avg.toFixed(1)} (${provider.rating_count})`
                : "—"
            }
            iconColor="#F59E0B"
          />
          <StatCard
            icon="time-outline"
            label={t("provider_dashboard.stats_in_progress")}
            value={String(jobsInProgress)}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(
            [
              { k: "overview", label: t("provider_dashboard.tab_overview") },
              { k: "jobs", label: t("provider_dashboard.tab_jobs") },
              { k: "earnings", label: t("provider_dashboard.tab_earnings") },
              { k: "milestones", label: t("provider_dashboard.tab_milestones") },
              { k: "verification", label: t("provider_dashboard.tab_verification") },
            ] as const
          ).map((it) => (
            <TouchableOpacity
              key={it.k}
              style={[styles.tabItem, tab === it.k && styles.tabItemActive]}
              onPress={() => setTab(it.k as Tab)}
            >
              <Text style={[styles.tabText, tab === it.k && styles.tabTextActive]} numberOfLines={1}>
                {it.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "overview" && (
          <OverviewSection
            provider={provider}
            earnings={earnings.slice(0, 5)}
            jobsInProgress={jobsInProgress}
            onOpenVerification={() => navigation.navigate("ProviderNetworkVerification")}
          />
        )}
        {tab === "jobs" && <JobsSection jobs={jobs} />}
        {tab === "earnings" && (
          <EarningsSection earnings={earnings} totalEarnedCents={totalEarnedCents} />
        )}
        {tab === "milestones" && (
          <MilestonesSection
            milestones={disbMilestones}
            onOpen={(goalId) =>
              navigation.navigate("GoalDisbursementMilestones", { goalId })
            }
          />
        )}
        {tab === "verification" && (
          <VerificationSection
            steps={steps}
            level={provider.verification_level}
            onOpen={() => navigation.navigate("ProviderNetworkVerification")}
          />
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </LinearGradient>
  );
}

function StatCard({
  icon,
  label,
  value,
  iconColor = "#0A2342",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  iconColor?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function OverviewSection({
  provider,
  earnings,
  jobsInProgress,
  onOpenVerification,
}: {
  provider: Provider;
  earnings: ProviderEarning[];
  jobsInProgress: number;
  onOpenVerification: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t("provider_dashboard.overview_summary")}</Text>
        <Text style={styles.bodyText}>
          {t("provider_dashboard.overview_body", {
            jobs: provider.total_jobs_completed,
            inProgress: jobsInProgress,
          })}
        </Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenVerification}>
          <Text style={styles.secondaryBtnText}>
            {t("provider_dashboard.go_verification")}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#00C6AE" />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t("provider_dashboard.recent_payments")}</Text>
        {earnings.length === 0 ? (
          <Text style={styles.mutedText}>{t("provider_dashboard.no_payments_yet")}</Text>
        ) : (
          earnings.map((e) => <EarningRow key={e.id} earning={e} />)
        )}
      </View>
    </>
  );
}

function JobsSection({ jobs }: { jobs: ProviderJob[] }) {
  const { t } = useTranslation();
  if (jobs.length === 0) {
    return (
      <View style={styles.sectionCard}>
        <Text style={styles.mutedText}>{t("provider_dashboard.no_jobs")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.sectionCard}>
      {jobs.map((j) => (
        <View key={j.id} style={styles.jobRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {j.goal_name}
            </Text>
            <Text style={styles.mutedText}>
              {fmt(j.paid_amount_cents)} / {fmt(j.total_amount_cents)}
            </Text>
          </View>
          <View style={[styles.jobStatusPill, jobStatusStyle(j.status)]}>
            <Text style={styles.jobStatusText}>{j.status}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function jobStatusStyle(status: string) {
  switch (status) {
    case "completed":
      return { backgroundColor: "#ECFDF5" };
    case "cancelled":
      return { backgroundColor: "#FEE2E2" };
    default:
      return { backgroundColor: "#FEF3C7" };
  }
}

function EarningsSection({
  earnings,
  totalEarnedCents,
}: {
  earnings: ProviderEarning[];
  totalEarnedCents: number;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t("provider_dashboard.total_earned")}</Text>
        <Text style={styles.bigAmount}>{fmt(totalEarnedCents)}</Text>
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t("provider_dashboard.payment_history")}</Text>
        {earnings.length === 0 ? (
          <Text style={styles.mutedText}>{t("provider_dashboard.no_payments_yet")}</Text>
        ) : (
          earnings.map((e) => <EarningRow key={e.id} earning={e} />)
        )}
      </View>
    </>
  );
}

function EarningRow({ earning }: { earning: ProviderEarning }) {
  const date = new Date(earning.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <View style={styles.earningRow}>
      <View style={styles.earningIconBox}>
        <Ionicons name="arrow-down" size={14} color="#059669" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.earningGoal} numberOfLines={1}>
          {earning.goal_name ?? "—"}
        </Text>
        <Text style={styles.mutedText}>{date}</Text>
      </View>
      <Text style={styles.earningAmount}>{fmt(earning.amount_cents)}</Text>
    </View>
  );
}

function MilestonesSection({
  milestones,
  onOpen,
}: {
  milestones: DisbursementMilestoneWithGoal[];
  onOpen: (goalId: string) => void;
}) {
  const { t } = useTranslation();
  // Group by status so the "what needs my attention" milestones surface
  // first. Order: in_progress (deliver), pending (accept), verification_
  // requested (waiting on review), released/failed at the bottom.
  const groups = useMemo(() => {
    const order: DisbursementMilestoneStatus[] = [
      "pending",
      "in_progress",
      "verification_requested",
      "verified",
      "released",
      "failed",
    ];
    return order
      .map((status) => ({
        status,
        items: milestones.filter((m) => m.status === status),
      }))
      .filter((g) => g.items.length > 0);
  }, [milestones]);

  if (milestones.length === 0) {
    return (
      <View style={styles.sectionCard}>
        <Text style={styles.mutedText}>
          {t("provider_dashboard.no_milestones")}
        </Text>
      </View>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <View key={g.status} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {t(`goal_disbursement.status_${g.status}`)} · {g.items.length}
          </Text>
          {g.items.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.jobRow}
              onPress={() => onOpen(m.goal_id)}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.jobTitle} numberOfLines={1}>
                  {m.goal_name} · {m.name}
                </Text>
                <Text style={styles.mutedText}>{fmt(m.amount_cents)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </>
  );
}

function VerificationSection({
  steps,
  level,
  onOpen,
}: {
  steps: ProviderVerificationStep[];
  level: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const byType = (type: ProviderVerificationStep["step_type"]) =>
    steps.find((s) => s.step_type === type);
  const rows = [
    { type: "elder_endorsement" as const, level: 1 },
    { type: "document_upload" as const, level: 2 },
    { type: "admin_site_visit" as const, level: 3 },
  ];
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>
        {t("provider_dashboard.current_level", { level })}
      </Text>
      {rows.map((r) => {
        const step = byType(r.type);
        const status = step?.status ?? "pending";
        const tone =
          status === "completed"
            ? "#059669"
            : status === "rejected"
            ? "#EF4444"
            : status === "in_progress"
            ? "#F59E0B"
            : "#6B7280";
        return (
          <View key={r.type} style={styles.verifRow}>
            <Ionicons
              name={
                r.type === "elder_endorsement"
                  ? "people-outline"
                  : r.type === "document_upload"
                  ? "document-text-outline"
                  : "shield-checkmark-outline"
              }
              size={18}
              color={tone}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifLabel}>
                {t(`provider_verification.step_${r.type}`)}
              </Text>
              <Text style={[styles.mutedText, { color: tone }]}>
                {t(`provider_verification.status_${status}`)}
              </Text>
            </View>
          </View>
        );
      })}
      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onOpen}>
        <Text style={styles.btnPrimaryText}>
          {t("provider_verification.upgrade_button")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280" },
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
  scrollContent: { padding: 16, paddingBottom: 32 },

  identityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  businessName: { fontSize: 18, fontWeight: "800", color: "#0A2342" },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  levelBadgeText: { fontSize: 12, fontWeight: "700" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "flex-start",
    gap: 6,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#0A2342" },
  statLabel: { fontSize: 11, color: "#6B7280" },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 4,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabItemActive: { backgroundColor: "#0A2342" },
  tabText: { fontSize: 11, fontWeight: "700", color: "#6B7280" },
  tabTextActive: { color: "#FFFFFF" },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342", marginBottom: 8 },
  bodyText: { fontSize: 14, color: "#374151", lineHeight: 20 },
  mutedText: { fontSize: 13, color: "#6B7280" },
  bigAmount: { fontSize: 28, fontWeight: "800", color: "#059669", marginTop: 4 },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: "700", color: "#00C6AE" },

  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  jobTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  jobStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  jobStatusText: { fontSize: 11, fontWeight: "700", color: "#0A2342", textTransform: "capitalize" },

  earningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  earningIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  earningGoal: { fontSize: 13, fontWeight: "700", color: "#0A2342" },
  earningAmount: { fontSize: 14, fontWeight: "700", color: "#0A2342" },

  verifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  verifLabel: { fontSize: 13, fontWeight: "600", color: "#0A2342" },

  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
