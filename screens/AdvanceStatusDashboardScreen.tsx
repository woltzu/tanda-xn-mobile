// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceStatusDashboardScreen.tsx — ADVANCE-005 user dashboard
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 107-ADVANCE-005-StatusDashboard.jsx.
//
// Active-advance management screen showing per-advance status cards
// (with status badges, withholding info, day-count progress, action
// buttons), an empty state when the user has nothing outstanding, a
// "circle eligibility impact" reminder card, a New-Advance CTA, and a
// closing XnScore banner.
//
// Route params (all optional, defaults match the canonical mock):
//   user?: { name; xnScore }
//   activeAdvances?: ActiveAdvance[]   ← phase KYC-3 will source from
//                                        AdvanceContext
//   totalAdvanced?: number             ← computed from sum if absent
//   totalDue?: number                  ← same
//
// Navigation:
//   - back → goBack
//   - "View Details" per card → AdvanceDetailsV2 { advanceId }
//   - "Repay Early" per card → EarlyRepayment { advanceId }
//   - "Request New Advance" → AdvanceHubV2
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";
const RED = "#DC2626";

type AdvanceStatus = "on_track" | "at_risk" | "overdue";

type ActiveAdvance = {
  id: string;
  type: string;
  typeName: string;
  icon: string;
  advancedAmount: number;
  totalDue: number;
  withholdingDate: string;
  circleName: string;
  payoutAmount: number;
  remainingAfter: number;
  status: AdvanceStatus;
  daysUntil: number;
  disbursedDate: string;
};

type AdvanceStatusDashboardParams = {
  user?: { name?: string; xnScore?: number };
  activeAdvances?: ActiveAdvance[];
  totalAdvanced?: number;
  totalDue?: number;
};
type AdvanceStatusDashboardRouteProp = RouteProp<
  { AdvanceStatusDashboard: AdvanceStatusDashboardParams },
  "AdvanceStatusDashboard"
>;

const DEFAULT_ADVANCES: ActiveAdvance[] = [
  {
    id: "ADV-2025-0120-001",
    type: "quick",
    typeName: "Quick Advance",
    icon: "⚡",
    advancedAmount: 300,
    totalDue: 315,
    withholdingDate: "Feb 15, 2025",
    circleName: "Family Circle",
    payoutAmount: 500,
    remainingAfter: 185,
    status: "on_track",
    daysUntil: 25,
    disbursedDate: "Jan 20, 2025",
  },
];

function statusBadgeStyle(status: AdvanceStatus) {
  switch (status) {
    case "on_track":
      return { label: "On Track ✓", bg: "#F0FDFB", color: "#00897B" };
    case "at_risk":
      return { label: "At Risk", bg: "#FEF3C7", color: AMBER };
    case "overdue":
      return { label: "Overdue", bg: "#FEE2E2", color: RED };
  }
}

function withholdBg(status: AdvanceStatus) {
  switch (status) {
    case "on_track":
      return "#F0FDFB";
    case "at_risk":
      return "#FEF3C7";
    case "overdue":
      return "#FEE2E2";
  }
}

export default function AdvanceStatusDashboardScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<AdvanceStatusDashboardRouteProp>();
  const xnScore = route.params?.user?.xnScore ?? 78;
  const activeAdvances = route.params?.activeAdvances ?? DEFAULT_ADVANCES;

  const totals = useMemo(() => {
    if (
      route.params?.totalAdvanced != null &&
      route.params?.totalDue != null
    ) {
      return {
        totalAdvanced: route.params.totalAdvanced,
        totalDue: route.params.totalDue,
      };
    }
    return {
      totalAdvanced: activeAdvances.reduce(
        (a, x) => a + x.advancedAmount,
        0,
      ),
      totalDue: activeAdvances.reduce((a, x) => a + x.totalDue, 0),
    };
  }, [activeAdvances, route.params?.totalAdvanced, route.params?.totalDue]);

  const hasActive = activeAdvances.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("screen_headers.advance_status")}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t("advance_status_dashboard.summary_total_advanced")}</Text>
              <Text style={styles.summaryValueWhite}>
                ${totals.totalAdvanced}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t("advance_status_dashboard.summary_total_repay")}</Text>
              <Text style={styles.summaryValueTeal}>${totals.totalDue}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {hasActive ? (
            <View style={styles.advancesList}>
              {activeAdvances.map((advance) => (
                <AdvanceCard
                  key={advance.id}
                  advance={advance}
                  onViewDetails={() =>
                    navigation.navigate(Routes.AdvanceDetailsV2, {
                      advanceId: advance.id,
                    })
                  }
                  onRepayEarly={() =>
                    navigation.navigate(Routes.EarlyRepayment, {
                      advanceId: advance.id,
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBox}>
                <Text style={styles.emptyIcon}>✨</Text>
              </View>
              <Text style={styles.emptyTitle}>{t("final_polish.advancestatusdashboard_no_active_advances")}</Text>
              <Text style={styles.emptyBody}>
                Need funds before your next payout? Get an advance.
              </Text>
            </View>
          )}

          {/* Circle Eligibility Impact */}
          {hasActive && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("advance_status_dashboard.section_impact")}</Text>
              <View style={styles.impactList}>
                <ImpactRow
                  color={TEAL}
                  text="You can still join new circles while advance is active"
                />
                <ImpactRow
                  color={AMBER}
                  text="Max advance amount may be limited until repayment"
                />
                <ImpactRow
                  color={RED}
                  text="Missed repayment affects XnScore (-20 pts) and circle access"
                />
              </View>
            </View>
          )}

          {/* New Advance Button — dashed teal */}
          <TouchableOpacity
            style={styles.newAdvanceButton}
            onPress={() => navigation.navigate(Routes.AdvanceHubV2)}
            accessibilityRole="button"
            accessibilityLabel="Request new advance"
          >
            <Ionicons name="add" size={20} color={TEAL} />
            <Text style={styles.newAdvanceText}>{t("advance_status_dashboard.btn_request_new")}</Text>
          </TouchableOpacity>

          {/* XnScore reminder */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreCircleText}>{xnScore}</Text>
            </View>
            <View>
              <Text style={styles.scoreTitle}>{t("advance_status_dashboard.score_title")}</Text>
              <Text style={styles.scoreBody}>
                On-time repayment keeps your score healthy
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Active advance card ──────────────────────────────────────────────────

function AdvanceCard({
  advance,
  onViewDetails,
  onRepayEarly,
}: {
  advance: ActiveAdvance;
  onViewDetails: () => void;
  onRepayEarly: () => void;
}) {
  const badge = statusBadgeStyle(advance.status);
  const withholdBgColor = withholdBg(advance.status);
  const progressPct = Math.max(
    0,
    Math.round(100 - (advance.daysUntil / 30) * 100),
  );

  return (
    <View style={styles.advanceCard}>
      <View style={styles.advanceHeader}>
        <View style={styles.advanceTitleRow}>
          <View style={styles.advanceIconBox}>
            <Text style={styles.advanceIcon}>{advance.icon}</Text>
          </View>
          <View>
            <Text style={styles.advanceTitle}>
              ${advance.advancedAmount} {advance.typeName}
            </Text>
            <Text style={styles.advanceSubtitle}>
              From {advance.circleName}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Withholding block */}
      <View
        style={[styles.withholdBlock, { backgroundColor: withholdBgColor }]}
      >
        <View style={styles.withholdHeaderRow}>
          <Ionicons name="time-outline" size={18} color={badge.color} />
          <Text style={[styles.withholdTitle, { color: badge.color }]}>
            Next withholding: {advance.withholdingDate}
          </Text>
        </View>
        <View style={styles.withholdBodyRow}>
          <View>
            <Text style={styles.withholdMicroLabel}>
              Amount to be withheld
            </Text>
            <Text style={styles.withholdAmount}>${advance.totalDue}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.withholdMicroLabel}>{t("advance_status_dashboard.label_from_payout")}</Text>
            <Text style={styles.withholdPayout}>${advance.payoutAmount}</Text>
          </View>
        </View>
        <View
          style={[
            styles.withholdDivider,
            { borderTopColor: `${badge.color}33` },
          ]}
        />
        <Text style={styles.keepText}>
          You'll keep:{" "}
          <Text style={styles.keepAmount}>${advance.remainingAfter}</Text> after
          withholding
        </Text>
      </View>

      {/* Days remaining + progress */}
      <View style={styles.daysRow}>
        <Text style={styles.daysText}>
          {advance.daysUntil > 0
            ? `${advance.daysUntil} days until payout`
            : "Payout due today"}
        </Text>
        <View style={styles.daysProgressBg}>
          <View
            style={[styles.daysProgressFill, { width: `${progressPct}%` }]}
          />
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionOutline}
          onPress={onViewDetails}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${advance.typeName}`}
        >
          <Text style={styles.actionOutlineText}>{t("advance_status_dashboard.btn_view_details")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionPrimary}
          onPress={onRepayEarly}
          accessibilityRole="button"
          accessibilityLabel={`Repay early for ${advance.typeName}`}
        >
          <Text style={styles.actionPrimaryText}>{t("advance_status_dashboard.btn_repay_early")}</Text>
        </TouchableOpacity>
      </View>

      {/* Advance ID footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>
          ID: {advance.id} • Disbursed {advance.disbursedDate}
        </Text>
      </View>
    </View>
  );
}

function ImpactRow({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.impactRow}>
      <View style={[styles.impactDot, { backgroundColor: color }]} />
      <Text style={styles.impactText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: { paddingTop: 20, paddingBottom: 80, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  summaryRow: { flexDirection: "row", gap: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  summaryValueWhite: { fontSize: 24, fontWeight: "700", color: "#FFFFFF" },
  summaryValueTeal: { fontSize: 24, fontWeight: "700", color: TEAL },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  advancesList: { gap: 12 },

  advanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  advanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  advanceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  advanceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  advanceIcon: { fontSize: 24 },
  advanceTitle: { fontSize: 16, fontWeight: "700", color: NAVY },
  advanceSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  withholdBlock: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  withholdHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  withholdTitle: { fontSize: 14, fontWeight: "600" },
  withholdBodyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  withholdMicroLabel: { fontSize: 12, color: MUTED },
  withholdAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  withholdPayout: {
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
    marginTop: 2,
  },
  withholdDivider: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  keepText: { fontSize: 12, color: MUTED },
  keepAmount: { fontWeight: "700", color: TEAL },

  daysRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  daysText: { fontSize: 13, color: MUTED },
  daysProgressBg: {
    width: 100,
    height: 6,
    backgroundColor: BORDER,
    borderRadius: 3,
    overflow: "hidden",
  },
  daysProgressFill: { height: 6, backgroundColor: TEAL, borderRadius: 3 },

  actionRow: { flexDirection: "row", gap: 10 },
  actionOutline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  actionOutlineText: { fontSize: 13, fontWeight: "600", color: NAVY },
  actionPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  actionPrimaryText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },

  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  cardFooterText: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 28 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: NAVY, marginBottom: 8 },
  emptyBody: { fontSize: 13, color: MUTED, textAlign: "center" },

  sectionCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },
  impactList: { gap: 10 },
  impactRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  impactDot: { width: 8, height: 8, borderRadius: 4 },
  impactText: { flex: 1, fontSize: 13, color: NAVY },

  newAdvanceButton: {
    marginTop: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: TEAL,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newAdvanceText: { fontSize: 15, fontWeight: "600", color: TEAL },

  scoreCard: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scoreTitle: { fontSize: 13, fontWeight: "600", color: "#065F46" },
  scoreBody: { fontSize: 12, color: "#047857", marginTop: 2 },
});
