// ══════════════════════════════════════════════════════════════════════════════
// screens/CirclesV2Screen.tsx — rebuilt Circles screen.
// ══════════════════════════════════════════════════════════════════════════════
//
// Step 4 (iteration 1): screen scaffold + Group 1 (Circle discovery & health)
// only. Remaining groups (Risk & safety, Contribution & payout rules,
// Cross-circle features) come in the next iteration after user confirmation.
//
// Pattern for each feature card:
//   <FeatureCard
//     icon=...      title=...        description=...
//     statusKey=... (optional toggle/badge to the right of the title)
//     ctaLabelKey=...   onCta={...}  (button at the bottom)
//   />
//
// All 9 feature CTAs navigate to real deep-dive screens — no placeholder
// alerts. CirclesV2Screen is wired into the Circles tab via CirclesStack
// (replaced the legacy CirclesScreen in App.tsx).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useCircles } from "../context/CirclesContext";
import { useInsurancePool } from "../hooks/useInsurancePool";
import { InsurancePoolEngine } from "../services/InsurancePoolEngine";
import { useEventTracker } from "../hooks/useEventTracker";
import {
  usePoolEntry as useSubstitutePoolEntry,
  useSubstitutePoolSummary,
} from "../hooks/useSubstituteMember";
import { usePartialPlanSummary } from "../hooks/usePartialContribution";
import { useAuth } from "../context/AuthContext";

// ==========================================================================
// Mock data — to be replaced with real API feeds in later steps.
// ==========================================================================

const mockSummary = {
  circle_count: 3,
  contributions_due_this_month: 2,
};

// Trending counter for Discover Circles card.
const mockDiscover = {
  new_this_week: 12,
};

// Per-circle health scores for the Circle Health card.
// Status colors: 80+ healthy (teal), 60-79 watch (amber), <60 risk (red).
type HealthRow = { id: string; name: string; score: number };

const mockHealth: HealthRow[] = [
  { id: "fam", name: "Family Circle", score: 92 },
  { id: "biz", name: "Business Builders", score: 78 },
  { id: "fri", name: "Friends 2025", score: 55 },
];

function healthColor(score: number): string {
  if (score >= 80) return colors.accentTeal;
  if (score >= 60) return colors.warningAmber;
  return colors.errorText;
}

// Risk & Safety group mocks.
const mockConflicts = {
  count: 2,
  most_recent: {
    circle: "Family Circle",
    descriptionKey: "circles_screen.conflict_recent_description_missed",
    date: "Mar 10",
  },
};

// Migration 206 (Bucket A): the Insurance Pool feature card now reads
// the real circle_insurance_pools row + circles.insurance_pool_enabled
// flag via useInsurancePool below. The legacy mockInsurance object
// (initially_active + pool_balance) was deleted as part of that change.

// Substitute Pool Bucket A: the legacy mockSubstitute object
// ({ initially_active, available }) was deleted. The card now reads the
// user's pool entry status + global active count via useSubstitutePoolEntry
// and useSubstitutePoolSummary below — no toggle.

// Contribution & Payout group mocks.
const mockPayout = {
  position: 2,
  total: 6,
};

// Partial Contribution Bucket A: legacy mockPartial array deleted. The
// feature is a global member-action triggered from a specific cycle's
// contribution — not a per-circle setting. The card now shows the user's
// real active-plan count via usePartialPlanSummary below.

const mockSwap = {
  last_request_date: "Mar 5",
};

// Cross-circle group mock.
const mockLending = {
  status: "available" as "available" | "restricted",
};

// ==========================================================================
// FeatureCard — shared card shell for every group's items.
// ==========================================================================

type FeatureCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusColor?: string;
  /** When provided, renders a Switch in the header instead of a status pill. */
  headerToggle?: {
    value: boolean;
    onValueChange: (next: boolean) => void;
    /** When true, the Switch is greyed out and ignores taps. */
    disabled?: boolean;
  };
  ctaLabel: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onCta: () => void;
  children?: React.ReactNode;
};

function FeatureCard({
  icon,
  iconColor,
  title,
  description,
  statusLabel,
  statusColor,
  headerToggle,
  ctaLabel,
  ctaIcon,
  onCta,
  children,
}: FeatureCardProps) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureHeaderRow}>
        <View
          style={[
            styles.featureIconBox,
            { backgroundColor: `${iconColor ?? colors.primaryNavy}1A` },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={iconColor ?? colors.primaryNavy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featureDescription}>{description}</Text>
        </View>
        {headerToggle ? (
          <Switch
            value={headerToggle.value}
            onValueChange={headerToggle.onValueChange}
            disabled={headerToggle.disabled}
            trackColor={{ false: colors.border, true: colors.accentTeal }}
            thumbColor={colors.cardBg}
          />
        ) : statusLabel ? (
          <View
            style={[
              styles.featureStatusPill,
              { backgroundColor: `${statusColor ?? colors.textSecondary}1A` },
            ]}
          >
            <Text
              style={[
                styles.featureStatusText,
                { color: statusColor ?? colors.textSecondary },
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {children ? <View style={styles.featureBody}>{children}</View> : null}

      <TouchableOpacity
        style={styles.featureCta}
        onPress={onCta}
        accessibilityRole="button"
      >
        <Text style={styles.featureCtaText}>{ctaLabel}</Text>
        {ctaIcon ? (
          <Ionicons name={ctaIcon} size={14} color={colors.primaryNavy} />
        ) : (
          <Ionicons name="chevron-forward" size={14} color={colors.primaryNavy} />
        )}
      </TouchableOpacity>
    </View>
  );
}

// ==========================================================================
// Screen
// ==========================================================================

export default function CirclesV2Screen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  // The user's own circles (created by them + joined). Pre-fix this screen
  // showed only feature cards, so a freshly-created circle had no surface
  // visible to the user — they reported "I created a circle but I don't
  // see it after I review it." Reads from CirclesContext, which both
  // optimistically prepends the new row on createCircle() AND patches
  // from the realtime channel, so the list updates without a manual pull.
  const { myCircles, isLoading: circlesLoading } = useCircles();

  // ---- Header action handlers ----
  // Primary path is now the one-screen express flow. The full 5-step wizard
  // (CreateCircleStart) stays reachable via the "Advanced setup" link below
  // the action row for users who need the full option surface (beneficiary,
  // recurring cycles, Elder community, etc.).
  const handleCreateCircle = () => {
    navigation.navigate(Routes.CreateCircleExpress);
  };
  const handleAdvancedSetup = () => {
    navigation.navigate(Routes.CreateCircleStart);
  };
  const handleJoinCircle = () => {
    navigation.navigate(Routes.DiscoverCircles);
  };
  // Secondary entry for users who already have a specific invite code in
  // hand — bypasses the discover-listing tap path. Previously orphan: the
  // JoinCircleByCode screen existed but had no surfaced entry point from
  // the Circles tab.
  const handleOpenInviteCode = () => {
    navigation.navigate(Routes.JoinCircleByCode);
  };

  // ---- Per-feature CTA handlers — all wired to real screens.
  // Detail screens (Insurance/Payout/Partial) require a circleId in
  // route.params; CirclesV2 doesn't have a "currently-selected circle"
  // concept, so we pass a default mock id matching HomeScreen.mockCircles.
  const DEFAULT_CIRCLE_ID = "family-circle-1";
  const DEFAULT_CYCLE_ID = "default-cycle-1";

  const handleOpenDiscover = () => navigation.navigate(Routes.DiscoverCircles);
  const handleOpenHealth = () => navigation.navigate(Routes.CircleHealth);
  // KYC P0 (2026-06-12): Conflict P0 bug fix — pass the user's first
  // active circle as circleId. When the user has no circles the screen
  // falls into its empty-state circle picker. Previously this call
  // passed no params and crashed `usePostFormationMonitor(undefined)`.
  const handleOpenConflict = () =>
    navigation.navigate(Routes.ConflictAlert, {
      circleId: myCircles[0]?.id,
    });
  // Migration 206 (Bucket A): the Insurance Pool card now lives on the
  // user's first active circle, matching how Conflict P0 was wired. If
  // there are no circles, navigate without a circleId so the screen
  // renders its empty state instead of crashing on a fictional UUID.
  const handleOpenInsurance = () =>
    navigation.navigate(Routes.InsurancePool, {
      circleId: myCircles[0]?.id,
    });
  const handleOpenSubstitute = () => navigation.navigate(Routes.SubstitutePool);
  const handleOpenPayout = () =>
    navigation.navigate(Routes.DynamicPayout, { circleId: DEFAULT_CIRCLE_ID });
  // Partial Contribution Bucket A: navigate with the user's first active
  // circle id, not the mock DEFAULT_CIRCLE_ID. The screen resolves the
  // active cycle on mount so cycleId can stay omitted.
  const handleOpenPartial = () =>
    navigation.navigate(Routes.PartialContribution, {
      circleId: myCircles[0]?.id,
    });
  const handleOpenSwap = () =>
    navigation.navigate(Routes.PositionSwap, { circleId: DEFAULT_CIRCLE_ID });
  const handleOpenLending = () => navigation.navigate(Routes.CrossCircleLending);
  const handleOpenTripOrganizer = () =>
    navigation.navigate(Routes.OrganizerTripList);
  const handleOpenAdvanceStatus = () =>
    navigation.navigate(Routes.AdvanceHubV2);

  // ---- Toggle state for header switches ----
  // Migration 206 (Bucket A): real Insurance Pool toggle backed by
  // useInsurancePool(myCircles[0]?.id) + set_circle_pool_enabled RPC.
  // Local `insuranceActive` is the optimistic flag rendered into the
  // header switch — initialized from the live pool, kept in sync via
  // useEffect, and rolled back if the RPC fails.
  const insurancePoolCircleId = myCircles[0]?.id;
  const {
    pool: insurancePool,
    refetch: refetchInsurancePool,
  } = useInsurancePool(insurancePoolCircleId);
  const { track } = useEventTracker();
  const [insuranceActive, setInsuranceActive] = useState<boolean>(true);
  useEffect(() => {
    if (insurancePool) {
      setInsuranceActive(insurancePool.adminEnabled);
    }
  }, [insurancePool]);
  const handleToggleInsurance = useCallback(
    async (next: boolean) => {
      if (!insurancePoolCircleId) return;
      const prev = insuranceActive;
      setInsuranceActive(next); // optimistic
      const result = await InsurancePoolEngine.setCirclePoolEnabled(
        insurancePoolCircleId,
        next,
      );
      if (!result.success) {
        // Roll back UI; surface the error via Alert.
        setInsuranceActive(prev);
        const reason =
          result.error === "not_authorized"
            ? t("insurance_pool.toggle_error_not_authorized")
            : t("insurance_pool.toggle_error_generic");
        Alert.alert(t("insurance_pool.toggle_error_title"), reason);
        return;
      }
      // Bucket C — telemetry on confirmed-applied admin toggle.
      track({
        eventType: "pool.circle_toggled",
        eventCategory: "circle",
        eventAction: "click",
        eventLabel: insurancePoolCircleId,
        eventValue: { circle_id: insurancePoolCircleId, new_value: next },
      });
      refetchInsurancePool();
    },
    [insurancePoolCircleId, insuranceActive, refetchInsurancePool, track, t],
  );

  // Substitute Pool Bucket A — drop the mock useState and read real data:
  //   * usePoolEntry  → "Active in pool" / "Not joined" / etc. for the
  //                     current user (member-centric, not per-circle).
  //   * useSubstitutePoolSummary → global active substitute count.
  const { user } = useAuth();
  const { entry: substituteEntry, isInPool: substituteInPool } =
    useSubstitutePoolEntry(user?.id);
  const { overview: substituteOverview } = useSubstitutePoolSummary();
  const substituteAvailableCount = substituteOverview?.totalActive ?? 0;
  // Map the user's pool entry to the i18n key suffix used on the badge.
  const substituteStatusKey: "in_pool" | "standby" | "suspended" | "not_joined" =
    !substituteEntry
      ? "not_joined"
      : substituteEntry.status === "active"
        ? "in_pool"
        : substituteEntry.status === "standby"
          ? "standby"
          : substituteEntry.status === "suspended"
            ? "suspended"
            : "not_joined";
  void substituteInPool; // marked usable for future logic; silence lint.

  // Partial Contribution Bucket A: replace the mock per-circle Switch state
  // with a real active-plan count across all circles. Drives the FeatureCard
  // status row + body line below.
  const { activeCount: partialActiveCount } = usePartialPlanSummary(user?.id);

  // Every feature card now navigates to a real screen — no placeholder alerts.

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER SUMMARY CARD ===== */}
        <LinearGradient
          colors={[colors.primaryNavy, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <Text style={styles.headerEyebrow}>
            {t("circles_screen.header_eyebrow")}
          </Text>
          <Text style={styles.headerTitle}>
            {t("circles_screen.header_summary", {
              count: mockSummary.circle_count,
            })}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t("circles_screen.header_due_summary", {
              count: mockSummary.contributions_due_this_month,
            })}
          </Text>
        </LinearGradient>

        {/* ===== HEADER ACTION ROW — Create + Join ===== */}
        <View style={styles.headerActionsRow}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={handleCreateCircle}
            accessibilityRole="button"
            accessibilityLabel={t("circles_screen.action_create_circle")}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={colors.textWhite}
            />
            <Text style={styles.actionBtnPrimaryText}>
              {t("circles_screen.action_create_circle")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={handleJoinCircle}
            accessibilityRole="button"
            accessibilityLabel={t("circles_screen.action_join_circle")}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.primaryNavy}
            />
            <Text style={styles.actionBtnOutlineText}>
              {t("circles_screen.action_join_circle")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Secondary entry points beneath the primary Create/Join row.
            Stacked vertically so neither steals attention from the chunky
            Create/Join buttons above. */}
        <View style={styles.secondaryLinksRow}>
          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={handleAdvancedSetup}
            accessibilityRole="link"
            accessibilityLabel={t("circles_screen.action_advanced_setup")}
          >
            <Ionicons
              name="options-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.secondaryLinkText}>
              {t("circles_screen.action_advanced_setup")}
            </Text>
          </TouchableOpacity>

          <View style={styles.secondaryLinkDivider} />

          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={handleOpenInviteCode}
            accessibilityRole="link"
            accessibilityLabel={t("circles_screen.action_have_invite_code")}
          >
            <Ionicons name="key-outline" size={14} color={colors.accentTeal} />
            <Text style={styles.secondaryLinkTextTeal}>
              {t("circles_screen.action_have_invite_code")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===== MY CIRCLES =====
            First and most important section on this screen — reads
            `myCircles` from CirclesContext (server-backed). Tapping a row
            navigates to CircleDetail. When `status='pending'` and the
            circle hasn't hit capacity, the row shows a "Waiting" badge so
            the creator knows their circle isn't running yet. */}
        <View style={styles.myCirclesHeader}>
          <Text style={styles.myCirclesTitle}>
            {t("circles_screen.section_my_circles")}
          </Text>
          {myCircles.length > 0 && (
            <View style={styles.myCirclesCountChip}>
              <Text style={styles.myCirclesCountChipText}>
                {myCircles.length}
              </Text>
            </View>
          )}
        </View>

        {circlesLoading && myCircles.length === 0 ? (
          <View style={styles.myCirclesEmpty}>
            <Text style={styles.myCirclesEmptyText}>
              {t("circles_screen.my_circles_loading")}
            </Text>
          </View>
        ) : myCircles.length === 0 ? (
          <View style={styles.myCirclesEmpty}>
            <Ionicons
              name="people-outline"
              size={26}
              color={colors.textSecondary}
            />
            <Text style={styles.myCirclesEmptyText}>
              {t("circles_screen.my_circles_empty")}
            </Text>
          </View>
        ) : (
          <View style={styles.myCirclesList}>
            {myCircles.slice(0, 5).map((circle) => {
              const isWaiting =
                circle.status === "pending" &&
                circle.currentMembers < circle.memberCount;
              return (
                <TouchableOpacity
                  key={circle.id}
                  style={styles.myCircleRow}
                  onPress={() =>
                    navigation.navigate(Routes.CircleDetail, {
                      circleId: circle.id,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={circle.name}
                  activeOpacity={0.7}
                >
                  <View style={styles.myCircleEmojiWrap}>
                    <Text style={styles.myCircleEmoji}>
                      {circle.emoji || "💰"}
                    </Text>
                  </View>
                  <View style={styles.myCircleInfo}>
                    <Text style={styles.myCircleName} numberOfLines={1}>
                      {circle.name}
                    </Text>
                    <Text style={styles.myCircleMeta}>
                      {t("circles_screen.member_count", {
                        current: circle.currentMembers,
                        total: circle.memberCount,
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.myCircleBadge,
                      isWaiting
                        ? styles.myCircleBadgeWaiting
                        : styles.myCircleBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.myCircleBadgeText,
                        isWaiting
                          ? styles.myCircleBadgeWaitingText
                          : styles.myCircleBadgeActiveText,
                      ]}
                    >
                      {isWaiting
                        ? t("circles_screen.badge_waiting")
                        : t("circles_screen.badge_active")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
            {myCircles.length > 5 && (
              <TouchableOpacity
                style={styles.myCirclesSeeAll}
                onPress={handleOpenDiscover}
                accessibilityRole="link"
              >
                <Text style={styles.myCirclesSeeAllText}>
                  {t("circles_screen.my_circles_see_all", {
                    count: myCircles.length - 5,
                  })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ===== GROUP 1 — CIRCLE DISCOVERY & HEALTH ===== */}
        <View style={styles.groupHeader}>
          <Ionicons
            name="compass-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.groupHeaderText}>
            {t("circles_screen.group_discovery_health")}
          </Text>
        </View>

        {/* ----- Discover Circles ----- */}
        <FeatureCard
          icon="search-outline"
          iconColor={colors.primaryNavy}
          title={t("circles_screen.discover_title")}
          description={t("circles_screen.discover_description")}
          statusLabel={t("circles_screen.discover_status_new", {
            count: mockDiscover.new_this_week,
          })}
          statusColor={colors.accentTeal}
          ctaLabel={t("circles_screen.discover_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenDiscover}
        />

        {/* ----- Circle Health ----- */}
        <FeatureCard
          icon="pulse-outline"
          iconColor={colors.accentTeal}
          title={t("circles_screen.health_title")}
          description={t("circles_screen.health_description")}
          ctaLabel={t("circles_screen.health_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenHealth}
        >
          {/* Per-circle health rows */}
          {mockHealth.map((row, idx) => {
            const color = healthColor(row.score);
            return (
              <View
                key={row.id}
                style={[
                  styles.healthRow,
                  idx === mockHealth.length - 1 && styles.healthRowLast,
                ]}
              >
                <Text style={styles.healthName} numberOfLines={1}>
                  {row.name}
                </Text>
                <View style={styles.healthBarBg}>
                  <View
                    style={[
                      styles.healthBarFill,
                      { width: `${row.score}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={[styles.healthScore, { color }]}>{row.score}</Text>
              </View>
            );
          })}
        </FeatureCard>

        {/* ===== GROUP 2 — RISK & SAFETY ===== */}
        <View style={styles.groupHeader}>
          <Ionicons
            name="shield-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.groupHeaderText}>
            {t("circles_screen.group_risk_safety")}
          </Text>
        </View>

        {/* ----- Conflict Alerts ----- */}
        <FeatureCard
          icon="alert-circle-outline"
          iconColor={colors.errorText}
          title={t("circles_screen.conflict_title")}
          description={t("circles_screen.conflict_description")}
          statusLabel={t("circles_screen.conflict_status_alerts", {
            count: mockConflicts.count,
          })}
          statusColor={colors.errorText}
          ctaLabel={t("circles_screen.conflict_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenConflict}
        >
          <Text style={styles.bodyLabel}>
            {t("circles_screen.conflict_recent_label")}
          </Text>
          <View style={styles.recentAlertRow}>
            <Ionicons
              name="warning-outline"
              size={14}
              color={colors.errorText}
            />
            <Text style={styles.recentAlertText}>
              {t("circles_screen.conflict_recent_text", {
                circle: mockConflicts.most_recent.circle,
                description: t(mockConflicts.most_recent.descriptionKey),
                date: mockConflicts.most_recent.date,
              })}
            </Text>
          </View>
        </FeatureCard>

        {/* ----- Insurance Pool ----- */}
        {/* Migration 206 (Bucket A): toggle + balance come from the live
            pool for the user's first active circle. Switch is disabled
            when the user has no circles (no pool to flip). */}
        <FeatureCard
          icon="shield-checkmark-outline"
          iconColor={colors.accentTeal}
          title={t("circles_screen.insurance_title")}
          description={t("circles_screen.insurance_description")}
          headerToggle={{
            value: insuranceActive,
            onValueChange: handleToggleInsurance,
            disabled: !insurancePoolCircleId,
          }}
          ctaLabel={t("circles_screen.insurance_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenInsurance}
        >
          <View style={styles.poolStatRow}>
            <Text style={styles.poolStatLabel}>
              {t("circles_screen.insurance_pool_balance_label")}
            </Text>
            <Text style={styles.poolStatValue}>
              {insurancePool
                ? `$${(insurancePool.balanceCents / 100).toFixed(2)}`
                : "—"}
            </Text>
          </View>
          <Text
            style={[
              styles.poolStatusInline,
              {
                color: insuranceActive
                  ? colors.successText
                  : colors.textSecondary,
              },
            ]}
          >
            {insuranceActive
              ? t("circles_screen.insurance_status_active")
              : t("circles_screen.insurance_status_inactive")}
          </Text>
        </FeatureCard>

        {/* ----- Substitute Pool ----- */}
        {/* Bucket A: no headerToggle — the substitute pool is a global
            queue, not a per-circle setting. We show the user's own pool
            status as a badge + the live global active count instead. */}
        <FeatureCard
          icon="people-circle-outline"
          iconColor={colors.primaryNavy}
          title={t("circles_screen.substitute_title")}
          description={t("circles_screen.substitute_description")}
          statusLabel={t(
            `circles_screen.substitute_status_${substituteStatusKey}`,
          )}
          statusColor={
            substituteStatusKey === "in_pool"
              ? colors.successText
              : substituteStatusKey === "standby"
                ? colors.accentTeal
                : substituteStatusKey === "suspended"
                  ? colors.warningAmber
                  : colors.textSecondary
          }
          ctaLabel={t("circles_screen.substitute_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenSubstitute}
        >
          <View style={styles.poolStatRow}>
            <Ionicons
              name="people-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.poolStatLabel}>
              {t("circles_screen.substitute_available", {
                count: substituteAvailableCount,
              })}
            </Text>
          </View>
        </FeatureCard>

        {/* ===== GROUP 3 — CONTRIBUTION & PAYOUT RULES ===== */}
        <View style={styles.groupHeader}>
          <Ionicons
            name="cash-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.groupHeaderText}>
            {t("circles_screen.group_contribution_payout")}
          </Text>
        </View>

        {/* ----- Payout Ordering ----- */}
        <FeatureCard
          icon="list-outline"
          iconColor={colors.accentTeal}
          title={t("circles_screen.payout_title")}
          description={t("circles_screen.payout_description")}
          statusLabel={t("circles_screen.payout_position_status", {
            position: mockPayout.position,
            total: mockPayout.total,
          })}
          statusColor={colors.primaryNavy}
          ctaLabel={t("circles_screen.payout_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenPayout}
        />

        {/* ----- Partial Contribution ----- */}
        {/* Bucket A: no per-circle toggles — partial contribution is a
            member-action on a specific cycle, not a circle-level setting.
            The card now surfaces the user's real active-plan count. */}
        <FeatureCard
          icon="pie-chart-outline"
          iconColor={colors.primaryNavy}
          title={t("circles_screen.partial_title")}
          description={t("circles_screen.partial_description")}
          statusLabel={
            partialActiveCount > 0
              ? t("circles_screen.partial_status_active", {
                  count: partialActiveCount,
                })
              : t("circles_screen.partial_status_none")
          }
          statusColor={
            partialActiveCount > 0
              ? colors.accentTeal
              : colors.textSecondary
          }
          ctaLabel={t("circles_screen.partial_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenPartial}
        >
          <View style={styles.poolStatRow}>
            <Ionicons
              name="receipt-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.poolStatLabel}>
              {partialActiveCount > 0
                ? t("circles_screen.partial_body_active", {
                    count: partialActiveCount,
                  })
                : t("circles_screen.partial_body_idle")}
            </Text>
          </View>
        </FeatureCard>

        {/* ----- Position Swap ----- */}
        <FeatureCard
          icon="swap-horizontal-outline"
          iconColor={colors.accentTeal}
          title={t("circles_screen.swap_title")}
          description={t("circles_screen.swap_description")}
          ctaLabel={t("circles_screen.swap_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenSwap}
        >
          <View style={styles.swapLastRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.swapLastText}>
              {t("circles_screen.swap_last_request_body", {
                date: mockSwap.last_request_date,
              })}
            </Text>
          </View>
        </FeatureCard>

        {/* ===== GROUP 4 — CROSS-CIRCLE FEATURES ===== */}
        <View style={styles.groupHeader}>
          <Ionicons
            name="git-network-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.groupHeaderText}>
            {t("circles_screen.group_cross_circle")}
          </Text>
        </View>

        {/* ----- Cross Circle Lending ----- */}
        <FeatureCard
          icon="share-social-outline"
          iconColor={colors.accentTeal}
          title={t("circles_screen.lending_title")}
          description={t("circles_screen.lending_description")}
          statusLabel={
            mockLending.status === "available"
              ? t("circles_screen.lending_status_available")
              : t("circles_screen.lending_status_restricted")
          }
          statusColor={
            mockLending.status === "available"
              ? colors.accentTeal
              : colors.errorText
          }
          ctaLabel={t("circles_screen.lending_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenLending}
        />

        {/* ===== GROUP 5 — GROUP BUYS & TRIPS ===== */}
        <View style={styles.groupHeader}>
          <Ionicons
            name="airplane-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.groupHeaderText}>
            {t("circles_screen.group_group_buys_trips")}
          </Text>
        </View>

        {/* ----- Trip Organizer ----- */}
        <FeatureCard
          icon="airplane-outline"
          iconColor={colors.accentTeal}
          title={t("circles_screen.feature_trip_organizer_title")}
          description={t("circles_screen.feature_trip_organizer_desc")}
          ctaLabel={t("circles_screen.feature_trip_organizer_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenTripOrganizer}
        />

        {/* ===== GROUP 6 — ADVANCE MANAGEMENT ===== */}
        <View style={styles.groupHeader}>
          <Ionicons
            name="flash-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.groupHeaderText}>
            {t("circles_screen.group_advance_management")}
          </Text>
        </View>

        {/* ----- Manage active advances ----- */}
        <FeatureCard
          icon="speedometer-outline"
          iconColor={colors.warningAmber}
          title={t("circles_screen.feature_advance_status_title")}
          description={t("circles_screen.feature_advance_status_desc")}
          ctaLabel={t("circles_screen.feature_advance_status_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenAdvanceStatus}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // ----- Header summary card -----
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  headerEyebrow: {
    color: colors.textOnNavy,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headerTitle: {
    color: colors.textWhite,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  headerSubtitle: {
    color: colors.textOnNavy,
    fontSize: 13,
  },

  // ----- Header action row (Create + Join Circle) -----
  headerActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primaryNavy,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnPrimaryText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 14,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.cardBg,
    borderColor: colors.primaryNavy,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnOutlineText: {
    color: colors.primaryNavy,
    fontWeight: "700",
    fontSize: 14,
  },
  inviteCodeLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 18,
    paddingVertical: 4,
  },
  inviteCodeLinkText: {
    color: colors.accentTeal,
    fontSize: 13,
    fontWeight: "600",
  },

  // Secondary links beneath the primary Create/Join action row — Advanced
  // setup (full wizard) and Have-an-invite-code, separated by a dot.
  secondaryLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 18,
    paddingVertical: 4,
  },
  secondaryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  secondaryLinkText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  secondaryLinkTextTeal: {
    color: colors.accentTeal,
    fontSize: 12,
    fontWeight: "600",
  },
  secondaryLinkDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.border,
  },

  // ── My Circles section ─────────────────────────────────────────────────
  myCirclesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  myCirclesTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  myCirclesCountChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.tealTintBg,
  },
  myCirclesCountChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accentTeal,
  },
  myCirclesEmpty: {
    alignItems: "center",
    padding: 22,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    marginBottom: 18,
  },
  myCirclesEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  myCirclesList: {
    marginBottom: 18,
    gap: 8,
  },
  myCircleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myCircleEmojiWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  myCircleEmoji: {
    fontSize: 20,
  },
  myCircleInfo: {
    flex: 1,
  },
  myCircleName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  myCircleMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  myCircleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  myCircleBadgeWaiting: {
    backgroundColor: "#FEF3C7",
  },
  myCircleBadgeActive: {
    backgroundColor: colors.tealTintBg,
  },
  myCircleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  myCircleBadgeWaitingText: {
    color: "#92400E",
  },
  myCircleBadgeActiveText: {
    color: colors.accentTeal,
  },
  myCirclesSeeAll: {
    alignItems: "center",
    paddingVertical: 8,
  },
  myCirclesSeeAllText: {
    color: colors.accentTeal,
    fontSize: 12,
    fontWeight: "600",
  },

  // ----- Group header (above each group of feature cards) -----
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  groupHeaderText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // ----- Feature card shell -----
  featureCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  featureDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  featureStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  featureStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  featureBody: {
    marginTop: 12,
  },
  featureCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.screenBg,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  featureCtaText: {
    color: colors.primaryNavy,
    fontSize: 13,
    fontWeight: "600",
  },

  // ----- Shared body label (small caps gray, used across feature bodies) -----
  bodyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // ----- Conflict Alerts — recent alert row -----
  recentAlertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.errorBg,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  recentAlertText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "500",
  },

  // ----- Insurance Pool & Substitute Pool body -----
  poolStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  poolStatLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  poolStatValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  poolStatusInline: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  // ----- Partial Contribution rows -----
  partialRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  partialRowLast: { borderBottomWidth: 0 },
  partialName: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  partialStateLabel: {
    fontSize: 11,
    fontWeight: "700",
    minWidth: 60,
    textAlign: "right",
  },

  // ----- Position Swap — last request line -----
  swapLastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.screenBg,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  swapLastText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
  },

  // ----- Circle Health rows -----
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  healthRowLast: { borderBottomWidth: 0 },
  healthName: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
    width: 120,
  },
  healthBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  healthBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  healthScore: {
    fontSize: 13,
    fontWeight: "700",
    width: 28,
    textAlign: "right",
  },
});
