// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceDetailsV2Screen.tsx — Advance details (P1)
// ══════════════════════════════════════════════════════════════════════════════
//
// P1 updates (2026-06-12):
//   - Now renders BOTH active loans AND closed/rejected entries from
//     `past_advances`. Replaces the standalone AdvanceDisbursement and
//     AdvanceRejected screens — the same screen surfaces a disbursed-
//     success banner (just_created), an active loan view, a paid-off
//     celebration, or a rejected/defaulted state with reason + tips.
//   - Progress chip "Step 3 of 3 — Track your advance" at the top.
//   - Rejected/cancelled/expired application entries (no loan row) are
//     rendered from `past_advances` with the `application` source.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import {
  useAdvanceDashboard,
  processAdvanceRepayment,
  ActiveAdvance,
  PastAdvance,
} from "../hooks/useAdvanceDashboard";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";
const RED = "#EF4444";

const PRODUCT_ICON: Record<string, string> = {
  circle_boost: "\u{1F6E1}️",
  micro_emergency: "⚡",
  education: "\u{1F4CA}",
  small_business: "\u{1F48E}",
};

type AdvanceDetailsV2Params = {
  advanceId?: string;
  justCreated?: boolean;
};
type AdvanceDetailsV2RouteProp = RouteProp<
  { AdvanceDetailsV2: AdvanceDetailsV2Params },
  "AdvanceDetailsV2"
>;

type Badge = { label: string; bg: string; color: string };
function statusBadgeStyle(
  status: string,
  isDelinquent: boolean,
  t: (key: string) => string,
): Badge {
  if (isDelinquent) {
    return {
      label: t("advance_details_v2.status_delinquent"),
      bg: "#FEE2E2",
      color: "#DC2626",
    };
  }
  switch (status) {
    case "active":
      return {
        label: t("advance_details_v2.status_active"),
        bg: "#F0FDFB",
        color: "#00897B",
      };
    case "paid_off":
      return {
        label: t("advance_details_v2.status_paid_off"),
        bg: "#F0FDF4",
        color: "#166534",
      };
    case "defaulted":
      return {
        label: t("advance_details_v2.status_defaulted"),
        bg: "#FEE2E2",
        color: "#DC2626",
      };
    case "written_off":
      return {
        label: t("advance_details_v2.status_written_off"),
        bg: "#FEE2E2",
        color: "#DC2626",
      };
    case "in_collections":
      return {
        label: t("advance_details_v2.status_in_collections"),
        bg: "#FEE2E2",
        color: "#DC2626",
      };
    case "rejected":
      return {
        label: t("advance_details_v2.status_rejected"),
        bg: "#FEF3C7",
        color: "#92400E",
      };
    case "cancelled":
      return {
        label: t("advance_details_v2.status_cancelled"),
        bg: "#F5F7FA",
        color: MUTED,
      };
    case "expired":
      return {
        label: t("advance_details_v2.status_expired"),
        bg: "#F5F7FA",
        color: MUTED,
      };
    default:
      return { label: status, bg: "#F5F7FA", color: MUTED };
  }
}

// Improvement tips keyed by status reason.
function tipsForReason(
  reason: string | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string[] {
  if (!reason) return [t("advance_details_v2.tip_generic")];
  return [t(`advance_details_v2.tip_${reason}`, {
    defaultValue: t("advance_details_v2.tip_generic"),
  })];
}

export default function AdvanceDetailsV2Screen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<AdvanceDetailsV2RouteProp>();
  const advanceId = route.params?.advanceId ?? "";
  const justCreated = route.params?.justCreated ?? false;
  const { data, loading, error, refresh } = useAdvanceDashboard();
  const [repaying, setRepaying] = useState(false);

  // ── Loading / error ────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.fullCenter}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.fullCenterLabel}>
            {t("advance_details_v2.loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.fullCenter}>
          <Ionicons name="alert-circle-outline" size={36} color={RED} />
          <Text style={styles.fullCenterLabel}>
            {t("advance_details_v2.load_error")}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>
              {t("advance_details_v2.retry")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Find advance in active OR past list ─────────────────────────────
  const active: ActiveAdvance | undefined = data?.active_advances.find(
    (a) => a.loan_id === advanceId,
  );
  const past: PastAdvance | undefined = data?.past_advances.find(
    (p) => p.entry_id === advanceId,
  );

  if (!active && !past) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.fullCenter}>
          <Ionicons name="alert-circle-outline" size={36} color={MUTED} />
          <Text style={styles.fullCenterLabel}>
            {t("advance_details_v2.not_found")}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>
              {t("advance_details_v2.go_back")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render path 1: ACTIVE advance ──────────────────────────────────
  if (active) {
    return <ActiveAdvanceView
      advance={active}
      justCreated={justCreated}
      repaying={repaying}
      setRepaying={setRepaying}
      refresh={refresh}
      t={t}
      navigation={navigation}
    />;
  }

  // ── Render path 2: PAST advance (paid-off / defaulted / rejected) ─
  return <PastAdvanceView past={past!} t={t} navigation={navigation} />;
}

// ══════════════════════════════════════════════════════════════════════════
// ActiveAdvanceView — current loan, with repay action and timeline.
// ══════════════════════════════════════════════════════════════════════════

function ActiveAdvanceView({
  advance,
  justCreated,
  repaying,
  setRepaying,
  refresh,
  t,
  navigation,
}: {
  advance: ActiveAdvance;
  justCreated: boolean;
  repaying: boolean;
  setRepaying: (v: boolean) => void;
  refresh: () => Promise<void>;
  t: (key: string, opts?: Record<string, unknown>) => string;
  navigation: ReturnType<typeof useTypedNavigation>;
}) {
  const badge = statusBadgeStyle(advance.status, advance.is_delinquent, t);
  const icon = (advance.db_code && PRODUCT_ICON[advance.db_code]) ?? "💼";
  const principal = advance.principal_cents / 100;
  const outstanding = advance.outstanding_cents / 100;
  const nextPaymentCents = advance.next_payment_cents ?? 0;
  const nextPayment = nextPaymentCents / 100;
  const isActive = advance.status === "active" || advance.status === "in_collections";

  const handleRepayNow = async () => {
    if (repaying || nextPaymentCents <= 0) return;
    setRepaying(true);
    try {
      const result = await processAdvanceRepayment({
        loan_id: advance.loan_id,
        amount_cents: nextPaymentCents,
        source: "wallet",
      });
      await refresh();
      Alert.alert(
        t("advance_details_v2.repay_success_title"),
        result.fully_repaid
          ? t("advance_details_v2.repay_success_full")
          : t("advance_details_v2.repay_success_partial", {
              amount: (result.amount_applied_cents / 100).toFixed(2),
            }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t("advance_details_v2.repay_error_title"), msg);
    } finally {
      setRepaying(false);
    }
  };

  const timeline = [
    {
      key: "approved",
      event: t("advance_details_v2.timeline_approved"),
      status: "completed" as const,
    },
    {
      key: "disbursed",
      event: t("advance_details_v2.timeline_disbursed", {
        amount: principal.toFixed(2),
      }),
      status: "completed" as const,
    },
    {
      key: "next",
      event: t("advance_details_v2.timeline_next_payment", {
        amount: nextPayment.toFixed(2),
      }),
      status: (advance.payments_made >= advance.payments_total
        ? "completed"
        : "pending") as "completed" | "pending",
      date: advance.next_payment_date ?? null,
    },
    {
      key: "complete",
      event: t("advance_details_v2.timeline_complete"),
      status: "pending" as const,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {t("screen_headers.advance_details")}
              </Text>
              <Text style={styles.headerId}>{advance.loan_id.slice(0, 8)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          <View style={styles.amountRow}>
            <View>
              <Text style={styles.amountLabel}>
                {t("final_polish.advancedetailsv2_advanced")}
              </Text>
              <Text style={styles.amountBig}>${principal.toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amountLabel}>
                {t("advance_details_v2.outstanding")}
              </Text>
              <Text style={styles.amountTeal}>${outstanding.toFixed(2)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Progress chip */}
          <View style={styles.progressChip}>
            <Ionicons name="ellipse" size={8} color={TEAL} />
            <Text style={styles.progressChipText}>
              {t("advance_details_v2.progress_step_3")}
            </Text>
          </View>

          {justCreated ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color={TEAL} />
              <Text style={styles.successText}>
                {t("advance_details_v2.just_created")}
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <View style={styles.typeRow}>
              <View style={styles.typeIconBox}>
                <Text style={styles.typeIcon}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeName}>
                  {advance.product_name ?? t("advance_details_v2.product_unknown")}
                </Text>
                <Text style={styles.typeSub}>
                  {t("advance_details_v2.payments_summary", {
                    made: advance.payments_made,
                    total: advance.payments_total,
                  })}
                </Text>
              </View>
            </View>
          </View>

          {isActive && advance.next_payment_date ? (
            <View style={styles.nextPaymentCard}>
              <View style={styles.nextPaymentHeader}>
                <Ionicons name="time-outline" size={20} color={TEAL} />
                <Text style={styles.nextPaymentHeaderText}>
                  {t("advance_details_v2.next_payment_due")}
                </Text>
              </View>
              <View style={styles.nextPaymentInner}>
                <View style={styles.nextPaymentRow}>
                  <Text style={styles.nextPaymentLabel}>
                    {t("advance_details_v2.due_date")}
                  </Text>
                  <Text style={styles.nextPaymentValueTeal}>
                    {advance.next_payment_date}
                  </Text>
                </View>
                <View style={styles.nextPaymentRow}>
                  <Text style={styles.nextPaymentLabel}>
                    {t("advance_details_v2.amount_due")}
                  </Text>
                  <Text style={styles.nextPaymentValueWhite}>
                    ${nextPayment.toFixed(2)}
                  </Text>
                </View>
                {advance.days_past_due > 0 ? (
                  <View style={styles.nextPaymentRow}>
                    <Text style={styles.nextPaymentLabel}>
                      {t("advance_details_v2.days_past_due")}
                    </Text>
                    <Text style={styles.nextPaymentValueAmber}>
                      {advance.days_past_due}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t("final_polish.advancedetailsv2_advance_information")}
            </Text>
            <View style={styles.infoList}>
              <InfoRow
                label={t("advance_details_v2.info_principal")}
                value={`$${principal.toFixed(2)}`}
              />
              <InfoRow
                label={t("advance_details_v2.info_outstanding")}
                value={`$${outstanding.toFixed(2)}`}
                valueStyle={styles.infoValueBig}
              />
              <View style={styles.divider} />
              <InfoRow
                label={t("advance_details_v2.info_payments_made")}
                value={`${advance.payments_made} / ${advance.payments_total}`}
              />
              <InfoRow
                label={t("advance_details_v2.info_status")}
                value={badge.label}
                valueStyle={{ color: badge.color }}
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t("final_polish.advancedetailsv2_timeline")}
            </Text>
            <View>
              {timeline.map((item, idx) => {
                const isLast = idx === timeline.length - 1;
                const isCompleted = item.status === "completed";
                return (
                  <View key={item.key} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          isCompleted
                            ? styles.timelineDotCompleted
                            : styles.timelineDotPending,
                        ]}
                      />
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineConnector,
                            { backgroundColor: isCompleted ? TEAL : BORDER },
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineEvent}>{item.event}</Text>
                      {"date" in item && item.date ? (
                        <Text style={styles.timelineDate}>{item.date}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {isActive ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {t("final_polish.advancedetailsv2_actions")}
              </Text>
              <View style={styles.actionsList}>
                <TouchableOpacity
                  style={[
                    styles.repayButton,
                    (repaying || nextPaymentCents <= 0) &&
                      styles.repayButtonDisabled,
                  ]}
                  onPress={handleRepayNow}
                  disabled={repaying || nextPaymentCents <= 0}
                  accessibilityRole="button"
                  accessibilityLabel={t("advance_details_v2.repay_now")}
                >
                  {repaying ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.repayButtonText}>
                        {t("advance_details_v2.repay_now_with_amount", {
                          amount: nextPayment.toFixed(2),
                        })}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hardshipButton}
                  onPress={() =>
                    navigation.navigate(Routes.HardshipRequest, {
                      advanceId: advance.loan_id,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t("advance_details_v2.request_hardship")}
                >
                  <Text style={styles.hardshipButtonText}>
                    {t("advance_details_v2.request_hardship")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.linksList}>
            <LinkRow
              icon="chatbubble-outline"
              label={t("advance_details_v2.contact_support")}
              onPress={() => navigation.navigate(Routes.HelpCenter)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PastAdvanceView — paid-off / defaulted / rejected / expired entries
// (replaces standalone AdvanceRejected + AdvanceDisbursement screens).
// ══════════════════════════════════════════════════════════════════════════

function PastAdvanceView({
  past,
  t,
  navigation,
}: {
  past: PastAdvance;
  t: (key: string, opts?: Record<string, unknown>) => string;
  navigation: ReturnType<typeof useTypedNavigation>;
}) {
  const badge = statusBadgeStyle(past.status, false, t);
  const icon = (past.db_code && PRODUCT_ICON[past.db_code]) ?? "💼";
  const principal = past.principal_cents / 100;
  const tips = tipsForReason(past.reason, t);
  const isNegativeOutcome =
    past.status === "rejected" ||
    past.status === "defaulted" ||
    past.status === "written_off";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {t("screen_headers.advance_details")}
              </Text>
              <Text style={styles.headerId}>{past.entry_id.slice(0, 8)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          <View style={styles.amountRow}>
            <View>
              <Text style={styles.amountLabel}>
                {past.source === "application"
                  ? t("advance_details_v2.requested")
                  : t("final_polish.advancedetailsv2_advanced")}
              </Text>
              <Text style={styles.amountBig}>${principal.toFixed(2)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Progress chip — collapsed for past entries */}
          <View style={styles.progressChip}>
            <Ionicons name="time-outline" size={10} color={MUTED} />
            <Text style={[styles.progressChipText, { color: MUTED }]}>
              {t("advance_details_v2.progress_closed")}
            </Text>
          </View>

          {/* Outcome banner */}
          {past.status === "paid_off" ? (
            <View style={styles.successBanner}>
              <Ionicons name="trophy" size={20} color={TEAL} />
              <Text style={styles.successText}>
                {t("advance_details_v2.paid_off_celebration")}
              </Text>
            </View>
          ) : isNegativeOutcome ? (
            <View style={styles.negativeBanner}>
              <Ionicons
                name="alert-circle"
                size={20}
                color={past.status === "rejected" ? AMBER : RED}
              />
              <Text style={styles.negativeBannerText}>
                {past.status === "rejected"
                  ? t("advance_details_v2.rejected_banner")
                  : t("advance_details_v2.defaulted_banner")}
              </Text>
            </View>
          ) : (
            <View style={styles.neutralBanner}>
              <Ionicons name="information-circle" size={20} color={MUTED} />
              <Text style={styles.neutralBannerText}>
                {past.status === "cancelled"
                  ? t("advance_details_v2.cancelled_banner")
                  : t("advance_details_v2.expired_banner")}
              </Text>
            </View>
          )}

          <View style={styles.sectionCard}>
            <View style={styles.typeRow}>
              <View style={styles.typeIconBox}>
                <Text style={styles.typeIcon}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeName}>
                  {past.product_name ?? t("advance_details_v2.product_unknown")}
                </Text>
                {past.closed_at ? (
                  <Text style={styles.typeSub}>
                    {new Date(past.closed_at).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {past.reason ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {t("advance_details_v2.reason_title")}
              </Text>
              <Text style={styles.reasonText}>
                {t(`advance_details_v2.reason_${past.reason}`, {
                  defaultValue: past.reason,
                })}
              </Text>
            </View>
          ) : null}

          {/* Tips — only show on negative outcomes */}
          {isNegativeOutcome ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {t("advance_details_v2.tips_title")}
              </Text>
              {tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons name="bulb-outline" size={16} color={TEAL} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.tipsCta}
                onPress={() => navigation.navigate(Routes.XnScoreDashboard)}
                accessibilityRole="button"
              >
                <Text style={styles.tipsCtaText}>
                  {t("advance_details_v2.improve_score_cta")}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={TEAL} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.linksList}>
            <LinkRow
              icon="chatbubble-outline"
              label={t("advance_details_v2.contact_support")}
              onPress={() => navigation.navigate(Routes.HelpCenter)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  labelStrong,
  valueStyle,
}: {
  label: string;
  value: string;
  labelStrong?: boolean;
  valueStyle?: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, labelStrong && styles.infoLabelStrong]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.linkRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.linkLeft}>
        <Ionicons name={icon} size={18} color={MUTED} />
        <Text style={styles.linkText}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={MUTED} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  fullCenterLabel: { fontSize: 14, color: MUTED, textAlign: "center" },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: 10,
  },
  retryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  header: { paddingTop: 20, paddingBottom: 80, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerId: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },

  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  amountBig: { fontSize: 36, fontWeight: "700", color: "#FFFFFF" },
  amountTeal: { fontSize: 24, fontWeight: "700", color: TEAL },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  progressChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  progressChipText: { fontSize: 11, fontWeight: "700", color: NAVY },

  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TEAL,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
    fontWeight: "600",
  },

  negativeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: RED,
  },
  negativeBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#B91C1C",
    fontWeight: "600",
  },

  neutralBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  neutralBannerText: {
    flex: 1,
    fontSize: 13,
    color: MUTED,
    fontWeight: "600",
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  typeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  typeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: { fontSize: 26 },
  typeName: { fontSize: 16, fontWeight: "700", color: NAVY },
  typeSub: { fontSize: 12, color: MUTED, marginTop: 4 },

  reasonText: { fontSize: 13, color: NAVY, lineHeight: 19 },

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 6,
  },
  tipText: { flex: 1, fontSize: 13, color: NAVY, lineHeight: 19 },
  tipsCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
  },
  tipsCtaText: { fontSize: 13, fontWeight: "700", color: TEAL },

  infoList: { gap: 6 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, color: MUTED },
  infoLabelStrong: { fontSize: 14, fontWeight: "600", color: NAVY },
  infoValue: { fontSize: 14, fontWeight: "600", color: NAVY },
  infoValueBig: { fontSize: 16, fontWeight: "700", color: NAVY },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },

  nextPaymentCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  nextPaymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  nextPaymentHeaderText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  nextPaymentInner: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 12,
  },
  nextPaymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  nextPaymentLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  nextPaymentValueTeal: { fontSize: 14, fontWeight: "600", color: TEAL },
  nextPaymentValueWhite: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  nextPaymentValueAmber: { fontSize: 14, fontWeight: "600", color: AMBER },

  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineLeft: { alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineDotCompleted: { backgroundColor: TEAL },
  timelineDotPending: {
    backgroundColor: "#E5E7EB",
    borderWidth: 2,
    borderColor: TEAL,
  },
  timelineConnector: { width: 2, height: 36 },
  timelineBody: { flex: 1, paddingBottom: 16 },
  timelineEvent: { fontSize: 13, fontWeight: "600", color: NAVY },
  timelineDate: { fontSize: 11, color: MUTED, marginTop: 2 },

  actionsList: { gap: 10 },
  repayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TEAL,
  },
  repayButtonDisabled: { backgroundColor: BORDER },
  repayButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  hardshipButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  hardshipButtonText: { fontSize: 14, fontWeight: "600", color: NAVY },

  linksList: { gap: 8 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  linkLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { fontSize: 13, fontWeight: "500", color: NAVY },
});
