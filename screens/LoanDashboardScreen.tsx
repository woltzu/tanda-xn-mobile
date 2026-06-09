// ══════════════════════════════════════════════════════════════════════════════
// screens/LoanDashboardScreen.tsx — User's active-loan list view
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: none
//
// Closes the dead `LoanDashboard` nav target in LoanMarketplaceScreen.tsx.
// The "Active Loans Summary" pill at the top of LoanMarketplace only
// renders when `activeLoans.length > 0` — tapping it lands here, where
// the user can see all their active loans as rows and drill into
// LoanDetails for any individual one.
//
// Data: consumed entirely from `useLoan()` (alias for `useAdvance()` in
// AdvanceContext.tsx), which already exposes `activeLoans`,
// `getTotalOutstanding`, `loanProducts`, and a `getProductById` helper.
// No new engine code. The context is local-first (loans are persisted
// to AsyncStorage and re-hydrated on mount) — there is no async
// `refresh` function to call, so pull-to-refresh is implemented as a
// brief tactile-feedback gesture rather than a real refetch. When the
// loans backend grows a real fetch API, swap the no-op `handleRefresh`
// for the real call.
//
// Row tap → navigate(Routes.LoanDetails, { loanId: l.id }) — uses the
// existing single-loan detail screen (registered in HomeStack).
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useLoan, type LoanRequest, type LoanStatus } from "../context/AdvanceContext";

import { useTranslation } from "react-i18next";
const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#F59E0B";
const GREEN = "#10B981";
const BLUE = "#3B82F6";
const RED = "#DC2626";

export default function LoanDashboardScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const { activeLoans, getTotalOutstanding, getProductById, isLoading } = useLoan();

  const [refreshing, setRefreshing] = useState(false);

  // No async source to refetch from — context state is hydrated once
  // from AsyncStorage. We still expose pull-to-refresh so the gesture
  // feels alive; when a real loan fetch API lands, replace the
  // setTimeout with the real call.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setRefreshing(false);
  }, []);

  const totalOutstanding = getTotalOutstanding();

  const handleRowPress = (loan: LoanRequest) => {
    navigation.navigate(Routes.LoanDetails, { loanId: loan.id });
  };

  const renderItem = ({ item }: { item: LoanRequest }) => {
    const product = getProductById(item.productId);
    const title = product?.name ?? item.purpose ?? "Loan";
    const subtitle = product?.code ? product.code.toUpperCase() : item.category;
    const nextPayment = item.nextPaymentDate ? formatDate(item.nextPaymentDate) : null;
    const paymentsTotal = item.paymentsMade + item.paymentsRemaining;
    const progressPct =
      paymentsTotal > 0 ? Math.round((item.paymentsMade / paymentsTotal) * 100) : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleRowPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title} details`}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardCol}>
            <Text style={styles.fieldLabel}>Remaining</Text>
            <Text style={styles.fieldValueStrong}>{formatMoney(item.amountRemaining)}</Text>
            {item.totalToRepay > 0 && (
              <Text style={styles.fieldHint}>
                of {formatMoney(item.totalToRepay)} total
              </Text>
            )}
          </View>
          <View style={styles.cardCol}>
            <Text style={styles.fieldLabel}>Next payment</Text>
            {nextPayment ? (
              <>
                <Text style={styles.fieldValue}>{nextPayment}</Text>
                {item.nextPaymentAmount != null && (
                  <Text style={styles.fieldHint}>
                    {formatMoney(item.nextPaymentAmount)}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.fieldValueMuted}>—</Text>
            )}
          </View>
        </View>

        {paymentsTotal > 0 && (
          <View style={styles.progressBlock}>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPct}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {item.paymentsMade} of {paymentsTotal} payments
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetails}>View details</Text>
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <LinearGradient colors={[NAVY, "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("screen_headers.loan_dashboard")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total outstanding</Text>
            <Text style={styles.summaryValue}>
              ${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Active loans</Text>
            <Text style={styles.summaryValue}>{activeLoans.length}</Text>
          </View>
        </View>
      </LinearGradient>

      {isLoading && activeLoans.length === 0 ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading loans…</Text>
        </View>
      ) : (
        <FlatList
          data={activeLoans}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            activeLoans.length === 0 ? styles.listEmpty : styles.listContent
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={MUTED} />
              <Text style={styles.emptyTitle}>No active loans</Text>
              <Text style={styles.emptyBody}>
                You don't have any active loans right now. Browse the marketplace
                to see what's available.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate(Routes.LoanMarketplace)}
                accessibilityRole="button"
              >
                <Text style={styles.emptyButtonText}>Browse Loan Marketplace</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={TEAL}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Helper components ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: LoanStatus }) {
  const config = statusConfig(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.fg }]}>
        {config.label}
      </Text>
    </View>
  );
}

function statusConfig(status: LoanStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case "submitted":
      return { label: "Submitted", bg: "#FEF3C7", fg: "#92400E" };
    case "under_review":
      return { label: "Reviewing", bg: "#FEF3C7", fg: AMBER };
    case "approved":
      return { label: "Approved", bg: "#DBEAFE", fg: BLUE };
    case "disbursed":
      return { label: "Disbursed", bg: "#D1FAE5", fg: GREEN };
    case "active":
      return { label: "Active", bg: "#D1FAE5", fg: GREEN };
    case "completed":
      return { label: "Completed", bg: "#E5E7EB", fg: NAVY };
    case "rejected":
      return { label: "Rejected", bg: "#FEE2E2", fg: RED };
    case "cancelled":
      return { label: "Cancelled", bg: "#FEE2E2", fg: RED };
    case "defaulted":
      return { label: "Defaulted", bg: "#FEE2E2", fg: RED };
    default:
      return { label: String(status), bg: "#F3F4F6", fg: MUTED };
  }
}

// ── Formatters ──────────────────────────────────────────────────────────

function formatMoney(amount: number): string {
  return `$${(amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },

  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSpacer: { width: 40 },

  summary: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: MUTED },

  listContent: { padding: 16, paddingBottom: 32 },
  listEmpty: { flexGrow: 1, justifyContent: "center", padding: 24 },
  separator: { height: 10 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: MUTED,
    textTransform: "capitalize",
  },
  cardBody: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 4,
  },
  cardCol: { flex: 1 },
  fieldLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  fieldValue: { fontSize: 14, fontWeight: "600", color: NAVY },
  fieldValueStrong: { fontSize: 16, fontWeight: "700", color: NAVY },
  fieldValueMuted: { fontSize: 14, color: MUTED },
  fieldHint: { fontSize: 11, color: MUTED, marginTop: 2 },

  progressBlock: { gap: 6 },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: TEAL,
  },
  progressText: { fontSize: 11, color: MUTED },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  viewDetails: { fontSize: 12, color: MUTED, fontWeight: "600" },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: NAVY,
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
