import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  Share,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { Circle, CircleMember, CircleActivity, useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";
import { useActivePlan } from "../hooks/usePartialContribution";
import { useCircleHealth } from "../hooks/useCircleHealth";

type CircleDetailNavigationProp = StackNavigationProp<RootStackParamList>;
type CircleDetailRouteProp = RouteProp<RootStackParamList, "CircleDetail">;

// User role types for the circle
type UserRole = "member" | "admin" | "elder";

const { width } = Dimensions.get("window");

// Menu item interface for cleaner code
interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  description?: string;
}

const getCircleTypeLabel = (type: string): string => {
  switch (type) {
    case "traditional":
      return "Rotating Pot";
    case "family-support":
      return "Single Beneficiary";
    case "goal":
    case "goal-based":
      return "Shared Goal";
    case "emergency":
      return "Emergency Pool";
    case "beneficiary":
      return "Flexible Fundraise";
    default:
      return "Savings Circle";
  }
};

const getFrequencyLabel = (frequency: string): string => {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    case "one-time":
      return "One-time";
    default:
      return frequency;
  }
};

const getRotationMethodLabel = (method: string): string => {
  switch (method) {
    case "xnscore":
      return "By XnScore";
    case "random":
      return "Random Draw";
    case "manual":
      return "Manual Assignment";
    case "beneficiary":
      return "Fixed Beneficiary";
    default:
      return method;
  }
};

export default function CircleDetailScreen() {
  const navigation = useNavigation<CircleDetailNavigationProp>();
  const route = useRoute<CircleDetailRouteProp>();
  const { t } = useTranslation();
  const { circleId } = route.params;
  const { circles, browseCircles, myCircles, getCircleMembers, getCircleActivities, refreshCircles } = useCircles();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "members" | "activity">("overview");
  const [showMenu, setShowMenu] = useState(false);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [activities, setActivities] = useState<CircleActivity[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Phase D4 of feat(partial). Active partial-contribution plan for this
  // member + this circle (driven by the migration 102 RPCs, surfaced via
  // the existing useActivePlan hook which queries partial_contribution_plans
  // directly — that read is clean against prod schema).
  const {
    plan: partialPlan,
    hasPlan: hasPartialPlan,
    catchUpProgress: partialProgress,
    nextCatchUpDate: partialNextDue,
    remainingAmount: partialRemaining,
  } = useActivePlan(user?.id, circleId);

  // Phase D3 of feat(circle-health). Circle health score driven by the
  // (now-fixed) compute_circle_health_score function in migration 104.
  // Initial load + realtime updates from the nightly scoring-pipeline cron.
  const {
    health: circleHealth,
    recomputing: healthRecomputing,
    recompute: recomputeHealth,
    statusVisual: healthStatusVisual,
    trendVisual: healthTrendVisual,
    scoreDelta: healthDelta,
  } = useCircleHealth(circleId);

  // Find the circle in all available sources: user circles, my circles, or browse circles
  const circle = [...circles, ...myCircles, ...browseCircles].find((c) => c.id === circleId);

  // Fetch members and activities when screen is focused or circleId changes
  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        if (!circleId) return;
        setIsLoadingMembers(true);
        setIsLoadingActivities(true);
        try {
          const [fetchedMembers, fetchedActivities] = await Promise.all([
            getCircleMembers(circleId),
            getCircleActivities(circleId),
          ]);
          setMembers(fetchedMembers);
          setActivities(fetchedActivities);
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setIsLoadingMembers(false);
          setIsLoadingActivities(false);
        }
      };

      fetchData();
      // Also refresh circles to get updated member count
      refreshCircles();
    }, [circleId])
  );

  if (!circle) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("circle_detail.not_found_header")}</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.errorText}>{t("circle_detail.not_found_body")}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>{t("circle_detail.btn_go_back")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOneTime = circle.frequency === "one-time";
  const hasBeneficiary = circle.beneficiaryName;
  const totalPot = circle.amount * circle.memberCount;
  const paidMembers = members.filter((m) => m.hasPaid).length;
  const paymentProgress = members.length > 0 ? (paidMembers / members.length) * 100 : 0;

  // Check if user is a member of this circle (circle is in myCircles)
  const isMember = myCircles.some((c) => c.id === circleId);
  const spotsLeft = circle.memberCount - circle.currentMembers;
  const isFull = spotsLeft <= 0;

  // Generate invite code from circle name
  const inviteCode = circle.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) + new Date(circle.createdAt).getFullYear();

  // Menu actions
  const handleInviteMembers = async () => {
    try {
      await Share.share({
        message: `You've been invited to join ${circle.name} on TandaXn! Tap to join instantly: https://v0-tanda-xn.vercel.app/join/${inviteCode}`,
        title: `Join ${circle.name}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleGroupChat = () => {
    navigation.navigate("GroupChat", { circleId: circle.id, circleName: circle.name });
  };

  const handleEditCircle = () => {
    setShowMenu(false);
    Alert.alert(
      "Edit Circle",
      "What would you like to edit?",
      [
        { text: t("circle_detail.alert_change_name_title"), onPress: () => Alert.alert(t("circle_detail.alert_coming_soon_title"), t("circle_detail.alert_coming_soon_name")) },
        { text: t("circle_detail.alert_change_emoji_title"), onPress: () => Alert.alert(t("circle_detail.alert_coming_soon_title"), t("circle_detail.alert_coming_soon_emoji")) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleCircleSettings = () => {
    setShowMenu(false);
    navigation.navigate("AdminSettings" as any, { circleName: circle?.name || "", circleId });
  };

  const handleLeaveCircle = () => {
    setShowMenu(false);
    navigation.navigate("LeaveCircle" as any, {
      circleName: circle.name,
      circleId,
      memberPosition: circle.myPosition || 1,
      totalMembers: circle.memberCount,
      currentCycle: circle.currentCycle || 1,
      totalCycles: circle.memberCount,
      hasReceivedPayout: false,
    });
  };

  // Phase D2 of feat(position-swap) #18. PositionSwapScreen was registered
  // in CirclesStack but had no navigation entry point — entirely orphan
  // despite the entire backend (14 RPCs + cron + EF) being deployed and
  // ready. This menu item makes the lifecycle reachable.
  const handleSwapPosition = () => {
    setShowMenu(false);
    navigation.navigate("PositionSwap" as any, { circleId });
  };

  // Determine user's role in this circle
  const getUserRole = (): UserRole => {
    // Check if user is the creator (admin)
    if (circle.createdBy === user?.id) return "admin";

    // Check members for admin/elder status
    const currentUserMember = members.find(m => m.isCurrentUser);
    if (currentUserMember?.role === "creator" || currentUserMember?.role === "admin") return "admin";
    if (currentUserMember?.role === "elder") return "elder";

    return "member";
  };

  const userRole = getUserRole();
  const isAdmin = userRole === "admin";
  const isElder = userRole === "elder";

  // === ALL USERS Menu Handlers ===
  const handleViewCircleRules = () => {
    setShowMenu(false);
    Alert.alert(
      "Circle Rules",
      `${circle.name} Rules:\n\n` +
      `1. Contribution: $${circle.amount} ${getFrequencyLabel(circle.frequency).toLowerCase()}\n` +
      `2. Grace Period: ${circle.gracePeriodDays} day(s)\n` +
      `3. Payout Order: ${getRotationMethodLabel(circle.rotationMethod)}\n` +
      `4. Members: ${circle.memberCount} total\n\n` +
      `Late payments may affect your XnScore and standing in the circle.`,
      [{ text: "Got It" }]
    );
  };

  const handleShareCircle = async () => {
    setShowMenu(false);
    try {
      await Share.share({
        message: `You've been invited to join ${circle.name} on TandaXn! Tap to join instantly: https://v0-tanda-xn.vercel.app/join/${inviteCode}`,
        title: `Share ${circle.name}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleHelpSupport = () => {
    setShowMenu(false);
    navigation.navigate("HelpCenter" as any);
  };

  const handleReportIssue = () => {
    setShowMenu(false);
    navigation.navigate("ReportIssue" as any, { circleName: circle.name, circleId });
  };

  // === REGULAR MEMBER Menu Handlers ===
  const handlePaymentHistory = () => {
    setShowMenu(false);
    navigation.navigate("PaymentHistory" as any, { circleId });
  };

  const handlePaymentReminders = () => {
    setShowMenu(false);
    Alert.alert(
      "Payment Reminders",
      "Set up your payment reminders",
      [
        { text: t("circle_detail.alert_reminder_1d"), onPress: () => Alert.alert(t("circle_detail.alert_reminder_set_title"), t("circle_detail.alert_reminder_1d_body")) },
        { text: t("circle_detail.alert_reminder_3d"), onPress: () => Alert.alert(t("circle_detail.alert_reminder_set_title"), t("circle_detail.alert_reminder_3d_body")) },
        { text: t("circle_detail.alert_reminder_1w"), onPress: () => Alert.alert(t("circle_detail.alert_reminder_set_title"), t("circle_detail.alert_reminder_1w_body")) },
        { text: "Manage All", onPress: () => navigation.navigate("NotificationPrefs" as any) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // === ADMIN Menu Handlers ===
  const handleManageMembers = () => {
    setShowMenu(false);
    navigation.navigate("ManageMembers" as any, { circleName: circle.name, circleId });
  };

  const handlePauseCircle = () => {
    setShowMenu(false);
    navigation.navigate("PauseCircle" as any, {
      circleName: circle.name,
      circleId,
      currentCycle: circle.currentCycle || 1,
      totalCycles: circle.memberCount,
      memberCount: circle.currentMembers,
    });
  };

  const handleCloseCircle = () => {
    setShowMenu(false);
    navigation.navigate("CloseCircle" as any, {
      circleName: circle.name,
      circleId,
      currentCycle: circle.currentCycle || 1,
      totalCycles: circle.memberCount,
      memberCount: circle.currentMembers,
      totalContributed: circle.amount * circle.currentMembers * (circle.currentCycle || 1),
      outstandingPayouts: circle.memberCount - (circle.currentCycle || 1),
    });
  };

  const handleExportData = () => {
    setShowMenu(false);
    navigation.navigate("ExportData" as any, { circleName: circle.name, circleId });
  };

  const handleAdminSettings = () => {
    setShowMenu(false);
    navigation.navigate("AdminSettings" as any, { circleName: circle.name, circleId });
  };

  // === ELDER Menu Handlers ===
  const handleOversightDashboard = () => {
    setShowMenu(false);
    navigation.navigate("OversightDashboard" as any, { circleName: circle.name, circleId });
  };

  const handleMediationTools = () => {
    setShowMenu(false);
    navigation.navigate("MediationTools" as any, { circleName: circle.name, circleId });
  };

  const handleAuditTrail = () => {
    setShowMenu(false);
    navigation.navigate("AuditTrail" as any, { circleName: circle.name, circleId });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getNextPayoutDate = () => {
    const start = new Date(circle.startDate);
    const now = new Date();
    let next = new Date(start);

    while (next <= now) {
      switch (circle.frequency) {
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "biweekly":
          next.setDate(next.getDate() + 14);
          break;
        case "monthly":
          next.setMonth(next.getMonth() + 1);
          break;
        default:
          return start;
      }
    }
    return next;
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("circle_detail.stat_contribution")}</Text>
          <Text style={styles.statValue}>${circle.amount}</Text>
          <Text style={styles.statSubtext}>per {isOneTime ? "member" : getFrequencyLabel(circle.frequency).toLowerCase()}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("circle_detail.stat_total_pot")}</Text>
          <Text style={[styles.statValue, { color: "#00C6AE" }]}>${totalPot.toLocaleString()}</Text>
          <Text style={styles.statSubtext}>{circle.memberCount} members</Text>
        </View>
      </View>

      {/* Reputation Card — Step 4 of feat(circle-reputation) #14.
          Always renders. Shows the score (0–100) with tiered color, a
          short interpretation, and the premium benefits unlocked when
          score >= 80. For a brand-new circle with score=0 (no
          inheritance, no completion), shows a "building trust"
          placeholder so the user knows the slot exists. */}
      {(() => {
        const score = circle.reputationScore ?? 0;
        let tier: {
          label: string;
          color: string;
          bg: string;
          summary: string;
        };
        if (score >= 90) {
          tier = {
            label: "ELITE",
            color: "#B45309",
            bg: "#FEF3C7",
            summary: "Elite reputation — premium benefits unlocked.",
          };
        } else if (score >= 70) {
          tier = {
            label: "EXCELLENT",
            color: "#065F46",
            bg: "#D1FAE5",
            summary:
              score >= 80
                ? "Excellent reputation — qualifies for premium benefits."
                : "Excellent reputation — almost qualifying for premium benefits.",
          };
        } else if (score >= 40) {
          tier = {
            label: "BUILDING",
            color: "#92400E",
            bg: "#FEF3C7",
            summary: "Building trust — keep contributing on time.",
          };
        } else if (score > 0) {
          tier = {
            label: "AT RISK",
            color: "#991B1B",
            bg: "#FEE2E2",
            summary: "Reputation at risk — defaults are eroding trust.",
          };
        } else {
          tier = {
            label: "NEW",
            color: "#374151",
            bg: "#F3F4F6",
            summary:
              "Building trust — complete this circle to earn a reputation score.",
          };
        }
        return (
          <View
            style={[styles.repCard, { borderLeftColor: tier.color }]}
          >
            <View style={styles.repHeader}>
              <View>
                <View
                  style={[styles.repBadge, { backgroundColor: tier.bg }]}
                >
                  <Text style={[styles.repBadgeLabel, { color: tier.color }]}>
                    REPUTATION · {tier.label}
                  </Text>
                </View>
                <Text style={styles.repCardTitle}>{t("circle_detail.rep_card_title")}</Text>
              </View>
              <View style={styles.repScoreBox}>
                <Text style={[styles.repScore, { color: tier.color }]}>
                  {Math.round(score)}
                </Text>
                <Text style={styles.repScoreOver}>/100</Text>
              </View>
            </View>

            <View style={styles.repScoreBar}>
              <View
                style={[
                  styles.repScoreBarFill,
                  {
                    width: `${Math.max(0, Math.min(100, score))}%`,
                    backgroundColor: tier.color,
                  },
                ]}
              />
            </View>

            <Text style={styles.repSummary}>{tier.summary}</Text>

            {score >= 80 && (
              <View style={styles.repBenefitsBlock}>
                <View style={styles.repBenefitRow}>
                  <Ionicons name="trending-down" size={14} color="#065F46" />
                  <Text style={styles.repBenefitText}>
                    0.5% lower insurance fee
                  </Text>
                </View>
                <View style={styles.repBenefitRow}>
                  <Ionicons name="trending-up" size={14} color="#065F46" />
                  <Text style={styles.repBenefitText}>
                    90% advance limit (instead of 80%)
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* Circle Health Card — Phase D3 of feat(circle-health).
          Renders once the scoring pipeline has populated a score for
          this circle (one row in circle_health_scores per circle, kept
          fresh nightly by scoring-pipeline-daily cron). Shows status
          badge, score, trend, 4 component bars, and a Refresh button
          calling the recompute_circle_health RPC. */}
      {circleHealth && healthStatusVisual && (
        <View
          style={[
            styles.healthCard,
            { borderLeftColor: healthStatusVisual.color },
          ]}
        >
          <View style={styles.healthHeader}>
            <View
              style={[
                styles.healthBadge,
                { backgroundColor: healthStatusVisual.bg },
              ]}
            >
              <Text style={styles.healthBadgeEmoji}>{healthStatusVisual.emoji}</Text>
              <Text
                style={[styles.healthBadgeLabel, { color: healthStatusVisual.color }]}
              >
                {healthStatusVisual.label}
              </Text>
            </View>
            <View style={styles.healthScoreBox}>
              <Text
                style={[styles.healthScore, { color: healthStatusVisual.color }]}
              >
                {Math.round(circleHealth.health_score)}
              </Text>
              <Text style={styles.healthScoreOver}>/100</Text>
            </View>
          </View>

          <View style={styles.healthScoreBar}>
            <View
              style={[
                styles.healthScoreBarFill,
                {
                  width: `${Math.max(0, Math.min(100, circleHealth.health_score))}%`,
                  backgroundColor: healthStatusVisual.color,
                },
              ]}
            />
          </View>

          {healthTrendVisual && (
            <View style={styles.healthTrendRow}>
              <Text style={styles.healthTrendEmoji}>{healthTrendVisual.emoji}</Text>
              <Text style={[styles.healthTrendLabel, { color: healthTrendVisual.color }]}>
                {healthTrendVisual.label}
              </Text>
              {healthDelta !== null && healthDelta !== 0 && (
                <Text style={styles.healthDelta}>
                  {healthDelta > 0 ? "+" : ""}
                  {healthDelta.toFixed(1)} from last run
                </Text>
              )}
            </View>
          )}

          <View style={styles.healthGrid}>
            {[
              {
                label: "Contribution",
                value: circleHealth.contribution_reliability_score,
              },
              {
                label: "Member Quality",
                value: circleHealth.member_quality_score,
              },
              {
                label: "Financial Stability",
                value: circleHealth.financial_stability_score,
              },
              {
                label: "Social Cohesion",
                value: circleHealth.social_cohesion_score,
              },
            ].map((c) => (
              <View key={c.label} style={styles.healthGridItem}>
                <Text style={styles.healthGridLabel}>{c.label}</Text>
                <View style={styles.healthGridBarBg}>
                  <View
                    style={[
                      styles.healthGridBarFill,
                      {
                        width: `${Math.max(0, Math.min(100, c.value))}%`,
                        backgroundColor: healthStatusVisual.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.healthGridValue}>{Math.round(c.value)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.healthFooter}>
            <Text style={styles.healthFooterText}>
              Updated {formatDate(circleHealth.last_computed_at)}
            </Text>
            <TouchableOpacity
              style={styles.healthRefresh}
              onPress={recomputeHealth}
              disabled={healthRecomputing}
              accessibilityRole="button"
              accessibilityLabel="Refresh circle health score"
            >
              {healthRecomputing ? (
                <Ionicons name="refresh" size={14} color="#6B7280" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={14} color="#2563EB" />
                  <Text style={styles.healthRefreshText}>{t("circle_detail.health_refresh")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Active Partial Plan Card — Phase D4 of feat(partial).
          Renders only when the current user has an active partial-
          contribution plan for this circle. Real entry point for plan
          management — no debug-only guard. Tapping "View plan details"
          navigates to PartialContributionScreen, which resolves the
          active cycle from circle_cycles when cycleId is omitted. */}
      {isMember && hasPartialPlan && partialPlan && (
        <View style={styles.partialPlanCard}>
          <View style={styles.partialPlanHeader}>
            <View style={styles.partialPlanIcon}>
              <Ionicons name="calendar-outline" size={20} color="#00C6AE" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partialPlanBadge}>{t("circle_detail.partial_plan_badge")}</Text>
              <Text style={styles.partialPlanTitle}>
                ${partialRemaining.toFixed(2)} remaining
              </Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${partialProgress.percentage}%`, backgroundColor: "#00C6AE" },
              ]}
            />
          </View>
          <View style={styles.partialPlanProgressRow}>
            <Text style={styles.partialPlanProgressLabel}>
              {partialProgress.paid} of {partialProgress.total} catch-ups paid
            </Text>
            <Text style={styles.partialPlanProgressPct}>
              {partialProgress.percentage}%
            </Text>
          </View>

          {partialNextDue && (
            <View style={styles.partialPlanNextRow}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.partialPlanNextText}>
                Next catch-up due {partialNextDue}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.partialPlanButton}
            onPress={() =>
              navigation.navigate("PartialContribution", {
                circleId,
                cycleId: partialPlan.cycleId,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="View Flexible Payment plan details"
          >
            <Text style={styles.partialPlanButtonText}>{t("circle_detail.partial_plan_btn")}</Text>
            <Ionicons name="arrow-forward" size={14} color="#00C6AE" />
          </TouchableOpacity>
        </View>
      )}

      {/* Payment Progress */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("circle_detail.card_current_status")}</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${paymentProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {paidMembers} of {members.length} members have paid
          </Text>
        </View>

        {paymentProgress < 100 && (
          <View style={styles.paymentAlert}>
            <Ionicons name="time-outline" size={18} color="#D97706" />
            <Text style={styles.paymentAlertText}>
              Waiting for {members.length - paidMembers} more payments
            </Text>
          </View>
        )}
      </View>

      {/* Beneficiary Info */}
      {hasBeneficiary && (
        <View style={styles.beneficiaryCard}>
          <View style={styles.beneficiaryIcon}>
            <Ionicons name="person-circle" size={32} color="#00C6AE" />
          </View>
          <View style={styles.beneficiaryInfo}>
            <Text style={styles.beneficiaryLabel}>{t("circle_detail.beneficiary_label")}</Text>
            <Text style={styles.beneficiaryName}>{circle.beneficiaryName}</Text>
            {circle.beneficiaryReason && (
              <Text style={styles.beneficiaryReason}>{circle.beneficiaryReason}</Text>
            )}
          </View>
          <Text style={styles.beneficiaryAmount}>${totalPot.toLocaleString()}</Text>
        </View>
      )}

      {/* Circle Details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("circle_detail.card_circle_details")}</Text>

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
          </View>
          <Text style={styles.detailLabel}>{t("circle_detail.detail_start_date")}</Text>
          <Text style={styles.detailValue}>{formatDate(circle.startDate)}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="repeat-outline" size={18} color="#6B7280" />
          </View>
          <Text style={styles.detailLabel}>{t("circle_detail.detail_frequency")}</Text>
          <Text style={styles.detailValue}>{getFrequencyLabel(circle.frequency)}</Text>
        </View>

        {!isOneTime && !hasBeneficiary && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="shuffle-outline" size={18} color="#6B7280" />
            </View>
            <Text style={styles.detailLabel}>{t("circle_detail.detail_payout_order")}</Text>
            <Text style={styles.detailValue}>{getRotationMethodLabel(circle.rotationMethod)}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="time-outline" size={18} color="#6B7280" />
          </View>
          <Text style={styles.detailLabel}>{t("circle_detail.detail_grace_period")}</Text>
          <Text style={styles.detailValue}>
            {circle.gracePeriodDays === 0 ? "None" : `${circle.gracePeriodDays} day${circle.gracePeriodDays > 1 ? "s" : ""}`}
          </Text>
        </View>

        {!isOneTime && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="cash-outline" size={18} color="#6B7280" />
            </View>
            <Text style={styles.detailLabel}>{t("circle_detail.detail_next_payout")}</Text>
            <Text style={[styles.detailValue, { color: "#00C6AE" }]}>
              {formatDate(getNextPayoutDate().toISOString())}
            </Text>
          </View>
        )}

        {circle.myPosition && !isOneTime && !hasBeneficiary && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="trophy-outline" size={18} color="#6B7280" />
            </View>
            <Text style={styles.detailLabel}>{t("circle_detail.detail_your_position")}</Text>
            <Text style={[styles.detailValue, { color: "#00C6AE", fontWeight: "700" }]}>
              #{circle.myPosition}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("MakeContribution", { circleId })}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#F0FDFB" }]}>
            <Ionicons name="wallet-outline" size={22} color="#00C6AE" />
          </View>
          <Text style={styles.actionText}>{t("circle_detail.action_make_payment")}</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleInviteMembers}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#EEF2FF" }]}>
            <Ionicons name="share-social-outline" size={22} color="#6366F1" />
          </View>
          <Text style={styles.actionText}>{t("circle_detail.action_invite_members")}</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleGroupChat}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="chatbubbles-outline" size={22} color="#D97706" />
          </View>
          <Text style={styles.actionText}>{t("circle_detail.action_group_chat")}</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMembersTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>
        {members.length} Member{members.length !== 1 ? "s" : ""}
      </Text>

      {isLoadingMembers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.loadingText}>{t("circle_detail.loading_members")}</Text>
        </View>
      ) : members.length === 0 ? (
        <View style={styles.emptyMembersContainer}>
          <Ionicons name="people-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyMembersText}>{t("circle_detail.empty_no_members")}</Text>
        </View>
      ) : (
        members.map((member) => {
          const isAdmin = member.role === "creator" || member.role === "admin";
          const isElder = member.role === "elder";

          return (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="star" size={10} color="#FFFFFF" />
                  </View>
                )}
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>
                    {member.isCurrentUser ? "You" : member.name}
                  </Text>
                  {isAdmin && (
                    <View style={styles.adminTag}>
                      <Text style={styles.adminTagText}>
                        {member.role === "creator" ? "Creator" : "Admin"}
                      </Text>
                    </View>
                  )}
                  {isElder && (
                    <View style={[styles.adminTag, { backgroundColor: "#EEF2FF" }]}>
                      <Text style={[styles.adminTagText, { color: "#6366F1" }]}>{t("circle_detail.tag_elder")}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberPhone}>{member.phone || member.email || "No contact info"}</Text>
              </View>

              <View style={styles.memberRight}>
                <View style={styles.xnScoreBadge}>
                  <Text style={styles.xnScoreText}>{member.xnScore}</Text>
                </View>
                {!hasBeneficiary && !isOneTime && member.position > 0 && (
                  <Text style={styles.positionText}>#{member.position}</Text>
                )}
                {member.hasPaid ? (
                  <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                ) : (
                  <Ionicons name="time-outline" size={20} color="#D97706" />
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  // Helper to format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case "contribution": return "wallet";
      case "payout": return "cash-outline";
      case "joined": return "person-add";
      case "created": return "add-circle";
      case "left": return "exit-outline";
      default: return "ellipse";
    }
  };

  const getActivityColor = (type: string): { bg: string; icon: string } => {
    switch (type) {
      case "contribution": return { bg: "#F0FDFB", icon: "#00C6AE" };
      case "payout": return { bg: "#D1FAE5", icon: "#10B981" };
      case "joined": return { bg: "#EEF2FF", icon: "#6366F1" };
      case "created": return { bg: "#FEF3C7", icon: "#D97706" };
      case "left": return { bg: "#FEE2E2", icon: "#DC2626" };
      default: return { bg: "#F3F4F6", icon: "#6B7280" };
    }
  };

  const renderActivityTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{t("circle_detail.section_recent_activity")}</Text>

      {isLoadingActivities ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#00C6AE" />
          <Text style={styles.loadingText}>{t("circle_detail.loading_activities")}</Text>
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyActivities}>
          <Ionicons name="time-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyActivitiesText}>{t("circle_detail.empty_no_activity")}</Text>
          <Text style={styles.emptyActivitiesSubtext}>
            Activity will appear here once members start contributing
          </Text>
        </View>
      ) : (
        activities.map((activity) => {
          const colors = getActivityColor(activity.type);
          return (
            <View key={activity.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: colors.bg }]}>
                <Ionicons
                  name={getActivityIcon(activity.type) as any}
                  size={18}
                  color={colors.icon}
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  {activity.type === "contribution" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> contributed{" "}
                      <Text style={styles.activityBold}>${activity.amount?.toLocaleString()}</Text>
                    </>
                  )}
                  {activity.type === "payout" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> received payout of{" "}
                      <Text style={styles.activityBold}>${activity.amount?.toLocaleString()}</Text>
                    </>
                  )}
                  {activity.type === "joined" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> joined the circle
                    </>
                  )}
                  {activity.type === "created" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> created this circle
                    </>
                  )}
                  {activity.type === "left" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> left the circle
                    </>
                  )}
                </Text>
                <Text style={styles.activityTime}>{formatRelativeTime(activity.timestamp)}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => setShowMenu(true)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Circle Info */}
          <View style={styles.circleInfo}>
            <View style={styles.circleIconContainer}>
              <Text style={styles.circleEmoji}>{circle.emoji}</Text>
            </View>
            <Text style={styles.circleName}>{circle.name}</Text>
            <View style={styles.circleTypeBadge}>
              <Text style={styles.circleTypeText}>{getCircleTypeLabel(circle.type)}</Text>
            </View>
            {circle.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#00C6AE" />
                <Text style={styles.verifiedText}>{t("circle_detail.tag_verified")}</Text>
              </View>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {(["overview", "members", "activity"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* Tab Content */}
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "members" && renderMembersTab()}
        {activeTab === "activity" && renderActivityTab()}
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomBar}>
        {isMember ? (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => navigation.navigate("MakeContribution", { circleId })}
          >
            <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
            <Text style={styles.payButtonText}>Contribute ${circle.amount}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.payButton, isFull && styles.payButtonDisabled]}
            onPress={() => !isFull && navigation.navigate("JoinCircleConfirm", { circleId })}
            disabled={isFull}
          >
            <Ionicons name="people" size={20} color="#FFFFFF" />
            <Text style={styles.payButtonText}>
              {isFull ? "Circle Full" : "Join Circle"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>{t("final_polish.circledetail_help")}</Text>
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.menuContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.menuHeader}>
                <View>
                  <Text style={styles.menuTitle}>{t("circle_detail.menu_title")}</Text>
                  <View style={styles.menuRoleBadge}>
                    <Ionicons
                      name={isAdmin ? "shield-checkmark" : isElder ? "eye" : "person"}
                      size={12}
                      color={isAdmin ? "#F59E0B" : isElder ? "#6366F1" : "#00C6AE"}
                    />
                    <Text style={[
                      styles.menuRoleText,
                      { color: isAdmin ? "#F59E0B" : isElder ? "#6366F1" : "#00C6AE" }
                    ]}>
                      {isAdmin ? "Admin" : isElder ? "Elder" : "Member"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowMenu(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* === ALL USERS Section === */}
              <View style={styles.menuSection}>
                <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_general")}</Text>

                <TouchableOpacity style={styles.menuItem} onPress={handleViewCircleRules}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#F0FDFB" }]}>
                    <Ionicons name="document-text-outline" size={20} color="#00C6AE" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_rules")}</Text>
                    <Text style={styles.menuItemDesc}>Terms, contributions & guidelines</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleShareCircle}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons name="share-social-outline" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_share")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_share_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setShowMenu(false);
                  navigation.navigate("QRCodeDisplay" as any, { circleId });
                }}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#F0FDFB" }]}>
                    <Ionicons name="qr-code-outline" size={20} color="#00C6AE" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_qr")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_qr_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleHelpSupport}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="help-circle-outline" size={20} color="#D97706" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Help & Support</Text>
                    <Text style={styles.menuItemDesc}>FAQs, tutorials & contact</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleReportIssue}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="flag-outline" size={20} color="#DC2626" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_report")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_report_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* === MEMBER Section === */}
              <View style={styles.menuSection}>
                <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_your_activity")}</Text>

                <TouchableOpacity style={styles.menuItem} onPress={handlePaymentHistory}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#F0FDFB" }]}>
                    <Ionicons name="receipt-outline" size={20} color="#00C6AE" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_payment_history")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_payment_history_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handlePaymentReminders}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons name="notifications-outline" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_reminders")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_reminders_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Swap Position — Phase D2 of feat(position-swap) #18.
                    Was missing for the entire engine's lifetime
                    despite full backend (14 RPCs + hourly cron + EF). */}
                <TouchableOpacity style={styles.menuItem} onPress={handleSwapPosition}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#DBEAFE" }]}>
                    <Ionicons name="swap-horizontal" size={20} color="#1D4ED8" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_swap_position")}</Text>
                    <Text style={styles.menuItemDesc}>
                      Trade your payout position with another member
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleLeaveCircle}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="exit-outline" size={20} color="#DC2626" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={[styles.menuItemText, { color: "#DC2626" }]}>{t("circle_detail.menu_leave_circle")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_leave_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* === ADMIN Section (only visible to admins) === */}
              {isAdmin && (
                <View style={styles.menuSection}>
                  <View style={styles.menuSectionHeader}>
                    <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_admin_controls")}</Text>
                    <View style={styles.adminBadgeSmall}>
                      <Ionicons name="shield-checkmark" size={10} color="#FFFFFF" />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.menuItem} onPress={handleEditCircle}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#FEF3C7" }]}>
                      <Ionicons name="create-outline" size={20} color="#D97706" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_edit_details")}</Text>
                      <Text style={styles.menuItemDesc}>Name, emoji & description</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleManageMembers}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                      <Ionicons name="people-outline" size={20} color="#6366F1" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_manage_members")}</Text>
                      <Text style={styles.menuItemDesc}>Add, remove & assign roles</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handlePauseCircle}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#FEF3C7" }]}>
                      <Ionicons name="pause-circle-outline" size={20} color="#D97706" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_pause")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_pause_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleExportData}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#F0FDFB" }]}>
                      <Ionicons name="download-outline" size={20} color="#00C6AE" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_export")}</Text>
                      <Text style={styles.menuItemDesc}>PDF, CSV & audit reports</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleAdminSettings}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#F5F7FA" }]}>
                      <Ionicons name="settings-outline" size={20} color="#6B7280" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_admin_settings")}</Text>
                      <Text style={styles.menuItemDesc}>Contributions, visibility & more</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleCloseCircle}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#FEE2E2" }]}>
                      <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={[styles.menuItemText, { color: "#DC2626" }]}>{t("circle_detail.menu_close_circle")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_close_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* === ELDER Section (only visible to elders) === */}
              {(isElder || isAdmin) && (
                <View style={styles.menuSection}>
                  <View style={styles.menuSectionHeader}>
                    <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_oversight_tools")}</Text>
                    <View style={[styles.adminBadgeSmall, { backgroundColor: "#6366F1" }]}>
                      <Ionicons name="eye" size={10} color="#FFFFFF" />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.menuItem} onPress={handleOversightDashboard}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                      <Ionicons name="analytics-outline" size={20} color="#6366F1" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_oversight_dashboard")}</Text>
                      <Text style={styles.menuItemDesc}>Circle health & compliance</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleMediationTools}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#FCE7F3" }]}>
                      <Ionicons name="hand-left-outline" size={20} color="#EC4899" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_mediation")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_mediation_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleAuditTrail}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#F0FDFB" }]}>
                      <Ionicons name="list-outline" size={20} color="#00C6AE" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_audit")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_audit_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleInfo: {
    alignItems: "center",
    paddingBottom: 20,
  },
  circleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  circleEmoji: {
    fontSize: 36,
  },
  circleName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  circleTypeBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  circleTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 4,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  tabTextActive: {
    color: "#0A2342",
  },
  tabContent: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 100,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
  },
  statSubtext: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 14,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  partialPlanCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#00C6AE",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  partialPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  partialPlanIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00C6AE15",
    justifyContent: "center",
    alignItems: "center",
  },
  partialPlanBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#00C6AE",
    letterSpacing: 0.6,
  },
  partialPlanTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginTop: 2,
  },
  partialPlanProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  partialPlanProgressLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  partialPlanProgressPct: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00C6AE",
  },
  partialPlanNextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  partialPlanNextText: {
    fontSize: 12,
    color: "#6B7280",
  },
  partialPlanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#00C6AE15",
  },
  partialPlanButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#00C6AE",
  },
  healthCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  healthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  healthBadgeEmoji: { fontSize: 14 },
  healthBadgeLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  healthScoreBox: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  healthScore: { fontSize: 28, fontWeight: "800" },
  healthScoreOver: { fontSize: 13, color: "#9CA3AF", fontWeight: "600" },
  healthScoreBar: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  healthScoreBarFill: { height: 6, borderRadius: 3 },
  healthTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  healthTrendEmoji: { fontSize: 14 },
  healthTrendLabel: { fontSize: 13, fontWeight: "700" },
  healthDelta: { fontSize: 12, color: "#6B7280", marginLeft: 4 },
  healthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  healthGridItem: { flex: 1, minWidth: "44%" },
  healthGridLabel: { fontSize: 11, color: "#6B7280", marginBottom: 4 },
  healthGridBarBg: {
    height: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 3,
  },
  healthGridBarFill: { height: 4, borderRadius: 2 },
  healthGridValue: { fontSize: 12, fontWeight: "700", color: "#1F2937" },
  healthFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  healthFooterText: { fontSize: 11, color: "#9CA3AF" },
  healthRefresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  healthRefreshText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  repCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  repHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  repBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  repBadgeLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  repCardTitle: { fontSize: 15, fontWeight: "700", color: "#0A2342" },
  repScoreBox: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  repScore: { fontSize: 32, fontWeight: "800" },
  repScoreOver: { fontSize: 13, color: "#9CA3AF", fontWeight: "600" },
  repScoreBar: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  repScoreBarFill: { height: 6, borderRadius: 3 },
  repSummary: { fontSize: 13, color: "#374151", lineHeight: 18 },
  repBenefitsBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 6,
  },
  repBenefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  repBenefitText: { fontSize: 12, color: "#065F46", fontWeight: "600" },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
  },
  paymentAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
  },
  paymentAlertText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
  },
  beneficiaryCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#00C6AE",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  beneficiaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  beneficiaryInfo: {
    flex: 1,
  },
  beneficiaryLabel: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginTop: 2,
  },
  beneficiaryReason: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  beneficiaryAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  actionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  emptyMembersContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyMembersText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0A2342",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  adminBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  adminTag: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  adminTagText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#92400E",
  },
  memberPhone: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  memberRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  xnScoreBadge: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  xnScoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00C6AE",
  },
  positionText: {
    fontSize: 11,
    color: "#6B7280",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  activityBold: {
    fontWeight: "600",
    color: "#0A2342",
  },
  activityTime: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  emptyActivities: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyActivitiesText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptyActivitiesSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  payButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  errorButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#0A2342",
    borderRadius: 10,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Menu Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  menuRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  menuRoleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  menuSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  adminBadgeSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingLeft: 4,
    gap: 12,
    marginBottom: 4,
    borderRadius: 12,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  menuItemDesc: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
    marginVertical: 8,
  },
  floatingHelp: {
    position: "absolute",
    bottom: 100,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
