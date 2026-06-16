// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceHubV2Screen.tsx — Advance Hub (P1 — tabs + modal + chip)
// ══════════════════════════════════════════════════════════════════════════════
//
// P1 rewrite (2026-06-12):
//   - Three tabs (Available | Active | History) replacing the standalone
//     AdvanceStatusDashboard and AdvanceHistory screens. Tab state lives
//     on the hub; data is the same `useAdvanceDashboard()` payload.
//   - First-visit explainer modal (AsyncStorage key
//     `@tandaxn_advance_hub_seen_v1`) replacing the AdvanceExplanationV2
//     screen entry. "What is an advance?" card now re-opens the same
//     modal on demand.
//   - (?) help icons on each product card → Alert.alert with the
//     product description and a one-line use case.
//   - Progress chip "Step 1 of 3 — Choose a product" above the content.
//   - Gear icon in the header → AdvanceSettings (kept reachable per spec).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
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
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import {
  useAdvanceDashboard,
  AdvanceProductCard,
  AdvanceUiCode,
  ActiveAdvance,
  PastAdvance,
} from "../hooks/useAdvanceDashboard";
import { useKYCGate } from "../components/KYCGate";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BLUE = "#3B82F6";
const RED = "#EF4444";
const GREEN_DARK = "#065F46";
const GREEN_BODY = "#047857";

const PRODUCT_ICON: Record<AdvanceUiCode, string> = {
  contribution: "\u{1F6E1}️",
  quick: "⚡",
  flex: "\u{1F4CA}",
  premium: "\u{1F48E}",
};

const FIRST_VISIT_KEY = "@tandaxn_advance_hub_seen_v1";

type TabKey = "available" | "active" | "history";
type ProductState = "active" | "preview" | "locked";

function productState(card: AdvanceProductCard, xnscore: number): ProductState {
  if (card.eligible) return "active";
  const min = card.min_xnscore ?? 999;
  if (xnscore >= min - 10) return "preview";
  return "locked";
}

function dollars(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// ══════════════════════════════════════════════════════════════════════════
// First-visit explainer modal — replaces AdvanceExplanationV2 screen.
// ══════════════════════════════════════════════════════════════════════════

function FirstVisitModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [slide, setSlide] = useState(0);
  const isLast = slide === 1;
  const goNext = () => {
    if (isLast) onClose();
    else setSlide(1);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Ionicons
            name={slide === 0 ? "wallet-outline" : "swap-horizontal-outline"}
            size={36}
            color={TEAL}
            style={styles.modalIcon}
          />
          <Text style={styles.modalTitle}>
            {t(`advance_hub_v2.first_visit_slide${slide + 1}_title`)}
          </Text>
          <Text style={styles.modalBody}>
            {t(`advance_hub_v2.first_visit_slide${slide + 1}_body`)}
          </Text>
          <View style={styles.modalDots}>
            <View style={[styles.modalDot, slide === 0 && styles.modalDotActive]} />
            <View style={[styles.modalDot, slide === 1 && styles.modalDotActive]} />
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalSkipBtn}
              accessibilityRole="button"
            >
              <Text style={styles.modalSkipText}>
                {t("advance_hub_v2.first_visit_skip")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={goNext}
              style={styles.modalPrimaryBtn}
              accessibilityRole="button"
            >
              <Text style={styles.modalPrimaryText}>
                {isLast
                  ? t("advance_hub_v2.first_visit_got_it")
                  : t("advance_hub_v2.first_visit_next")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════

export default function AdvanceHubV2Screen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const { data, loading, error, refresh } = useAdvanceDashboard();
  const [tab, setTab] = useState<TabKey>("available");

  // First-visit modal — gated by AsyncStorage so it shows once per device.
  const [showFirstVisit, setShowFirstVisit] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(FIRST_VISIT_KEY);
        if (!cancelled && seen !== "1") setShowFirstVisit(true);
      } catch {
        /* AsyncStorage failures are non-fatal — skip the modal. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissFirstVisit = useCallback(() => {
    setShowFirstVisit(false);
    AsyncStorage.setItem(FIRST_VISIT_KEY, "1").catch(() => {});
  }, []);
  const reopenExplainer = () => setShowFirstVisit(true);

  // ── Loading / error ──────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.fullCenter}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.fullCenterLabel}>
            {t("advance_hub_v2.loading")}
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
            {t("advance_hub_v2.load_error")}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>
              {t("advance_hub_v2.retry")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const xnscore = data?.xnscore ?? 0;
  const completed = data?.completed_circles ?? 0;
  const products = data?.products ?? [];
  const activeAdvances = data?.active_advances ?? [];
  const pastAdvances = data?.past_advances ?? [];
  const outstanding = data?.outstanding_balance_cents ?? 0;
  const nextPayment = data?.next_payment_due ?? null;

  const eligibleCount = products.filter((p) => p.eligible).length;
  const availabilityLabel =
    eligibleCount >= 3
      ? t("advance_hub_v2.availability_many", { count: eligibleCount })
      : eligibleCount === 2
        ? t("advance_hub_v2.availability_two")
        : eligibleCount === 1
          ? t("advance_hub_v2.availability_one")
          : t("advance_hub_v2.availability_locked");

  // P0 (kyc-trigger review): unverified members get gated here at the
  // funnel entry — Hub → SmartCalculator → Apply. Catching it before
  // SmartCalculator is consistent with the spec ("wrap the Apply
  // button for each advance product"); the resume snapshot just sends
  // them back to the hub to re-pick (the product card row depends on
  // live eligibility which can shift between gate + resume).
  const advanceGate = useKYCGate({ resumeRoute: "AdvanceHubV2" });
  const handleSelectProduct = async (card: AdvanceProductCard) => {
    if (!card.eligible) return;
    const passed = await advanceGate.ensureVerified();
    if (!passed) return;
    navigation.navigate(Routes.SmartCalculator, {
      advanceType: card.ui_code,
      product: card,
      xnscore,
    } as never);
  };

  const openAdvanceDetails = (loanId: string) =>
    navigation.navigate(Routes.AdvanceDetailsV2 as never, {
      advanceId: loanId,
    } as never);

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
            <TouchableOpacity
              style={styles.gearButton}
              onPress={() => navigation.navigate(Routes.AdvanceSettings)}
              accessibilityRole="button"
              accessibilityLabel={t("advance_hub_v2.settings_a11y")}
            >
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* XnScore display */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreValue}>{xnscore}</Text>
              <Text style={styles.scoreLabel}>
                {t("advance_hub_v2.score_label")}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.availabilityText}>{availabilityLabel}</Text>
              <Text style={styles.statsText}>
                {t("advance_hub_v2.stats_text_completed_only", {
                  circles: completed,
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
          {/* Progress chip */}
          <View style={styles.progressChip}>
            <Ionicons name="ellipse" size={8} color={TEAL} />
            <Text style={styles.progressChipText}>
              {t("advance_hub_v2.progress_step_1")}
            </Text>
          </View>

          {/* Outstanding-balance summary (top of every tab when applicable) */}
          {activeAdvances.length > 0 ? (
            <View style={styles.outstandingCard}>
              <View style={styles.outstandingIconBox}>
                <Ionicons name="receipt-outline" size={22} color={TEAL} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.outstandingLabel}>
                  {t("advance_hub_v2.outstanding_label")}
                </Text>
                <Text style={styles.outstandingAmount}>
                  {dollars(outstanding)}
                </Text>
                {nextPayment ? (
                  <Text style={styles.outstandingNext}>
                    {t("advance_hub_v2.next_payment_due", {
                      amount: dollars(nextPayment.amount_cents),
                      date: nextPayment.date ?? "—",
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Tab bar (segmented control) */}
          <View style={styles.tabBar}>
            {(["available", "active", "history"] as TabKey[]).map((key) => {
              const isActive = tab === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.tab, isActive && styles.tabActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      isActive && styles.tabTextActive,
                    ]}
                  >
                    {t(`advance_hub_v2.tab_${key}`)}
                  </Text>
                  {key === "active" && activeAdvances.length > 0 ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>
                        {activeAdvances.length}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* AVAILABLE TAB */}
          {tab === "available" ? (
            <>
              {/* "What is an Advance?" — re-opens the first-visit modal */}
              <TouchableOpacity
                style={styles.learnCard}
                onPress={reopenExplainer}
                accessibilityRole="button"
                accessibilityLabel="Learn what an advance is"
              >
                <View style={styles.learnIconBox}>
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={TEAL}
                  />
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

              <View style={styles.productsList}>
                {products.map((p) => (
                  <ProductCard
                    key={p.ui_code}
                    card={p}
                    xnscore={xnscore}
                    onPress={() => handleSelectProduct(p)}
                    t={t}
                  />
                ))}
              </View>

              {/* Comparison note */}
              <View style={styles.comparisonNote}>
                <View style={styles.comparisonHeader}>
                  <Ionicons name="star" size={18} color="#00897B" />
                  <Text style={styles.comparisonTitle}>
                    {t("advance_hub_v2.comparison_title")}
                  </Text>
                </View>
                <Text style={styles.comparisonBody}>
                  <Text style={styles.comparisonStrong}>
                    {t("advance_hub_v2.comparison_local")}
                  </Text>
                  {" | "}
                  <Text style={styles.comparisonStrong}>
                    {t("advance_hub_v2.comparison_payday")}
                  </Text>
                  {" | "}
                  <Text style={styles.comparisonStrong}>
                    {t("advance_hub_v2.comparison_tandaxn")}
                  </Text>
                  {t("advance_hub_v2.comparison_tagline")}
                </Text>
              </View>
            </>
          ) : null}

          {/* ACTIVE TAB */}
          {tab === "active" ? (
            <View style={styles.listWrap}>
              {activeAdvances.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  label={t("advance_hub_v2.empty_active")}
                />
              ) : (
                activeAdvances.map((a) => (
                  <ActiveRow
                    key={a.loan_id}
                    advance={a}
                    onPress={() => openAdvanceDetails(a.loan_id)}
                    t={t}
                  />
                ))
              )}
            </View>
          ) : null}

          {/* HISTORY TAB */}
          {tab === "history" ? (
            <View style={styles.listWrap}>
              {pastAdvances.length === 0 ? (
                <EmptyState
                  icon="time-outline"
                  label={t("advance_hub_v2.empty_history")}
                />
              ) : (
                pastAdvances.map((p) => (
                  <PastRow key={p.entry_id} advance={p} t={t} />
                ))
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <FirstVisitModal
        visible={showFirstVisit}
        onClose={dismissFirstVisit}
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function ProductCard({
  card,
  xnscore,
  onPress,
  t,
}: {
  card: AdvanceProductCard;
  xnscore: number;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const state = productState(card, xnscore);
  const styling = stateStyling(state, t);
  const min = card.min_xnscore ?? 0;
  const progress = min > 0 ? Math.min(100, Math.round((xnscore / min) * 100)) : 100;
  const pointsNeeded = card.points_to_unlock ?? 0;
  const icon = PRODUCT_ICON[card.ui_code];
  const productName =
    card.name ?? t(`advance_hub_v2.product_${card.ui_code}_name`);
  const productTagline = t(`advance_hub_v2.product_${card.ui_code}_tagline`);
  const productDescription =
    card.description ?? t(`advance_hub_v2.product_${card.ui_code}_desc`);

  const openHelp = () =>
    Alert.alert(
      t(`advance_hub_v2.help_${card.ui_code}_title`),
      t(`advance_hub_v2.help_${card.ui_code}_body`),
    );

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
      disabled={state !== "active"}
      activeOpacity={state === "active" ? 0.85 : 1}
      accessibilityRole="button"
      accessibilityState={{ disabled: state !== "active" }}
      accessibilityLabel={`${productName}, ${styling.badgeLabel}`}
    >
      <View style={[styles.stateBadge, { backgroundColor: styling.badgeBg }]}>
        <Text style={styles.stateBadgeText}>{styling.badgeLabel}</Text>
      </View>

      <TouchableOpacity
        style={styles.helpButton}
        onPress={openHelp}
        accessibilityRole="button"
        accessibilityLabel={t(`advance_hub_v2.help_${card.ui_code}_title`)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="help-circle-outline" size={18} color={MUTED} />
      </TouchableOpacity>

      <View style={styles.productInner}>
        <View
          style={[
            styles.productIconBox,
            {
              backgroundColor:
                state === "active"
                  ? "#F0FDFB"
                  : state === "preview"
                    ? "#EFF6FF"
                    : "#F5F7FA",
              opacity: state === "locked" ? 0.6 : 1,
            },
          ]}
        >
          <Text style={styles.productIcon}>{icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{productName}</Text>
          <Text
            style={[
              styles.productTagline,
              {
                color:
                  state === "active"
                    ? TEAL
                    : state === "preview"
                      ? BLUE
                      : MUTED,
              },
            ]}
          >
            {productTagline}
          </Text>
          <Text style={styles.productDescription}>{productDescription}</Text>

          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabel}>
                {t("advance_hub_v2.stat_max_advance")}
              </Text>
              <Text style={styles.statValueNavy}>
                {t("advance_hub_v2.stat_max_advance_value", {
                  amount: dollars(card.max_amount_cents).replace("$", ""),
                })}
              </Text>
            </View>
            <View>
              <Text style={styles.statLabel}>
                {t("advance_hub_v2.stat_advance_fee")}
              </Text>
              <Text style={styles.statValueTeal}>
                {card.estimated_apr != null
                  ? `${card.estimated_apr.toFixed(1)}%`
                  : "—"}
              </Text>
            </View>
            <View>
              <Text style={styles.statLabel}>
                {t("advance_hub_v2.stat_repayment")}
              </Text>
              <Text style={styles.statValueNavy}>
                {card.min_term_months && card.max_term_months
                  ? card.min_term_months === card.max_term_months
                    ? t("advance_hub_v2.term_n_months", {
                        n: card.min_term_months,
                      })
                    : t("advance_hub_v2.term_range_months", {
                        min: card.min_term_months,
                        max: card.max_term_months,
                      })
                  : "—"}
              </Text>
            </View>
          </View>

          {state !== "active" && card.min_xnscore != null ? (
            <View style={styles.unlockBlock}>
              <View style={styles.unlockTopRow}>
                <Text style={styles.unlockLabel}>
                  {t("advance_hub_v2.unlock_progress_label")}
                </Text>
                <Text
                  style={[
                    styles.unlockProgressText,
                    state === "preview" && { color: BLUE },
                  ]}
                >
                  {xnscore}/{card.min_xnscore}
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFillSm,
                    {
                      width: `${progress}%`,
                      backgroundColor:
                        state === "preview" ? BLUE : "#9CA3AF",
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.unlockHint,
                  state === "preview" && { color: BLUE },
                ]}
              >
                {state === "preview"
                  ? t("advance_hub_v2.unlock_hint_preview", {
                      points: pointsNeeded,
                    })
                  : t("advance_hub_v2.unlock_hint_locked", {
                      payments: Math.ceil(pointsNeeded / 2),
                      target: card.min_xnscore,
                    })}
              </Text>
            </View>
          ) : null}
        </View>

        {state === "active" && (
          <Ionicons name="chevron-forward" size={20} color={TEAL} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function ActiveRow({
  advance,
  onPress,
  t,
}: {
  advance: ActiveAdvance;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const icon = (advance.db_code && PRODUCT_ICON_BY_DB[advance.db_code]) ?? "💼";
  return (
    <TouchableOpacity
      style={styles.listRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${advance.product_name ?? "Advance"}, $${(advance.outstanding_cents / 100).toFixed(2)} outstanding`}
    >
      <View style={styles.listIconBox}>
        <Text style={styles.listIcon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>
          {advance.product_name ?? t("advance_hub_v2.advance_label")}
        </Text>
        <Text style={styles.listSubtitle}>
          {t("advance_hub_v2.outstanding_short", {
            amount: dollars(advance.outstanding_cents),
          })}
        </Text>
        {advance.next_payment_date ? (
          <Text style={styles.listSubtitleMuted}>
            {t("advance_hub_v2.next_payment_inline", {
              amount: dollars(advance.next_payment_cents ?? 0),
              date: advance.next_payment_date,
            })}
          </Text>
        ) : null}
      </View>
      {advance.is_delinquent ? (
        <View style={[styles.listPill, { backgroundColor: "#FEE2E2" }]}>
          <Text style={[styles.listPillText, { color: "#DC2626" }]}>
            {t("advance_hub_v2.delinquent_pill")}
          </Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={MUTED} />
      )}
    </TouchableOpacity>
  );
}

function PastRow({
  advance,
  t,
}: {
  advance: PastAdvance;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const icon = (advance.db_code && PRODUCT_ICON_BY_DB[advance.db_code]) ?? "💼";
  const pill = pastStatusPill(advance.status, t);
  return (
    <View style={styles.listRow}>
      <View style={styles.listIconBox}>
        <Text style={styles.listIcon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>
          {advance.product_name ?? t("advance_hub_v2.advance_label")}
        </Text>
        <Text style={styles.listSubtitle}>
          {t("advance_hub_v2.principal_short", {
            amount: dollars(advance.principal_cents),
          })}
        </Text>
        {advance.closed_at ? (
          <Text style={styles.listSubtitleMuted}>
            {new Date(advance.closed_at).toLocaleDateString()}
          </Text>
        ) : null}
      </View>
      <View style={[styles.listPill, { backgroundColor: pill.bg }]}>
        <Text style={[styles.listPillText, { color: pill.color }]}>
          {pill.label}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={36} color={MUTED} />
      <Text style={styles.emptyStateText}>{label}</Text>
    </View>
  );
}

const PRODUCT_ICON_BY_DB: Record<string, string> = {
  circle_boost: "\u{1F6E1}️",
  micro_emergency: "⚡",
  education: "\u{1F4CA}",
  small_business: "\u{1F48E}",
};

function pastStatusPill(
  status: string,
  t: (key: string) => string,
): { label: string; bg: string; color: string } {
  switch (status) {
    case "paid_off":
      return {
        label: t("advance_hub_v2.history_status_paid"),
        bg: "#F0FDF4",
        color: "#166534",
      };
    case "defaulted":
      return {
        label: t("advance_hub_v2.history_status_defaulted"),
        bg: "#FEE2E2",
        color: "#DC2626",
      };
    case "written_off":
      return {
        label: t("advance_hub_v2.history_status_written_off"),
        bg: "#FEE2E2",
        color: "#DC2626",
      };
    case "rejected":
      return {
        label: t("advance_hub_v2.history_status_rejected"),
        bg: "#FEF3C7",
        color: "#92400E",
      };
    case "cancelled":
      return {
        label: t("advance_hub_v2.history_status_cancelled"),
        bg: "#F5F7FA",
        color: MUTED,
      };
    case "expired":
      return {
        label: t("advance_hub_v2.history_status_expired"),
        bg: "#F5F7FA",
        color: MUTED,
      };
    default:
      return { label: status, bg: "#F5F7FA", color: MUTED };
  }
}

function stateStyling(state: ProductState, t: (key: string) => string) {
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

// ══════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════

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
  gearButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
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

  outstandingCard: {
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
  outstandingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  outstandingLabel: { fontSize: 12, color: MUTED },
  outstandingAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  outstandingNext: { fontSize: 11, color: MUTED, marginTop: 2 },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: { backgroundColor: NAVY },
  tabText: { fontSize: 13, fontWeight: "600", color: MUTED },
  tabTextActive: { color: "#FFFFFF" },
  tabBadge: {
    backgroundColor: TEAL,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },

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
  helpButton: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 1,
  },
  stateBadge: {
    position: "absolute",
    top: -8,
    right: 36,
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
  progressFillSm: { height: 6, borderRadius: 3 },
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
  comparisonBody: { fontSize: 12, color: GREEN_BODY, lineHeight: 18 },
  comparisonStrong: { fontWeight: "700" },

  // ── List rows (Active + History) ────────────────────────────────────
  listWrap: { gap: 10 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  listIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  listIcon: { fontSize: 22 },
  listTitle: { fontSize: 14, fontWeight: "700", color: NAVY },
  listSubtitle: { fontSize: 12, fontWeight: "600", color: NAVY, marginTop: 2 },
  listSubtitleMuted: { fontSize: 11, color: MUTED, marginTop: 2 },
  listPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  listPillText: { fontSize: 10, fontWeight: "700" },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyStateText: { fontSize: 13, color: MUTED, textAlign: "center" },

  // ── First-visit modal ───────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  modalIcon: { marginBottom: 14 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 10,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  modalDots: { flexDirection: "row", gap: 6, marginBottom: 18 },
  modalDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: BORDER,
  },
  modalDotActive: { backgroundColor: TEAL, width: 18 },
  modalActions: { flexDirection: "row", gap: 10, width: "100%" },
  modalSkipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  modalSkipText: { fontSize: 13, color: MUTED, fontWeight: "600" },
  modalPrimaryBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: TEAL,
  },
  modalPrimaryText: { fontSize: 13, color: "#FFFFFF", fontWeight: "700" },
});
