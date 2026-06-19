import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  useInsurancePool,
  usePoolTransactions,
  usePoolRate,
  useCirclePoolMembers,
} from "../hooks/useInsurancePool";
import { InsurancePoolEngine } from "../services/InsurancePoolEngine";
import { useAuth } from "../context/AuthContext";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  bg: "#F5F7FA",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  muted: "#6B7280",
  border: "#E5E7EB",
  card: "#FFFFFF",
};

type TabKey = "overview" | "members" | "claims" | "premiums";

// Migration 206 (Bucket A): tab labels are now i18n keys, resolved
// inside the component via t(). Order: Overview, Members, Claims,
// Premiums so the new opt-in/out surface sits next to the headline.
const TAB_KEYS: { key: TabKey; labelKey: string }[] = [
  { key: "overview", labelKey: "insurance_pool.tab_overview" },
  { key: "members", labelKey: "insurance_pool.tab_members" },
  { key: "claims", labelKey: "insurance_pool.tab_claims" },
  { key: "premiums", labelKey: "insurance_pool.tab_premiums" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCents = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const getHealthColor = (health: string) => {
  // Module-level helper — must NOT call hooks here. A stray useTranslation()
  // here violates Rules of Hooks and crashes the screen with "Invalid hook
  // call" / "Property 't' doesn't exist" downstream.
  switch (health) {
    case "healthy":
      return COLORS.green;
    case "adequate":
      return COLORS.yellow;
    case "low":
      return COLORS.orange;
    case "critical":
      return COLORS.red;
    default:
      return COLORS.muted;
  }
};

// Migration 206 (Bucket A): localized health label keyed off the i18n
// bundle (was: raw lowercase tier text via .charAt+.slice). `no_data`
// is rendered when there are no contributions yet to compare against.
const getHealthLabelKey = (health: string): string => {
  switch (health) {
    case "healthy":
      return "insurance_pool.health_healthy";
    case "adequate":
      return "insurance_pool.health_adequate";
    case "low":
      return "insurance_pool.health_low";
    case "critical":
      return "insurance_pool.health_critical";
    default:
      return "insurance_pool.health_no_data";
  }
};

const getClaimIconName = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "member_default":
      return "alert-circle";
    case "partial_shortfall":
      return "git-branch";
    default:
      return "time-outline";
  }
};

const getClaimIconColor = (type: string) => {
  switch (type) {
    case "member_default":
      return COLORS.red;
    case "partial_shortfall":
      return COLORS.orange;
    default:
      return COLORS.orange;
  }
};

// ─── Route params ────────────────────────────────────────────────────────────

type InsurancePoolRouteParams = {
  InsurancePool: { circleId: string };
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function InsurancePoolScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<InsurancePoolRouteParams, "InsurancePool">>();
  // Defensive: route.params can be undefined if the caller navigates
  // without a circleId. Fall back to empty so destructuring never throws.
  const { circleId } = route.params ?? ({} as { circleId: string });

  const { user } = useAuth();
  const currentUserId = user?.id;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [optInBusy, setOptInBusy] = useState(false);

  // Real hooks
  const {
    pool,
    loading: poolLoading,
    error: poolError,
    refetch: refetchPool,
    balanceFormatted,
  } = useInsurancePool(circleId);

  const {
    transactions,
    loading: txLoading,
    refetch: refetchTx,
    totals,
  } = usePoolTransactions(circleId);

  const {
    currentRate,
    rateFormatted: rateDisplayFormatted,
    loading: rateLoading,
    refetch: refetchRate,
  } = usePoolRate(circleId);

  const {
    members,
    loading: membersLoading,
    refetch: refetchMembers,
  } = useCirclePoolMembers(circleId);

  const loading = poolLoading || txLoading || rateLoading || membersLoading;

  const onRefresh = useCallback(() => {
    refetchPool();
    refetchTx();
    refetchRate();
    refetchMembers();
  }, [refetchPool, refetchTx, refetchRate, refetchMembers]);

  // Derived data
  const claimTransactions = transactions.filter(
    (t) => t.transactionType === "coverage_payout"
  );
  const premiumTransactions = transactions.filter(
    (t) => t.transactionType === "withholding"
  );
  const premiumRatePct = currentRate * 100;

  // ─── Bucket A fixes ─────────────────────────────────────────────────────
  //
  // Pool-health math (was: balance > balance * 0.8 — always false on
  // positive balances). Compare balance against (memberCount × per-cycle
  // contribution × 0.8), the cost of fully covering one default cycle.
  // Falls back to a coverage-ratio if the circle.amount isn't known yet.
  const memberCount = members.length;
  const expectedFullCover =
    pool && pool.contributionAmountCents && memberCount > 0
      ? pool.contributionAmountCents * memberCount * 0.8
      : 0;
  const healthRatio =
    pool && expectedFullCover > 0
      ? pool.balanceCents / expectedFullCover
      : null;
  const poolHealth: "healthy" | "adequate" | "low" | "critical" | "no_data" =
    !pool
      ? "no_data"
      : healthRatio == null
        ? "no_data"
        : healthRatio >= 0.8
          ? "healthy"
          : healthRatio >= 0.5
            ? "adequate"
            : healthRatio >= 0.2
              ? "low"
              : "critical";

  // "Your premium" math (was: balance × rate, which scales with pool, not
  // contribution). Sum the current user's most recent withholding txn.
  const yourLastPremiumCents = useMemo(() => {
    if (!currentUserId) return 0;
    const mine = premiumTransactions.filter((tx) => tx.userId === currentUserId);
    return mine.length > 0 ? Math.abs(mine[0].amountCents) : 0;
  }, [premiumTransactions, currentUserId]);

  const myMember = useMemo(
    () => members.find((m) => m.userId === currentUserId) ?? null,
    [members, currentUserId],
  );

  const handleToggleMyOptIn = useCallback(async () => {
    if (!circleId || !currentUserId || !myMember) return;
    const next = !myMember.participatesInPool;
    setOptInBusy(true);
    const result = await InsurancePoolEngine.setMemberPoolOptIn(
      circleId,
      currentUserId,
      next,
    );
    setOptInBusy(false);
    if (!result.success) {
      Alert.alert(
        t("insurance_pool.opt_in_error_title"),
        t("insurance_pool.opt_in_error_generic"),
      );
      return;
    }
    refetchMembers();
  }, [circleId, currentUserId, myMember, refetchMembers, t]);

  // ─── Loading State ───────────────────────────────────────────────────────

  if (poolLoading && !pool) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loadingText}>{t("insurance_pool.loading")}</Text>
      </View>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────

  if (poolError && !pool) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color={COLORS.red} />
        <Text style={styles.errorText}>{poolError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetchPool}>
          <Text style={styles.retryText}>{t("insurance_pool.btn_retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("screen_headers.insurance_pool")}</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="information-circle-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        {/* Pool Balance Card */}
        <View style={styles.balanceCard}>
          <Ionicons
            name="shield-checkmark"
            size={40}
            color={COLORS.teal}
            style={styles.shieldIcon}
          />
          {pool?.circleName && (
            <Text style={styles.circleName}>{pool.circleName}</Text>
          )}
          <Text style={styles.balanceAmount}>{balanceFormatted}</Text>
          <Text style={styles.balanceLabel}>{t("insurance_pool.label_balance")}</Text>

          {/* Health Status — Bucket A fix: ratio compares balance against
              one full default-cycle's worth of contributions (memberCount
              × per-cycle × 0.8). Shows percentage of that threshold. */}
          <View style={styles.healthRow}>
            <View
              style={[
                styles.healthDot,
                { backgroundColor: getHealthColor(poolHealth) },
              ]}
            />
            <Text
              style={[styles.healthText, { color: getHealthColor(poolHealth) }]}
            >
              {t(getHealthLabelKey(poolHealth))}
            </Text>
            {healthRatio != null && (
              <Text style={styles.coverageText}>
                {t("insurance_pool.coverage_ratio", {
                  pct: Math.round(healthRatio * 100),
                })}
              </Text>
            )}
          </View>

          {/* Quick Stats — Bucket A fix: "your premium" is now the user's
              most recent withholding txn, not balance × rate. */}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{rateDisplayFormatted}</Text>
              <Text style={styles.statLabel}>{t("insurance_pool.stat_premium_rate")}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {formatCents(yourLastPremiumCents)}
              </Text>
              <Text style={styles.statLabel}>
                {t("insurance_pool.stat_your_last_premium")}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{memberCount}</Text>
              <Text style={styles.statLabel}>{t("insurance_pool.stat_members")}</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabRow}>
          {TAB_KEYS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <View style={styles.tabContent}>
            {/* How It Works */}
            <Text style={styles.sectionTitle}>{t("insurance_pool.section_how")}</Text>
            <View style={styles.card}>
              {[
                {
                  num: 1,
                  titleKey: "insurance_pool.how_step1_title",
                  desc: t("insurance_pool.how_step1_desc", {
                    rate: premiumRatePct.toFixed(1),
                  }),
                },
                {
                  num: 2,
                  titleKey: "insurance_pool.how_step2_title",
                  desc: t("insurance_pool.how_step2_desc"),
                },
                {
                  num: 3,
                  titleKey: "insurance_pool.how_step3_title",
                  desc: t("insurance_pool.how_step3_desc"),
                },
              ].map((step, i) => (
                <View key={step.num} style={[styles.stepRow, i > 0 && styles.stepRowSpaced]}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNum}>{step.num}</Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{t(step.titleKey)}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Pool Breakdown */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              {t("insurance_pool.section_breakdown")}
            </Text>
            <View style={styles.card}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t("insurance_pool.breakdown_premiums")}</Text>
                <Text style={styles.breakdownValue}>
                  {formatCents(totals.totalWithheldCents)}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{t("insurance_pool.breakdown_claims")}</Text>
                <Text style={[styles.breakdownValue, { color: COLORS.orange }]}>
                  -{formatCents(totals.totalPayoutsCents)}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={[styles.breakdownRow, { paddingTop: 12 }]}>
                <Text style={styles.breakdownTotalLabel}>{t("insurance_pool.breakdown_balance")}</Text>
                <Text style={styles.breakdownTotalValue}>
                  {balanceFormatted}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── MEMBERS TAB (Migration 206 / Bucket A) ──────────────── */}
        {activeTab === "members" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>
              {t("insurance_pool.section_members")}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t("insurance_pool.section_members_subtitle")}
            </Text>

            {/* Self-card — only when the user is a member of this circle. */}
            {myMember && (
              <View style={[styles.card, styles.memberSelfCard]}>
                <View style={styles.memberRow}>
                  <View style={styles.memberLeft}>
                    <Text style={styles.memberName}>
                      {t("insurance_pool.member_self_label")}
                    </Text>
                    <View
                      style={[
                        styles.memberStatusPill,
                        {
                          backgroundColor: myMember.participatesInPool
                            ? `${COLORS.green}1A`
                            : `${COLORS.muted}1A`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.memberStatusText,
                          {
                            color: myMember.participatesInPool
                              ? COLORS.green
                              : COLORS.muted,
                          },
                        ]}
                      >
                        {myMember.participatesInPool
                          ? t("insurance_pool.member_participates")
                          : t("insurance_pool.member_not_participating")}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.optInBtn,
                      {
                        backgroundColor: myMember.participatesInPool
                          ? COLORS.muted
                          : COLORS.teal,
                        opacity: optInBusy ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleToggleMyOptIn}
                    disabled={optInBusy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.optInBtnText}>
                      {myMember.participatesInPool
                        ? t("insurance_pool.opt_out_cta")
                        : t("insurance_pool.opt_in_cta")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Other members — read-only badge. */}
            {members
              .filter((m) => m.userId !== currentUserId)
              .map((m) => (
                <View key={m.userId} style={styles.card}>
                  <View style={styles.memberRow}>
                    <View style={styles.memberLeft}>
                      <Text style={styles.memberName}>
                        {m.fullName ?? t("insurance_pool.member_no_name")}
                      </Text>
                      <Text style={styles.memberRole}>{m.role}</Text>
                    </View>
                    <View
                      style={[
                        styles.memberStatusPill,
                        {
                          backgroundColor: m.participatesInPool
                            ? `${COLORS.green}1A`
                            : `${COLORS.muted}1A`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.memberStatusText,
                          {
                            color: m.participatesInPool
                              ? COLORS.green
                              : COLORS.muted,
                          },
                        ]}
                      >
                        {m.participatesInPool
                          ? t("insurance_pool.member_participates")
                          : t("insurance_pool.member_not_participating")}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

            {members.length === 0 && !membersLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyText}>
                  {t("insurance_pool.empty_members")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ─── CLAIMS TAB ──────────────────────────────────────────── */}
        {activeTab === "claims" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>{t("insurance_pool.section_claims")}</Text>
            <Text style={styles.sectionSubtitle}>
              {t("insurance_pool.claims_subtitle")}
            </Text>

            {claimTransactions.length === 0 && !txLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyText}>{t("insurance_pool.empty_claims")}</Text>
              </View>
            )}

            {claimTransactions.map((claim) => (
              <View key={claim.id} style={styles.card}>
                <View style={styles.claimHeader}>
                  <View style={styles.claimTypeRow}>
                    <Ionicons
                      name={getClaimIconName(claim.description || "")}
                      size={16}
                      color={getClaimIconColor(claim.description || "")}
                    />
                    <Text style={styles.claimType}>
                      {(claim.description || claim.transactionType).replace(/_/g, " ")}
                    </Text>
                  </View>
                  <Text style={styles.claimDate}>
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.claimBody}>
                  <Text style={styles.claimAmount}>
                    {formatCents(Math.abs(claim.amountCents))}
                  </Text>
                  <View style={styles.claimStatusPill}>
                    <Text style={styles.claimStatusText}>{t("final_polish.insurancepool_paid")}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── PREMIUMS TAB ────────────────────────────────────────── */}
        {activeTab === "premiums" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>{t("insurance_pool.section_premiums")}</Text>
            <Text style={styles.sectionSubtitle}>
              {t("insurance_pool.premiums_subtitle", {
                rate: premiumRatePct.toFixed(1),
              })}
            </Text>

            {premiumTransactions.length === 0 && !txLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyText}>{t("insurance_pool.empty_premiums")}</Text>
              </View>
            )}

            {premiumTransactions.map((premium) => (
              <View key={premium.id} style={[styles.card, styles.premiumCard]}>
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>
                    {premium.description || "Premium Withholding"}
                  </Text>
                  <Text style={styles.premiumDate}>
                    {new Date(premium.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.premiumAmount}>
                  {formatCents(premium.amountCents)}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
              </View>
            ))}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Loading / Error
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.red,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.teal,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  // Header
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  shieldIcon: {
    marginBottom: 8,
  },
  circleName: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.navy,
  },
  balanceLabel: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 12,
  },

  // Health
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  healthText: {
    fontSize: 13,
    fontWeight: "600",
  },
  coverageText: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 10,
  },

  // Quick Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.navy,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: COLORS.navy,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },

  // Tab Content
  tabContent: {
    gap: 8,
  },

  // Section
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 8,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  // How It Works steps
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepRowSpaced: {
    marginTop: 16,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },

  // Breakdown
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  breakdownLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.navy,
  },
  breakdownTotalValue: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.teal,
  },

  // Claims
  claimHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  claimTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  claimType: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
    textTransform: "capitalize",
  },
  claimDate: {
    fontSize: 11,
    color: COLORS.muted,
  },
  claimBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  claimAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
  },
  claimStatusPill: {
    backgroundColor: `${COLORS.green}20`,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  claimStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.green,
  },

  // Premiums
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  premiumInfo: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
  },
  premiumDate: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  premiumAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
  },

  // Members section (Bucket A)
  memberSelfCard: {
    borderColor: COLORS.teal,
    borderWidth: 1,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  memberLeft: { flex: 1 },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  memberStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  memberStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  optInBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optInBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
