// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceHubV2Screen.tsx — ADVANCE-001 hub (Stage 8, V2 redesign)
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 103-ADVANCE-001-AdvanceHub.jsx.
//
// V2 NAMING NOTE — this is the new redesign of the advance hub.
// The existing AdvanceHubScreen.tsx (1,049 lines, wired to useAdvance
// context) is intentionally NOT replaced. Both screens coexist until a
// future decision on which to keep (red-emoji-gated retirement).
//
// The screen displays 4 advance products with 3 visual states keyed off
// the user's XnScore:
//   - active   → user qualifies; tappable with teal border + "ACTIVE" badge
//   - preview  → user is close but below threshold; blue border, shows
//                progress bar to unlock
//   - locked   → far from threshold; greyed out, shows distance to unlock
//
// Route params (all optional — replaced by real useAdvance data later):
//   user?: { name, xnScore, smc, nextPayout, onTimePayments, circlesCompleted }
//
// Navigation:
//   - back chevron → goBack
//   - "What is an Advance?" → AdvanceExplanationV2
//   - select an active product → SmartCalculator { advanceType }
//   - "See improvement path" → XnScoreDashboard (existing screen)
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
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
const BLUE = "#3B82F6";
const GREEN_DARK = "#065F46";
const GREEN_BODY = "#047857";

type ProductState = "active" | "preview" | "locked";
type ProductId = "contribution" | "quick" | "flex" | "premium";

// i18n: name/tagline/description/advanceFee/repayment carry translation
// keys instead of literal strings. Resolved per-render via t() at the
// call site so language flips re-paint without re-instantiating the list.
type Product = {
  id: ProductId;
  nameKey: string;
  icon: string;
  taglineKey: string;
  descriptionKey: string;
  maxAdvance: number;
  advanceFeeKey: string;
  repaymentKey: string;
  minScore: number;
  state: ProductState;
  userRateKey: string | null;
  scoreNeeded?: number;
};

type AdvanceHubUser = {
  name: string;
  xnScore: number;
  smc: number;
  nextPayout: { amount: number; date: string; circleName: string };
  onTimePayments: number;
  circlesCompleted: number;
};

type AdvanceHubV2Params = {
  user?: AdvanceHubUser;
};
type AdvanceHubV2RouteProp = RouteProp<
  { AdvanceHubV2: AdvanceHubV2Params },
  "AdvanceHubV2"
>;

const DEFAULT_USER: AdvanceHubUser = {
  name: "Franck",
  xnScore: 72,
  smc: 200,
  nextPayout: { amount: 500, date: "Feb 15, 2025", circleName: "Family Circle" },
  onTimePayments: 18,
  circlesCompleted: 2,
};

function buildProducts(xnScore: number): Product[] {
  const stateFor = (minScore: number): ProductState =>
    xnScore >= minScore ? "active" : xnScore >= minScore - 10 ? "preview" : "locked";
  return [
    {
      id: "contribution",
      nameKey: "advance_hub_v2.product_contribution_name",
      icon: "🛡️",
      taglineKey: "advance_hub_v2.product_contribution_tagline",
      descriptionKey: "advance_hub_v2.product_contribution_desc",
      maxAdvance: 500,
      advanceFeeKey: "advance_hub_v2.fee_flat",
      repaymentKey: "advance_hub_v2.repayment_next_payout",
      minScore: 50,
      state: stateFor(50),
      userRateKey: null,
    },
    {
      id: "quick",
      nameKey: "advance_hub_v2.product_quick_name",
      icon: "⚡",
      taglineKey: "advance_hub_v2.product_quick_tagline",
      descriptionKey: "advance_hub_v2.product_quick_desc",
      maxAdvance: 400,
      advanceFeeKey: "advance_hub_v2.fee_9_5",
      repaymentKey: "advance_hub_v2.repayment_1_4_weeks",
      minScore: 65,
      state: stateFor(65),
      userRateKey: xnScore >= 65 ? "advance_hub_v2.fee_9_5" : null,
    },
    {
      id: "flex",
      nameKey: "advance_hub_v2.product_flex_name",
      icon: "📊",
      taglineKey: "advance_hub_v2.product_flex_tagline",
      descriptionKey: "advance_hub_v2.product_flex_desc",
      maxAdvance: 2500,
      advanceFeeKey: "advance_hub_v2.fee_from_8",
      repaymentKey: "advance_hub_v2.repayment_3_12_months",
      minScore: 75,
      state: stateFor(75),
      userRateKey: null,
      scoreNeeded: 75,
    },
    {
      id: "premium",
      nameKey: "advance_hub_v2.product_premium_name",
      icon: "💎",
      taglineKey: "advance_hub_v2.product_premium_tagline",
      descriptionKey: "advance_hub_v2.product_premium_desc",
      maxAdvance: 5000,
      advanceFeeKey: "advance_hub_v2.fee_from_6",
      repaymentKey: "advance_hub_v2.repayment_up_to_24",
      minScore: 85,
      state: stateFor(85),
      userRateKey: null,
      scoreNeeded: 85,
    },
  ];
}

export default function AdvanceHubV2Screen() {
  const navigation = useTypedNavigation();
  const route = useRoute<AdvanceHubV2RouteProp>();
  const { t } = useTranslation();
  const user = route.params?.user ?? DEFAULT_USER;
  const products = buildProducts(user.xnScore);

  const availableCount = products.filter((p) => p.state === "active").length;
  const availabilityLabel =
    availableCount >= 3
      ? t("advance_hub_v2.availability_many", { count: availableCount })
      : availableCount === 2
        ? t("advance_hub_v2.availability_two")
        : availableCount === 1
          ? t("advance_hub_v2.availability_one")
          : t("advance_hub_v2.availability_locked");

  const handleSelectProduct = (product: Product) => {
    if (product.state !== "active") return;
    navigation.navigate(Routes.SmartCalculator, { advanceType: product.id });
  };

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
            <Text style={styles.headerTitle}>{t("advance_hub_v2.header")}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* XnScore display */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreValue}>{user.xnScore}</Text>
              <Text style={styles.scoreLabel}>{t("advance_hub_v2.score_label")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.availabilityText}>{availabilityLabel}</Text>
              <Text style={styles.statsText}>
                {t("advance_hub_v2.stats_text", {
                  circles: user.circlesCompleted,
                  payments: user.onTimePayments,
                })}
              </Text>
              <TouchableOpacity
                style={styles.improvementPill}
                onPress={() => navigation.navigate(Routes.XnScoreDashboard)}
                accessibilityRole="button"
                accessibilityLabel="See improvement path"
              >
                <Ionicons name="bar-chart-outline" size={12} color="#FFFFFF" />
                <Text style={styles.improvementPillText}>
                  {t("advance_hub_v2.see_improvement_path")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Upcoming Payout */}
          <View style={styles.payoutCard}>
            <View style={styles.payoutIconBox}>
              <Ionicons name="calendar" size={22} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutLabel}>
                {t("advance_hub_v2.payout_label")}
              </Text>
              <Text style={styles.payoutAmount}>
                {t("advance_hub_v2.payout_amount", {
                  amount: user.nextPayout.amount,
                  date: user.nextPayout.date,
                })}
              </Text>
              <Text style={styles.payoutCircle}>{user.nextPayout.circleName}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.advanceUpToLabel}>{t("advance_hub_v2.advance_up_to_label")}</Text>
              <Text style={styles.advanceUpToValue}>
                ${Math.floor(user.nextPayout.amount * 0.8)}
              </Text>
            </View>
          </View>

          {/* What is an Advance? */}
          <TouchableOpacity
            style={styles.learnCard}
            onPress={() => navigation.navigate(Routes.AdvanceExplanationV2)}
            accessibilityRole="button"
            accessibilityLabel="Learn what an advance payout is"
          >
            <View style={styles.learnIconBox}>
              <Ionicons name="information-circle" size={20} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.learnTitle}>
                {t("advance_hub_v2.learn_title")}
              </Text>
              <Text style={styles.learnBody}>
                {t("advance_hub_v2.learn_body")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEAL} />
          </TouchableOpacity>

          {/* Product cards */}
          <View style={styles.productsList}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                userXnScore={user.xnScore}
                onPress={() => handleSelectProduct(product)}
                t={t}
              />
            ))}
          </View>

          {/* Comparison note */}
          <View style={styles.comparisonNote}>
            <View style={styles.comparisonHeader}>
              <Ionicons name="star" size={18} color="#00897B" />
              <Text style={styles.comparisonTitle}>{t("advance_hub_v2.comparison_title")}</Text>
            </View>
            <Text style={styles.comparisonBody}>
              <Text style={styles.comparisonStrong}>{t("advance_hub_v2.comparison_local")}</Text>
              {" | "}
              <Text style={styles.comparisonStrong}>{t("advance_hub_v2.comparison_payday")}</Text>
              {" | "}
              <Text style={styles.comparisonStrong}>{t("advance_hub_v2.comparison_tandaxn")}</Text>
              {t("advance_hub_v2.comparison_tagline")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Product card sub-component ───────────────────────────────────────────

function ProductCard({
  product,
  userXnScore,
  onPress,
  t,
}: {
  product: Product;
  userXnScore: number;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const styling = stateStyling(product.state, t);
  const progress = product.scoreNeeded
    ? Math.min(100, Math.round((userXnScore / product.scoreNeeded) * 100))
    : 100;
  const pointsNeeded = product.scoreNeeded ? product.scoreNeeded - userXnScore : 0;
  const productName = t(product.nameKey);

  return (
    <TouchableOpacity
      style={[
        styles.productCard,
        {
          backgroundColor: styling.bg,
          borderColor: styling.borderColor,
          borderWidth: styling.borderWidth,
          opacity: styling.opacity,
        },
      ]}
      onPress={onPress}
      disabled={product.state === "locked"}
      activeOpacity={product.state === "active" ? 0.85 : 1}
      accessibilityRole="button"
      accessibilityState={{ disabled: product.state === "locked" }}
      accessibilityLabel={`${productName}, ${styling.badgeLabel}`}
    >
      <View style={[styles.stateBadge, { backgroundColor: styling.badgeBg }]}>
        <Text style={styles.stateBadgeText}>{styling.badgeLabel}</Text>
      </View>

      <View style={styles.productInner}>
        <View
          style={[
            styles.productIconBox,
            {
              backgroundColor:
                product.state === "active"
                  ? "#F0FDFB"
                  : product.state === "preview"
                    ? "#EFF6FF"
                    : "#F5F7FA",
              opacity: product.state === "locked" ? 0.6 : 1,
            },
          ]}
        >
          <Text style={styles.productIcon}>{product.icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{productName}</Text>
          <Text
            style={[
              styles.productTagline,
              {
                color:
                  product.state === "active"
                    ? TEAL
                    : product.state === "preview"
                      ? BLUE
                      : MUTED,
              },
            ]}
          >
            {t(product.taglineKey)}
          </Text>
          <Text style={styles.productDescription}>{t(product.descriptionKey)}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabel}>{t("advance_hub_v2.stat_max_advance")}</Text>
              <Text style={styles.statValueNavy}>
                {t("advance_hub_v2.stat_max_advance_value", { amount: product.maxAdvance.toLocaleString() })}
              </Text>
            </View>
            <View>
              <Text style={styles.statLabel}>{t("advance_hub_v2.stat_advance_fee")}</Text>
              <Text style={styles.statValueTeal}>
                {product.state === "active" && product.userRateKey
                  ? t(product.userRateKey)
                  : t(product.advanceFeeKey)}
              </Text>
            </View>
            <View>
              <Text style={styles.statLabel}>{t("advance_hub_v2.stat_repayment")}</Text>
              <Text style={styles.statValueNavy}>{t(product.repaymentKey)}</Text>
            </View>
          </View>

          {/* Unlock progress for non-active states */}
          {(product.state === "preview" || product.state === "locked") &&
            product.scoreNeeded && (
              <View style={styles.unlockBlock}>
                <View style={styles.unlockTopRow}>
                  <Text style={styles.unlockLabel}>
                    {t("advance_hub_v2.unlock_progress_label")}
                  </Text>
                  <Text
                    style={[
                      styles.unlockProgressText,
                      product.state === "preview" && { color: BLUE },
                    ]}
                  >
                    {userXnScore}/{product.scoreNeeded}
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                        backgroundColor:
                          product.state === "preview" ? BLUE : "#9CA3AF",
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.unlockHint,
                    product.state === "preview" && { color: BLUE },
                  ]}
                >
                  {product.state === "preview"
                    ? t("advance_hub_v2.unlock_hint_preview", { points: pointsNeeded })
                    : t("advance_hub_v2.unlock_hint_locked", {
                        payments: Math.ceil(pointsNeeded / 2),
                        target: product.scoreNeeded,
                      })}
                </Text>
              </View>
            )}
        </View>

        {product.state === "active" && (
          <Ionicons name="chevron-forward" size={20} color={TEAL} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function stateStyling(
  state: ProductState,
  t: (key: string) => string,
) {
  switch (state) {
    case "active":
      return {
        bg: "#FFFFFF",
        borderColor: TEAL,
        borderWidth: 2,
        opacity: 1,
        badgeBg: TEAL,
        badgeLabel: t("advance_hub_v2.badge_active"),
      };
    case "preview":
      return {
        bg: "#FFFFFF",
        borderColor: BLUE,
        borderWidth: 1,
        opacity: 1,
        badgeBg: BLUE,
        badgeLabel: t("advance_hub_v2.badge_preview"),
      };
    case "locked":
      return {
        bg: "#F5F7FA",
        borderColor: BORDER,
        borderWidth: 1,
        opacity: 0.7,
        badgeBg: MUTED,
        badgeLabel: t("advance_hub_v2.badge_locked"),
      };
  }
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

  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  scoreRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 3,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { fontSize: 24, fontWeight: "700", color: TEAL },
  scoreLabel: { fontSize: 9, color: "rgba(255,255,255,0.8)" },
  availabilityText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  statsText: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  improvementPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 6,
    marginTop: 8,
  },
  improvementPillText: { fontSize: 11, color: "#FFFFFF", fontWeight: "500" },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  payoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  payoutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  payoutLabel: { fontSize: 12, color: MUTED },
  payoutAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  payoutCircle: { fontSize: 11, color: MUTED, marginTop: 2 },
  advanceUpToLabel: { fontSize: 11, color: MUTED },
  advanceUpToValue: {
    fontSize: 18,
    fontWeight: "700",
    color: TEAL,
    marginTop: 2,
  },

  learnCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  learnIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  learnTitle: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  learnBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  productsList: { gap: 12 },

  productCard: {
    borderRadius: 16,
    padding: 16,
    position: "relative",
  },
  stateBadge: {
    position: "absolute",
    top: -8,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stateBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  productInner: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  productIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  productIcon: { fontSize: 26 },
  productName: { fontSize: 16, fontWeight: "700", color: NAVY },
  productTagline: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  productDescription: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 18,
    marginTop: 6,
  },

  statsRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  statLabel: { fontSize: 10, color: "#9CA3AF" },
  statValueNavy: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginTop: 2,
  },
  statValueTeal: {
    fontSize: 13,
    fontWeight: "600",
    color: TEAL,
    marginTop: 2,
  },

  unlockBlock: { marginTop: 12 },
  unlockTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  unlockLabel: { fontSize: 11, color: MUTED },
  unlockProgressText: { fontSize: 11, fontWeight: "600", color: MUTED },
  progressBg: {
    height: 6,
    backgroundColor: BORDER,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3 },
  unlockHint: { fontSize: 11, color: MUTED, marginTop: 6 },

  comparisonNote: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL,
  },
  comparisonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: GREEN_DARK,
  },
  comparisonBody: {
    fontSize: 12,
    color: GREEN_BODY,
    lineHeight: 18,
  },
  comparisonStrong: { fontWeight: "700" },
});
