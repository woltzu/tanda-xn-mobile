import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Image,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useElder } from "../context/ElderContext";
import { usePendingElderRequests } from "../hooks/useCommunityJoinRequests";
import { useElderCommunities } from "../hooks/useElderCommunities";
import { showToast } from "../components/Toast";

// Compact relative-time formatter. No date library needed.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Conflict P1 (2026-06-12): first-visit coach mark flag. One-shot.
const COACH_MARK_KEY = "@tandaxn_elder_dashboard_seen_v1";

type RootStackParamList = {
  ElderDashboard: undefined;
  ElderOverview: undefined;
  BecomeElder: undefined;
  HonorScoreOverview: undefined;
  VouchSystem: undefined;
  MediationCase: undefined;
  ElderTrainingHub: undefined;
  ConflictCase: { caseId?: string; circleId?: string; circleName?: string } | undefined;
  ElderOnboarding: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ElderDashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  // Conflict P1 — first-visit coach mark. Loads the one-shot flag on mount
  // and surfaces a 2-slide modal explaining "what an elder does" and "your
  // three actions". Reading is synchronous against AsyncStorage, but the
  // initial state defaults to hidden so we never flash the modal before the
  // disk read returns.
  const [coachMarkVisible, setCoachMarkVisible] = useState(false);
  const [coachMarkSlide, setCoachMarkSlide] = useState<0 | 1>(0);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(COACH_MARK_KEY).then((v) => {
      if (!cancelled && v !== "1") setCoachMarkVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissCoachMark = () => {
    setCoachMarkVisible(false);
    AsyncStorage.setItem(COACH_MARK_KEY, "1").catch(() => {});
  };

  const {
    isElder,
    elderProfile,
    elderStats,
    vouchRequests,
    myCases,
    getHonorScoreTier,
    getElderTierInfo,
    submitRuling,
    escalateCase,
  } = useElder();

  // Phase 4 — pending community join requests where the caller is an
  // active elder or owner. Hook uses mig 345 RLS to gate visibility
  // server-side; here we only need to render + wire approve/reject.
  const {
    pending: pendingJoinRequests,
    loading: joinRequestsLoading,
    approve: approveJoinRequest,
    reject: rejectJoinRequest,
  } = usePendingElderRequests();

  // Phase 8 — cross-community elder view entry-point. Only render the
  // card when the caller actually elders at least one community.
  const { communities: elderCommunities } = useElderCommunities();
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const handleApproveJoinRequest = async (id: string) => {
    if (busyRequestId) return;
    setBusyRequestId(id);
    const r = await approveJoinRequest(id);
    setBusyRequestId(null);
    if (r.success) showToast("Request approved", "success");
    else showToast(r.error ?? "Failed to approve", "error");
  };

  const handleRejectJoinRequest = (id: string) => {
    if (busyRequestId) return;
    Alert.alert(
      "Reject request?",
      "The applicant won't be notified with details. They can request again later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setBusyRequestId(id);
            const r = await rejectJoinRequest(id);
            setBusyRequestId(null);
            if (r.success) showToast("Request rejected", "success");
            else showToast(r.error ?? "Failed to reject", "error");
          },
        },
      ],
    );
  };

  // If not an elder yet, show the become elder CTA
  if (!isElder || !elderProfile || elderProfile.status !== "approved") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("elder_dashboard.header_system")}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.notElderContent}>
          <View style={styles.notElderCard}>
            <View style={styles.notElderIcon}>
              <Ionicons name="shield" size={64} color="#00C6AE" />
            </View>
            <Text style={styles.notElderTitle}>{t("elder_dashboard.not_elder_title")}</Text>
            <Text style={styles.notElderDescription}>
              Elders are trusted community members who help resolve disputes,
              vouch for new members, and maintain the integrity of our savings
              circles.
            </Text>
            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>{t("elder_dashboard.benefit_mediate")}</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>{t("elder_dashboard.benefit_vouch")}</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>{t("elder_dashboard.benefit_honor")}</Text>
              </View>
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
                <Text style={styles.benefitText}>Earn $25+ per resolved case</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.becomeElderButton}
              onPress={() => navigation.navigate("ElderOnboarding")}
            >
              <Text style={styles.becomeElderButtonText}>
                Check Eligibility
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const tierInfo = getElderTierInfo(elderProfile.tier);
  const honorTierInfo = getHonorScoreTier(elderProfile.honorScore);
  const pendingRequests = vouchRequests.length;
  const activeCases = myCases.filter(
    (c) => c.status === "assigned" || c.status === "in_progress"
  ).length;

  // P2 (migration 161) — batch resolution mode. When "select" is on,
  // each active case becomes a checkbox row; the sticky action bar
  // appears once at least one is selected. Actions loop over the
  // existing ElderContext primitives.
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const activeMyCases = myCases.filter(
    (c) => c.status === "assigned" || c.status === "in_progress" || c.status === "open",
  );
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => {
    setSelectedIds(new Set());
    setBatchMode(false);
  };
  const runBatch = async (action: "resolve" | "warn" | "escalate") => {
    if (batchBusy || selectedIds.size === 0) return;
    setBatchBusy(true);
    try {
      for (const id of selectedIds) {
        if (action === "resolve") {
          await submitRuling(
            id,
            t("conflict_p2.batch_resolve_ruling"),
            t("conflict_p2.batch_resolve_explanation"),
          );
        } else if (action === "escalate") {
          await escalateCase(id, t("conflict_p2.batch_escalate_reason"));
        } else {
          // 'warn' has no first-class context method yet — leave a
          // TODO and just close the selection. The migration-160
          // moderation_actions table is the future home for elder
          // warnings.
          console.warn("[batch] warn action not yet wired for case", id);
        }
      }
      clearSelection();
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("elder_dashboard.header_dashboard")}</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate("ElderOnboarding")}
        >
          <Ionicons name="settings-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Elder Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.elderInfo}>
              <Text style={styles.elderTierIcon}>{tierInfo.icon}</Text>
              <View>
                <Text style={styles.elderTierLabel}>{elderProfile.tier} Elder</Text>
                <Text style={styles.memberSince}>
                  Since {elderProfile.joinedAsElderDate}
                </Text>
              </View>
            </View>
            <View style={styles.scoreDisplay}>
              <Text
                style={[styles.honorScore, { color: honorTierInfo.color }]}
              >
                {elderProfile.honorScore}
              </Text>
              <Text style={styles.honorLabel}>{t("elder_dashboard.honor_label")}</Text>
            </View>
          </View>

          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {elderProfile.totalCasesResolved}
              </Text>
              <Text style={styles.quickStatLabel}>{t("elder_dashboard.stat_cases")}</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {elderProfile.successRate}%
              </Text>
              <Text style={styles.quickStatLabel}>{t("elder_dashboard.stat_success")}</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {elderStats?.successfulVouches || 0}
              </Text>
              <Text style={styles.quickStatLabel}>{t("elder_dashboard.stat_vouches")}</Text>
            </View>
          </View>
        </View>

        {/* Action Items */}
        {(pendingRequests > 0 || activeCases > 0) && (
          <View style={styles.actionItems}>
            {pendingRequests > 0 && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => navigation.navigate("VouchSystem")}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="hand-right" size={20} color="#7C3AED" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>
                    {pendingRequests} Vouch Request{pendingRequests > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.actionSubtitle}>{t("elder_dashboard.action_waiting_review")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
            {activeCases > 0 && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => navigation.navigate("ConflictCase")}
              >
                <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#D97706" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>
                    {activeCases} Active Case{activeCases > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.actionSubtitle}>{t("elder_dashboard.action_awaiting")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Phase 8 — Elder Overview entry-point. Only rendered when
            the caller elders at least one community. Card summarizes
            the count and jumps into the dedicated cross-community
            view. */}
        {elderCommunities.length > 0 ? (
          <View style={styles.overviewSection}>
            <TouchableOpacity
              style={styles.overviewCard}
              onPress={() => navigation.navigate("ElderOverview")}
              accessibilityRole="button"
              accessibilityLabel="Open Elder Overview"
            >
              <View style={styles.overviewIconWrap}>
                <Ionicons name="grid-outline" size={22} color="#00C6AE" />
              </View>
              <View style={styles.overviewBody}>
                <Text style={styles.overviewTitle}>Elder Overview</Text>
                <Text style={styles.overviewSubtitle}>
                  {elderCommunities.length}{" "}
                  {elderCommunities.length === 1
                    ? "community"
                    : "communities"}
                  {" · "}
                  {elderCommunities.reduce(
                    (a, c) => a + c.pendingRequestsCount,
                    0,
                  )}{" "}
                  pending
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Phase 4 — Pending community join requests. Elders/owners see
            the queue for every community where they have that role. RLS
            filters server-side. Empty state stays visible so elders
            know the surface exists once the queue drains. */}
        <View style={styles.joinRequestsSection}>
          <Text style={styles.sectionTitle}>Pending Join Requests</Text>
          {joinRequestsLoading ? (
            <View style={styles.joinRequestsEmpty}>
              <Text style={styles.joinRequestsEmptyText}>Loading…</Text>
            </View>
          ) : pendingJoinRequests.length === 0 ? (
            <View style={styles.joinRequestsEmpty}>
              <Ionicons name="mail-open-outline" size={22} color="#9CA3AF" />
              <Text style={styles.joinRequestsEmptyText}>
                No pending join requests
              </Text>
            </View>
          ) : (
            <View style={styles.joinRequestsList}>
              {pendingJoinRequests.map((req) => {
                const displayName =
                  req.applicant?.full_name?.trim() || "Someone";
                const origin =
                  [req.applicant?.city_of_origin, req.applicant?.country_of_origin]
                    .filter(Boolean)
                    .join(", ") || null;
                const isBusy = busyRequestId === req.id;
                return (
                  <View key={req.id} style={styles.joinRequestCard}>
                    <View style={styles.joinRequestHeader}>
                      {req.applicant?.avatar_url ? (
                        <Image
                          source={{ uri: req.applicant.avatar_url }}
                          style={styles.joinRequestAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.joinRequestAvatar,
                            styles.joinRequestAvatarFallback,
                          ]}
                        >
                          <Text style={styles.joinRequestAvatarInitial}>
                            {displayName[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.joinRequestBody}>
                        <Text style={styles.joinRequestName} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <Text style={styles.joinRequestMeta} numberOfLines={1}>
                          wants to join{" "}
                          {req.community?.name ?? "a community"} ·{" "}
                          {timeAgo(req.requested_at)}
                        </Text>
                        {origin ? (
                          <Text style={styles.joinRequestOrigin} numberOfLines={1}>
                            From {origin}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {req.reason ? (
                      <Text style={styles.joinRequestReason} numberOfLines={3}>
                        "{req.reason}"
                      </Text>
                    ) : null}
                    <View style={styles.joinRequestActions}>
                      <TouchableOpacity
                        style={[styles.joinRequestRejectBtn, isBusy && styles.joinRequestBtnDisabled]}
                        onPress={() => handleRejectJoinRequest(req.id)}
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityLabel="Reject join request"
                      >
                        <Ionicons name="close" size={16} color="#DC2626" />
                        <Text style={styles.joinRequestRejectText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.joinRequestApproveBtn, isBusy && styles.joinRequestBtnDisabled]}
                        onPress={() => handleApproveJoinRequest(req.id)}
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityLabel="Approve join request"
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.joinRequestApproveText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* P2 — Batch resolution mode. Lets an elder pick multiple
            similar disputes and apply one action over the whole set.
            Hidden behind a "Select cases" toggle so the dashboard stays
            calm by default. */}
        {activeMyCases.length > 0 ? (
          <View style={styles.batchSection}>
            <View style={styles.batchHeader}>
              <Text style={styles.sectionTitle}>
                {t("conflict_p2.batch_section_title")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (batchMode) clearSelection();
                  else setBatchMode(true);
                }}
                accessibilityRole="button"
                style={styles.batchToggleBtn}
              >
                <Text style={styles.batchToggleText}>
                  {batchMode
                    ? t("conflict_p2.batch_toggle_done")
                    : t("conflict_p2.batch_toggle_select")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.batchList}>
              {activeMyCases.map((c) => {
                const checked = selectedIds.has(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.batchRow,
                      checked && styles.batchRowChecked,
                    ]}
                    onPress={() => {
                      if (batchMode) toggleSelected(c.id);
                      else
                        navigation.navigate("ConflictCase", {
                          caseId: c.id,
                        } as never);
                    }}
                    accessibilityRole={batchMode ? "checkbox" : "button"}
                    accessibilityState={
                      batchMode ? { checked } : undefined
                    }
                  >
                    {batchMode ? (
                      <Ionicons
                        name={checked ? "checkbox" : "square-outline"}
                        size={18}
                        color={checked ? "#00C6AE" : "#9CA3AF"}
                      />
                    ) : (
                      <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
                        <Ionicons name="shield-checkmark" size={16} color="#D97706" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.batchRowTitle} numberOfLines={1}>
                        {c.title || c.type}
                      </Text>
                      <Text style={styles.batchRowSub} numberOfLines={1}>
                        {c.circleName ?? ""} · {c.status}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>{t("elder_dashboard.section_actions")}</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("HonorScoreOverview")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#F0FDFB" }]}>
              <Ionicons name="trophy" size={28} color="#00C6AE" />
            </View>
            <Text style={styles.actionCardTitle}>{t("elder_dashboard.action_honor")}</Text>
            <Text style={styles.actionCardValue}>
              {elderProfile.honorScore} pts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("VouchSystem")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="hand-right" size={28} color="#7C3AED" />
            </View>
            <Text style={styles.actionCardTitle}>{t("elder_dashboard.action_vouch")}</Text>
            <Text style={styles.actionCardValue}>
              {elderStats?.vouchesAvailable || 0} available
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("ConflictCase")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="shield-checkmark" size={28} color="#D97706" />
            </View>
            <Text style={styles.actionCardTitle}>{t("elder_dashboard.action_mediation")}</Text>
            <Text style={styles.actionCardValue}>
              {elderProfile.activeCases}/{elderProfile.maxConcurrentCases} cases
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate("ElderOnboarding")}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="school" size={28} color="#3B82F6" />
            </View>
            <Text style={styles.actionCardTitle}>{t("elder_dashboard.action_training")}</Text>
            <Text style={styles.actionCardValue}>
              {elderProfile.trainingCredits} credits
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle}>{t("elder_dashboard.section_tier")}</Text>
            <TouchableOpacity onPress={() => navigation.navigate("ElderOnboarding")}>
              <Text style={styles.viewAllText}>{t("elder_dashboard.view_details")}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.tierProgressRow}>
              <View style={styles.currentTierInfo}>
                <Text style={styles.tierProgressIcon}>{tierInfo.icon}</Text>
                <Text style={styles.tierProgressLabel}>
                  {elderProfile.tier} Elder
                </Text>
              </View>
              {elderProfile.tier !== "Grand" && (
                <View style={styles.nextTierInfo}>
                  <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                  <Text style={styles.nextTierIcon}>
                    {elderProfile.tier === "Junior" ? "🌿" : "🌳"}
                  </Text>
                  <Text style={styles.nextTierLabel}>
                    {elderProfile.tier === "Junior" ? "Senior" : "Grand"}
                  </Text>
                </View>
              )}
            </View>

            {elderProfile.tier !== "Grand" && (
              <>
                <View style={styles.progressBarRow}>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(
                            100,
                            elderProfile.tier === "Junior"
                              ? (elderProfile.trainingCredits / 100) * 100
                              : (elderProfile.trainingCredits / 250) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.progressHint}>
                  {elderProfile.tier === "Junior"
                    ? `${100 - elderProfile.trainingCredits} more credits to Senior Elder`
                    : `${250 - elderProfile.trainingCredits} more credits to Grand Elder`}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* P2 — Sticky batch-action bar. Visible when at least one case
          is selected. Three primary actions cover the resolve / warn /
          escalate verbs from the spec. The "warn" path is a TODO
          (see runBatch) until ElderContext grows a warnMember primitive. */}
      {batchMode && selectedIds.size > 0 ? (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarCount}>
            {t("conflict_p2.batch_bar_count", { n: selectedIds.size })}
          </Text>
          <View style={styles.batchBarActions}>
            <TouchableOpacity
              style={styles.batchActionBtnPrimary}
              disabled={batchBusy}
              onPress={() => runBatch("resolve")}
              accessibilityRole="button"
            >
              <Text style={styles.batchActionBtnPrimaryText}>
                {t("conflict_p2.batch_action_resolve")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.batchActionBtnGhost}
              disabled={batchBusy}
              onPress={() => runBatch("warn")}
              accessibilityRole="button"
            >
              <Text style={styles.batchActionBtnGhostText}>
                {t("conflict_p2.batch_action_warn")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.batchActionBtnGhost}
              disabled={batchBusy}
              onPress={() => runBatch("escalate")}
              accessibilityRole="button"
            >
              <Text style={styles.batchActionBtnGhostText}>
                {t("conflict_p2.batch_action_escalate")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Conflict P1 — first-visit coach mark. Two slides: what an elder
          does, then your three actions. AsyncStorage flag keeps it one-shot. */}
      <Modal
        visible={coachMarkVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissCoachMark}
      >
        <View style={styles.coachOverlay}>
          <View style={styles.coachCard}>
            <View style={styles.coachIconWrap}>
              <Ionicons
                name={coachMarkSlide === 0 ? "shield-checkmark" : "compass"}
                size={32}
                color="#00C6AE"
              />
            </View>
            <Text style={styles.coachTitle}>
              {t(
                coachMarkSlide === 0
                  ? "elder_dashboard.coach_slide1_title"
                  : "elder_dashboard.coach_slide2_title",
              )}
            </Text>
            <Text style={styles.coachBody}>
              {t(
                coachMarkSlide === 0
                  ? "elder_dashboard.coach_slide1_body"
                  : "elder_dashboard.coach_slide2_body",
              )}
            </Text>
            <View style={styles.coachDots}>
              <View
                style={[
                  styles.coachDot,
                  coachMarkSlide === 0 && styles.coachDotActive,
                ]}
              />
              <View
                style={[
                  styles.coachDot,
                  coachMarkSlide === 1 && styles.coachDotActive,
                ]}
              />
            </View>
            <TouchableOpacity
              style={styles.coachCta}
              onPress={() =>
                coachMarkSlide === 0
                  ? setCoachMarkSlide(1)
                  : dismissCoachMark()
              }
              accessibilityRole="button"
            >
              <Text style={styles.coachCtaText}>
                {t(
                  coachMarkSlide === 0
                    ? "elder_dashboard.coach_next"
                    : "elder_dashboard.coach_got_it",
                )}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={dismissCoachMark}
              accessibilityRole="button"
            >
              <Text style={styles.coachSkip}>
                {t("elder_dashboard.coach_skip")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  placeholder: {
    width: 32,
  },
  settingsButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  // Not Elder Styles
  notElderContent: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  notElderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  notElderIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  notElderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 12,
  },
  notElderDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  benefitsList: {
    width: "100%",
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: "#4B5563",
    marginLeft: 12,
  },
  becomeElderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
  },
  becomeElderButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginRight: 8,
  },
  // Elder Dashboard Styles
  statusCard: {
    backgroundColor: "#FFFFFF",
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  elderInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  elderTierIcon: {
    fontSize: 36,
    marginRight: 12,
  },
  elderTierLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  memberSince: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  scoreDisplay: {
    alignItems: "flex-end",
  },
  honorScore: {
    fontSize: 32,
    fontWeight: "700",
  },
  honorLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  quickStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  quickStatItem: {
    flex: 1,
    alignItems: "center",
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  quickStatLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  actionItems: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  // Phase 8 — Elder Overview entry-point
  overviewSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  overviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  overviewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  overviewBody: {
    flex: 1,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  overviewSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  // Phase 4 — Pending join request styles
  joinRequestsSection: {
    marginBottom: 20,
  },
  joinRequestsEmpty: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  joinRequestsEmptyText: {
    fontSize: 13,
    color: "#6B7280",
  },
  joinRequestsList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  joinRequestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  joinRequestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  joinRequestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  joinRequestAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  joinRequestAvatarInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4B5563",
  },
  joinRequestBody: {
    flex: 1,
  },
  joinRequestName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  joinRequestMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  joinRequestOrigin: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  joinRequestReason: {
    fontSize: 13,
    color: "#4B5563",
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 18,
  },
  joinRequestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    justifyContent: "flex-end",
  },
  joinRequestRejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  joinRequestRejectText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  joinRequestApproveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#00C6AE",
  },
  joinRequestApproveText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  joinRequestBtnDisabled: {
    opacity: 0.5,
  },
  // P2 — Batch resolution styles
  batchSection: { marginBottom: 20 },
  batchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  batchToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#0A2342",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  batchToggleText: { fontSize: 12, fontWeight: "700", color: "#0A2342" },
  batchList: { paddingHorizontal: 20, gap: 8 },
  batchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  batchRowChecked: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  batchRowTitle: { fontSize: 13, fontWeight: "700", color: "#1a1a2e" },
  batchRowSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  batchBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#0A2342",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  batchBarCount: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  batchBarActions: { flexDirection: "row", gap: 6 },
  batchActionBtnPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#00C6AE",
  },
  batchActionBtnPrimaryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  batchActionBtnGhost: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  batchActionBtnGhostText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    margin: "1%",
    alignItems: "center",
  },
  actionCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  actionCardValue: {
    fontSize: 12,
    color: "#6B7280",
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: "#00C6AE",
    fontWeight: "600",
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
  },
  tierProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  currentTierInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierProgressIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  tierProgressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  nextTierInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextTierIcon: {
    fontSize: 24,
    marginHorizontal: 8,
  },
  nextTierLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  progressBarRow: {
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  bottomPadding: {
    height: 40,
  },
  // Coach-mark overlay (Conflict P1)
  coachOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 35, 66, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  coachCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  coachIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  coachTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
    textAlign: "center",
  },
  coachBody: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  coachDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  coachDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  coachDotActive: { backgroundColor: "#00C6AE" },
  coachCta: {
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginBottom: 10,
  },
  coachCtaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  coachSkip: {
    fontSize: 12,
    color: "#6B7280",
    textDecorationLine: "underline",
  },
});
