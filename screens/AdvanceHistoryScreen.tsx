// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceHistoryScreen.tsx — ADVANCE-010 past-advances list
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 112-ADVANCE-010-AdvanceHistory.jsx.
//
// List of past (repaid / defaulted) advances. Header carries 3
// summary tiles (Total Advanced / Total Repaid / Avg Repay days);
// content opens with a "Perfect Repayment Record" badge when every
// past advance was repaid on time, then the per-advance card list,
// then a dashed-teal "Request New Advance" CTA at the bottom.
//
// Route params (all optional, defaults match the canonical mock):
//   pastAdvances?: PastAdvance[]
//   totalAdvanced?: number       ← computed from sum if absent
//   totalRepaid?: number         ← computed from sum if absent
//   averageRepayTime?: number    ← in days
//
// Navigation:
//   - back → goBack
//   - tap an advance row → AdvanceDetailsV2 { advanceId }
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

type PastAdvanceStatus = "repaid" | "defaulted";

type PastAdvance = {
  id: string;
  type: string;
  typeName: string;
  icon: string;
  amount: number;
  totalRepaid: number;
  status: PastAdvanceStatus;
  disbursedDate: string;
  repaidDate: string;
  circleName: string;
  xnScoreImpact: string;
};

type AdvanceHistoryParams = {
  pastAdvances?: PastAdvance[];
  totalAdvanced?: number;
  totalRepaid?: number;
  averageRepayTime?: number;
};
type AdvanceHistoryRouteProp = RouteProp<
  { AdvanceHistory: AdvanceHistoryParams },
  "AdvanceHistory"
>;

const DEFAULT_PAST: PastAdvance[] = [
  {
    id: "ADV-2025-0105-003",
    type: "quick",
    typeName: "Quick Advance",
    icon: "⚡",
    amount: 250,
    totalRepaid: 262,
    status: "repaid",
    disbursedDate: "Jan 5, 2025",
    repaidDate: "Jan 20, 2025",
    circleName: "Family Circle",
    xnScoreImpact: "+2",
  },
  {
    id: "ADV-2024-1215-002",
    type: "contribution",
    typeName: "Contribution Cover",
    icon: "🛡️",
    amount: 100,
    totalRepaid: 105,
    status: "repaid",
    disbursedDate: "Dec 15, 2024",
    repaidDate: "Dec 28, 2024",
    circleName: "Business Builders",
    xnScoreImpact: "+1",
  },
  {
    id: "ADV-2024-1101-001",
    type: "quick",
    typeName: "Quick Advance",
    icon: "⚡",
    amount: 400,
    totalRepaid: 420,
    status: "repaid",
    disbursedDate: "Nov 1, 2024",
    repaidDate: "Nov 15, 2024",
    circleName: "Family Circle",
    xnScoreImpact: "+3",
  },
];

function statusStyle(status: PastAdvanceStatus) {
  switch (status) {
    case "repaid":
      return { label: "Repaid ✓", bg: "#F0FDF4", color: "#166534" };
    case "defaulted":
      return { label: "Missed", bg: "#FEE2E2", color: "#DC2626" };
  }
}

export default function AdvanceHistoryScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<AdvanceHistoryRouteProp>();

  const pastAdvances = route.params?.pastAdvances ?? DEFAULT_PAST;
  const averageRepayTime = route.params?.averageRepayTime ?? 14;

  const totals = useMemo(() => {
    if (
      route.params?.totalAdvanced != null &&
      route.params?.totalRepaid != null
    ) {
      return {
        totalAdvanced: route.params.totalAdvanced,
        totalRepaid: route.params.totalRepaid,
      };
    }
    return {
      totalAdvanced: pastAdvances.reduce((a, x) => a + x.amount, 0),
      totalRepaid: pastAdvances.reduce((a, x) => a + x.totalRepaid, 0),
    };
  }, [pastAdvances, route.params?.totalAdvanced, route.params?.totalRepaid]);

  const allRepaid = pastAdvances.every((a) => a.status === "repaid");
  const totalXnScoreEarned = pastAdvances.reduce(
    (acc, a) => acc + parseInt(a.xnScoreImpact, 10),
    0,
  );

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
            <Text style={styles.headerTitle}>{t("screen_headers.advance_history")}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* 3 stats tiles */}
          <View style={styles.statsRow}>
            <StatTile label="Total Advanced" value={`$${totals.totalAdvanced}`} />
            <StatTile
              label="Total Repaid"
              value={`$${totals.totalRepaid}`}
              valueColor={TEAL}
            />
            <StatTile label="Avg Repay" value={`${averageRepayTime}d`} />
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Track record badge (only when all repaid + at least one) */}
          {allRepaid && pastAdvances.length > 0 && (
            <View style={styles.trackRecordCard}>
              <View style={styles.trackRecordIcon}>
                <Ionicons name="checkmark" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trackRecordTitle}>
                  Perfect Repayment Record
                </Text>
                <Text style={styles.trackRecordBody}>
                  {pastAdvances.length} advances repaid on time •{" "}
                  {totalXnScoreEarned > 0 ? "+" : ""}
                  {totalXnScoreEarned} XnScore earned
                </Text>
              </View>
            </View>
          )}

          {/* List or empty state */}
          {pastAdvances.length > 0 ? (
            <View style={styles.list}>
              {pastAdvances.map((advance) => (
                <PastAdvanceRow
                  key={advance.id}
                  advance={advance}
                  onPress={() =>
                    navigation.navigate(Routes.AdvanceDetailsV2, {
                      advanceId: advance.id,
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBox}>
                <Text style={styles.emptyIcon}>📊</Text>
              </View>
              <Text style={styles.emptyTitle}>No Advance History Yet</Text>
              <Text style={styles.emptyBody}>
                Your completed advances will appear here
              </Text>
            </View>
          )}

          {/* New Advance CTA */}
          <TouchableOpacity
            style={styles.newAdvanceButton}
            onPress={() => navigation.navigate(Routes.AdvanceHubV2)}
            accessibilityRole="button"
            accessibilityLabel="Request new advance"
          >
            <Ionicons name="add" size={20} color={TEAL} />
            <Text style={styles.newAdvanceText}>{t("advance_history_v2.btn_request_new")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

function PastAdvanceRow({
  advance,
  onPress,
}: {
  advance: PastAdvance;
  onPress: () => void;
}) {
  const status = statusStyle(advance.status);
  return (
    <TouchableOpacity
      style={styles.rowCard}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${advance.typeName} for $${advance.amount}`}
    >
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderLeft}>
          <View style={styles.rowIconBox}>
            <Text style={styles.rowIcon}>{advance.icon}</Text>
          </View>
          <View>
            <Text style={styles.rowTitle}>
              ${advance.amount} {advance.typeName}
            </Text>
            <Text style={styles.rowSubtitle}>{advance.circleName}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusBadgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.rowFooter}>
        <FooterCell label="Disbursed" value={advance.disbursedDate} />
        <FooterCell label="Repaid" value={advance.repaidDate} />
        <FooterCell label="Total Paid" value={`$${advance.totalRepaid}`} />
        <FooterCell
          label="XnScore"
          value={advance.xnScoreImpact}
          valueColor={TEAL}
        />
      </View>
    </TouchableOpacity>
  );
}

function FooterCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.footerCell}>
      <Text style={styles.footerLabel}>{label}</Text>
      <Text style={[styles.footerValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
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

  statsRow: { flexDirection: "row", gap: 10 },
  statTile: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  trackRecordCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TEAL,
  },
  trackRecordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  trackRecordTitle: { fontSize: 14, fontWeight: "600", color: "#065F46" },
  trackRecordBody: { fontSize: 12, color: "#047857", marginTop: 2 },

  list: { gap: 12 },

  rowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  rowHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIcon: { fontSize: 22 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: NAVY },
  rowSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  rowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F7FA",
  },
  footerCell: { alignItems: "flex-start" },
  footerLabel: { fontSize: 11, color: "#9CA3AF" },
  footerValue: {
    fontSize: 12,
    fontWeight: "600",
    color: NAVY,
    marginTop: 2,
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
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 28 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: NAVY, marginBottom: 8 },
  emptyBody: { fontSize: 13, color: MUTED, textAlign: "center" },

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
});
