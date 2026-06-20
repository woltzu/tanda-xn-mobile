import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal, Pressable, Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useCircleProposals, useCreateProposal, useCastVote } from "../hooks/useCircleDemocracy";
import type {
  CircleProposal,
  ProposalType,
  VoteChoice,
} from "../services/CircleDemocracyEngine";
import { Routes } from "../lib/routes";

type RouteParams = { CircleVoting: { circleId: string } };

// Bucket B — AsyncStorage gate for the first-visit coach mark. Version
// suffix lets us re-prompt every user if the copy shifts.
const VOTING_COACH_KEY = "@tandaxn_voting_coach_seen_v1";

// Bucket B — six glossary entries shown together in one scrollable
// HelpSheet, opened by the header (?) button.
type HelpTopic =
  | "what_is_proposal"
  | "who_can_create"
  | "six_types"
  | "quorum_vs_threshold"
  | "voting_period"
  | "what_happens_on_approval";

const HELP_TOPICS: HelpTopic[] = [
  "what_is_proposal",
  "who_can_create",
  "six_types",
  "quorum_vs_threshold",
  "voting_period",
  "what_happens_on_approval",
];

// Bucket B — per-pill explainer payload. The same sheet renders all three
// kinds; "type" passes through the proposal_type slug so the sheet looks
// up circle_voting.type_explainer_<key>_{title,body}.
type PillExplainer =
  | { kind: "type"; key: string }
  | { kind: "quorum" }
  | { kind: "threshold" }
  | null;

// ── Vote colour palette ─────────────────────────────────────────────────────
const VOTE_META: Record<VoteChoice, { bg: string; text: string; icon: string }> = {
  yes:     { bg: "#10B98115", text: "#10B981", icon: "thumbs-up" },
  no:      { bg: "#EF444415", text: "#EF4444", icon: "thumbs-down" },
  abstain: { bg: "#6B728015", text: "#6B7280", icon: "remove-circle-outline" },
};

// ── Status pill meta. Labels are i18n keys looked up at render time. ────────
const STATUS_META: Record<string, { color: string; icon: string; labelKey: string }> = {
  draft:     { color: "#6B7280", icon: "create-outline",          labelKey: "circle_voting.status_draft" },
  open:      { color: "#3B82F6", icon: "radio-button-on",          labelKey: "circle_voting.status_open" },
  closed:    { color: "#F59E0B", icon: "lock-closed",              labelKey: "circle_voting.status_closed" },
  executed:  { color: "#10B981", icon: "checkmark-done-circle",    labelKey: "circle_voting.status_executed" },
  cancelled: { color: "#EF4444", icon: "close-circle",             labelKey: "circle_voting.status_cancelled" },
};

// ── Bucket A: template picker. Six types ship in Bucket A; resolve_dispute +
//   pool_rollover are engine-only for now and stay out of the picker until
//   their dedicated screens (Bucket B / future) wire them up.
const PROPOSAL_TEMPLATES: {
  type: Exclude<ProposalType, "resolve_dispute" | "pool_rollover">;
  icon: keyof typeof Ionicons.glyphMap;
  isCritical: boolean;
}[] = [
  { type: "admit_member",        icon: "person-add-outline",      isCritical: false },
  { type: "remove_member",       icon: "person-remove-outline",   isCritical: true  },
  { type: "change_rules",        icon: "settings-outline",        isCritical: false },
  { type: "change_payout_order", icon: "swap-vertical-outline",   isCritical: false },
  { type: "dissolve_circle",     icon: "warning-outline",         isCritical: true  },
  { type: "custom",              icon: "create-outline",          isCritical: false },
];

type RuleKey = "contribution" | "grace_period" | "frequency";
const RULE_OPTIONS: RuleKey[] = ["contribution", "grace_period", "frequency"];

// ── Title auto-derivation per template. Custom returns null so the screen
//   falls back to the user-supplied title.
function deriveTitle(
  t: (k: string, opts?: any) => string,
  type: ProposalType,
  payload: Record<string, any>,
  customTitle: string,
): string {
  switch (type) {
    case "admit_member":
      return t("circle_voting.title_admit_member", { name: payload.member || "—" });
    case "remove_member":
      return t("circle_voting.title_remove_member", { name: payload.member || "—" });
    case "change_rules": {
      const rule = (payload.rule as RuleKey) || "contribution";
      const value = payload.value || "—";
      return t(`circle_voting.title_change_rules_${rule}`, { value });
    }
    case "change_payout_order":
      return t("circle_voting.title_change_payout_order");
    case "dissolve_circle":
      return t("circle_voting.title_dissolve_circle");
    case "custom":
    default:
      return customTitle.trim() || t("circle_voting.title_custom_fallback");
  }
}

// ── Confirm-sheet payload type ──────────────────────────────────────────────
type ConfirmVote = {
  proposalId: string;
  title: string;
  choice: VoteChoice;
  reasoning: string;
} | null;

export default function CircleVotingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "CircleVoting">>();
  const { t } = useTranslation();
  const { circleId } = route.params;

  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");

  // Bucket A — two-step create sheet.
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"type" | "form">("type");
  const [selectedType, setSelectedType] = useState<ProposalType | null>(null);
  const [formPayload, setFormPayload] = useState<Record<string, any>>({});
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  // Bucket A — vote confirm sheet.
  const [confirmVote, setConfirmVote] = useState<ConfirmVote>(null);

  // Bucket B — HelpSheet visibility + per-pill explainer payload.
  const [helpOpen, setHelpOpen] = useState(false);
  const [pillExplainer, setPillExplainer] = useState<PillExplainer>(null);

  // Bucket B — first-visit coach mark. Pattern mirrors Conflict Alerts /
  // Insurance Pool: AsyncStorage gate, animated fade-in, 4s auto-dismiss.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(VOTING_COACH_KEY);
        if (seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      } catch {
        // AsyncStorage unavailable — silently skip.
      }
    })();
  }, [coachOpacity]);
  const dismissCoach = useCallback(() => {
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(VOTING_COACH_KEY, "1").catch(() => undefined);
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  const {
    activeProposals,
    closedProposals,
    loading,
    error,
    refetch,
  } = useCircleProposals(circleId);

  const { createAndOpen, loading: creating } = useCreateProposal();
  const { castVote, loading: voting } = useCastVote();

  const proposals = activeTab === "active" ? activeProposals : closedProposals;

  // ── Create flow ──────────────────────────────────────────────────────────
  const resetCreate = useCallback(() => {
    setCreateStep("type");
    setSelectedType(null);
    setFormPayload({});
    setCustomTitle("");
    setCustomDescription("");
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    resetCreate();
  }, [resetCreate]);

  const handlePickType = useCallback((type: ProposalType) => {
    setSelectedType(type);
    setFormPayload(type === "change_rules" ? { rule: "contribution" } : {});
    setCreateStep("form");
  }, []);

  const handleSubmitCreate = useCallback(async () => {
    if (!selectedType) return;

    // Per-type minimum validation. Keep error surface compact: a single
    // Alert.alert when a required field is empty; the user already sees the
    // sheet, so a banner would be redundant.
    const missingFieldKey = validatePayload(selectedType, formPayload, customTitle);
    if (missingFieldKey) {
      Alert.alert(
        t("circle_voting.alert_error_title"),
        t("circle_voting.alert_field_required", { field: t(missingFieldKey) }),
      );
      return;
    }

    const title = deriveTitle(t, selectedType, formPayload, customTitle);
    const description = selectedType === "custom"
      ? customDescription.trim() || undefined
      : formPayload.reason || undefined;

    const result = await createAndOpen(
      circleId,
      selectedType,
      title,
      description,
      formPayload,
    );
    if (result) {
      closeCreate();
      refetch();
    } else {
      Alert.alert(
        t("circle_voting.alert_error_title"),
        t("circle_voting.alert_create_failed"),
      );
    }
  }, [selectedType, formPayload, customTitle, customDescription, circleId, createAndOpen, closeCreate, refetch, t]);

  // ── Vote flow ────────────────────────────────────────────────────────────
  const openVoteConfirm = useCallback(
    (proposal: CircleProposal, choice: VoteChoice) => {
      setConfirmVote({
        proposalId: proposal.id,
        title: proposal.title,
        choice,
        reasoning: "",
      });
    },
    [],
  );

  const executeVote = useCallback(async () => {
    if (!confirmVote) return;
    const payload = confirmVote;
    setConfirmVote(null);
    const result = await castVote(
      payload.proposalId,
      payload.choice,
      payload.reasoning.trim() || undefined,
    );
    if (result) {
      refetch();
    } else {
      Alert.alert(
        t("circle_voting.alert_error_title"),
        t("circle_voting.alert_vote_failed"),
      );
    }
  }, [confirmVote, castVote, refetch, t]);

  // ── Loading gate ─────────────────────────────────────────────────────────
  if (loading && activeProposals.length === 0 && closedProposals.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>{t("circle_voting.loading_proposals")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("circle_voting.header_title")}</Text>
          <View style={styles.headerActions}>
            {/* Bucket B — opens the HelpSheet glossary. */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setHelpOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("circle_voting.help_open")}
            >
              <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setCreateOpen(true)}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Ionicons name="radio-button-on" size={12} color="#3B82F6" />
            <Text style={styles.statText}>
              {t("circle_voting.stat_active", { count: activeProposals.length })}
            </Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="checkmark-done" size={12} color="#10B981" />
            <Text style={styles.statText}>
              {t("circle_voting.stat_completed", { count: closedProposals.length })}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "active" && styles.tabActive]}
          onPress={() => setActiveTab("active")}
        >
          <Text style={[styles.tabText, activeTab === "active" && styles.tabTextActive]}>
            {t("circle_voting.tab_active", { count: activeProposals.length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "closed" && styles.tabActive]}
          onPress={() => setActiveTab("closed")}
        >
          <Text style={[styles.tabText, activeTab === "closed" && styles.tabTextActive]}>
            {t("circle_voting.tab_completed", { count: closedProposals.length })}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {proposals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#00C6AE" />
            <Text style={styles.emptyTitle}>
              {activeTab === "active"
                ? t("circle_voting.empty_active_title")
                : t("circle_voting.empty_completed_title")}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "active"
                ? t("circle_voting.empty_active_body")
                : t("circle_voting.empty_completed_body")}
            </Text>
          </View>
        ) : (
          proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onVote={(choice) => openVoteConfirm(p, choice)}
              onExplainType={() => setPillExplainer({ kind: "type", key: p.proposalType })}
              onExplainThreshold={() => setPillExplainer({ kind: "threshold" })}
              onExplainQuorum={() => setPillExplainer({ kind: "quorum" })}
              onOpenDetail={() => navigation.navigate(Routes.ProposalDetail, { proposalId: p.id })}
              voting={voting}
            />
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create proposal sheet (Bucket A — 2-step) */}
      <CreateProposalSheet
        visible={createOpen}
        step={createStep}
        selectedType={selectedType}
        payload={formPayload}
        customTitle={customTitle}
        customDescription={customDescription}
        creating={creating}
        onPickType={handlePickType}
        onBack={() => setCreateStep("type")}
        onClose={closeCreate}
        onChangePayload={setFormPayload}
        onChangeCustomTitle={setCustomTitle}
        onChangeCustomDescription={setCustomDescription}
        onSubmit={handleSubmitCreate}
      />

      {/* Vote confirm sheet */}
      <VoteConfirmSheet
        payload={confirmVote}
        voting={voting}
        onChangeReason={(r) => setConfirmVote(confirmVote ? { ...confirmVote, reasoning: r } : null)}
        onCancel={() => setConfirmVote(null)}
        onConfirm={executeVote}
      />

      {/* Bucket B — HelpSheet + per-pill explainer sheets. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <PillExplainerSheet explainer={pillExplainer} onClose={() => setPillExplainer(null)} />

      {/* Bucket B — first-visit coach mark. */}
      {coachVisible && (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.coachCard} onPress={dismissCoach} accessibilityRole="button">
            <Ionicons name="bulb-outline" size={20} color="#00C6AE" />
            <Text style={styles.coachText}>{t("circle_voting.coach_tip")}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// ── Validation ──────────────────────────────────────────────────────────────
// Returns an i18n key identifying the missing required field, or null when
// the payload is good to submit.
function validatePayload(
  type: ProposalType,
  payload: Record<string, any>,
  customTitle: string,
): string | null {
  switch (type) {
    case "admit_member":
      return payload.member ? null : "circle_voting.field_member_email";
    case "remove_member":
      if (!payload.member) return "circle_voting.field_target_member";
      return payload.reason ? null : "circle_voting.field_reason";
    case "change_rules":
      if (!payload.rule) return "circle_voting.field_rule_to_change";
      return payload.value ? null : "circle_voting.field_new_value";
    case "change_payout_order":
      return payload.order_proposal ? null : "circle_voting.field_order_proposal";
    case "dissolve_circle":
      return payload.reason ? null : "circle_voting.field_reason";
    case "custom":
      return customTitle.trim() ? null : "circle_voting.field_custom_title";
    default:
      return null;
  }
}

// ── ProposalCard ────────────────────────────────────────────────────────────
function ProposalCard({
  proposal,
  onVote,
  onExplainType,
  onExplainThreshold,
  onExplainQuorum,
  onOpenDetail,
  voting,
}: {
  proposal: CircleProposal;
  onVote: (choice: VoteChoice) => void;
  onExplainType: () => void;
  onExplainThreshold: () => void;
  onExplainQuorum: () => void;
  onOpenDetail: () => void;
  voting: boolean;
}) {
  const { t } = useTranslation();

  const statusMeta = STATUS_META[proposal.status] || STATUS_META.draft;
  const isOpen = proposal.status === "open";
  const endsAt = proposal.votingEndsAt ? new Date(proposal.votingEndsAt) : null;
  const isExpired = endsAt ? endsAt <= new Date() : false;

  // ── Bucket A derived metrics ──────────────────────────────────────────────
  const { quorumNeeded, totalVoted, quorumLine, thresholdLabel } = useMemo(() => {
    const totalVoted = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const quorumNeeded = Math.ceil(proposal.eligibleVoters * proposal.quorumPct);
    const remaining = Math.max(0, quorumNeeded - totalVoted);
    const quorumLine = remaining === 0
      ? t("circle_voting.quorum_reached")
      : t("circle_voting.quorum_needed", { need: remaining, total: quorumNeeded });
    const pct = Math.round(proposal.thresholdPct * 100);
    const thresholdLabel = pct === 50
      ? t("circle_voting.threshold_simple_majority")
      : t("circle_voting.threshold_label", { pct });
    return { quorumNeeded, totalVoted, quorumLine, thresholdLabel };
  }, [proposal.votesFor, proposal.votesAgainst, proposal.votesAbstain, proposal.eligibleVoters, proposal.quorumPct, proposal.thresholdPct, t]);

  // Progress-bar fill: % of yes among decisive (yes+no) votes.
  const decisive = proposal.votesFor + proposal.votesAgainst;
  const yesPct = decisive > 0 ? Math.round((proposal.votesFor / decisive) * 100) : 0;

  // Result chip — only when the proposal is closed.
  const resultChip = useMemo(() => {
    if (proposal.status !== "closed" && proposal.status !== "executed") return null;
    if (proposal.result === "approved") {
      const executedLabel = proposal.executedAt
        ? t("circle_voting.result_executed")
        : t("circle_voting.result_pending_execution");
      return {
        color: "#10B981",
        bg: "#10B98115",
        icon: "checkmark-circle" as const,
        label: t("circle_voting.result_approved"),
        sub: executedLabel,
      };
    }
    if (proposal.result === "rejected") {
      const neededPct = Math.round(proposal.thresholdPct * 100);
      return {
        color: "#EF4444",
        bg: "#EF444415",
        icon: "close-circle" as const,
        label: t("circle_voting.result_rejected"),
        sub: t("circle_voting.result_reason_threshold", { pct: yesPct, needed: neededPct }),
      };
    }
    if (proposal.result === "no_quorum") {
      return {
        color: "#F59E0B",
        bg: "#F59E0B15",
        icon: "alert-circle" as const,
        label: t("circle_voting.result_no_quorum"),
        sub: t("circle_voting.result_reason_quorum", {
          voted: totalVoted,
          eligible: proposal.eligibleVoters,
        }),
      };
    }
    return null;
  }, [proposal.status, proposal.result, proposal.executedAt, proposal.thresholdPct, proposal.eligibleVoters, yesPct, totalVoted, t]);

  return (
    <View style={styles.card}>
      {/* Card body tap target — top section is wrapped in a Pressable that
          routes to the detail screen. Bucket B: enables the "tap card to
          see who voted / payload / cancel" affordance without stealing
          taps from the explicit vote buttons below. */}
      <Pressable onPress={onOpenDetail} accessibilityRole="button">
        {/* Top row */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + "15" }]}>
            <Ionicons name={statusMeta.icon as any} size={12} color={statusMeta.color} />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>
              {t(statusMeta.labelKey)}
            </Text>
          </View>
          {endsAt && (
            <Text style={styles.deadline}>
              {isExpired
                ? t("circle_voting.deadline_ended")
                : t("circle_voting.deadline_ends_at", { date: endsAt.toLocaleDateString() })}
            </Text>
          )}
        </View>

        {/* Title + description */}
        <Text style={styles.proposalTitle}>{proposal.title}</Text>
        {proposal.description && (
          <Text style={styles.proposalDesc} numberOfLines={3}>{proposal.description}</Text>
        )}
      </Pressable>

      {/* Type + threshold pills (Bucket B: tappable explainers) */}
      <View style={styles.pillRow}>
        <TouchableOpacity
          style={styles.typeBadge}
          onPress={onExplainType}
          accessibilityRole="button"
          accessibilityLabel={t("circle_voting.type_explainer_open", { label: t(`circle_voting.type_${proposal.proposalType}`) })}
        >
          <Ionicons name="document-text-outline" size={12} color="#8B5CF6" />
          <Text style={styles.typeText}>
            {t(`circle_voting.type_${proposal.proposalType}`)}
          </Text>
          <Ionicons name="help-circle-outline" size={12} color="#8B5CF6" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.thresholdBadge}
          onPress={onExplainThreshold}
          accessibilityRole="button"
          accessibilityLabel={t("circle_voting.threshold_explainer_open")}
        >
          <Ionicons name="speedometer-outline" size={12} color="#0A2342" />
          <Text style={styles.thresholdText}>{thresholdLabel}</Text>
          <Ionicons name="help-circle-outline" size={12} color="#0A2342" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      {/* Vote progress (Bucket A — votesFor/votesAgainst/votesAbstain) */}
      <View style={styles.voteProgress}>
        <View style={styles.voteRow}>
          <View style={styles.voteItem}>
            <Ionicons name="thumbs-up" size={14} color="#10B981" />
            <Text style={[styles.voteCount, { color: "#10B981" }]}>{proposal.votesFor}</Text>
          </View>
          <View style={styles.voteItem}>
            <Ionicons name="thumbs-down" size={14} color="#EF4444" />
            <Text style={[styles.voteCount, { color: "#EF4444" }]}>{proposal.votesAgainst}</Text>
          </View>
          <View style={styles.voteItem}>
            <Ionicons name="remove-circle-outline" size={14} color="#6B7280" />
            <Text style={[styles.voteCount, { color: "#6B7280" }]}>{proposal.votesAbstain}</Text>
          </View>
        </View>

        {decisive > 0 && (
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${yesPct}%` }]} />
          </View>
        )}

        {/* Bucket B: tap-explainable quorum line (small (?) keeps the row
            scannable on a list of N cards). */}
        <TouchableOpacity
          onPress={onExplainQuorum}
          accessibilityRole="button"
          accessibilityLabel={t("circle_voting.quorum_explainer_open")}
          style={styles.quorumLineRow}
        >
          <Text style={styles.quorumLine}>{quorumLine}</Text>
          <Ionicons name="help-circle-outline" size={12} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Result chip (closed proposals) */}
      {resultChip && (
        <View style={[styles.resultChip, { backgroundColor: resultChip.bg }]}>
          <Ionicons name={resultChip.icon} size={14} color={resultChip.color} />
          <Text style={[styles.resultLabel, { color: resultChip.color }]}>
            {resultChip.label} · {resultChip.sub}
          </Text>
        </View>
      )}

      {/* Vote buttons (open + not expired) */}
      {isOpen && !isExpired && (
        <View style={styles.voteButtons}>
          {(["yes", "no", "abstain"] as const).map((choice) => {
            const cfg = VOTE_META[choice];
            return (
              <TouchableOpacity
                key={choice}
                style={[styles.voteBtn, { backgroundColor: cfg.bg }]}
                onPress={() => onVote(choice)}
                disabled={voting}
              >
                <Ionicons name={cfg.icon as any} size={16} color={cfg.text} />
                <Text style={[styles.voteBtnText, { color: cfg.text }]}>
                  {t(`circle_voting.vote_${choice}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CreateProposalSheet — 2-step bottom sheet (Bucket A).
//   Step 1: pick a proposal type from 6 templates.
//   Step 2: type-specific payload form. Title is auto-derived for templated
//           types; only `custom` exposes a title field.
// ══════════════════════════════════════════════════════════════════════════════
function CreateProposalSheet({
  visible,
  step,
  selectedType,
  payload,
  customTitle,
  customDescription,
  creating,
  onPickType,
  onBack,
  onClose,
  onChangePayload,
  onChangeCustomTitle,
  onChangeCustomDescription,
  onSubmit,
}: {
  visible: boolean;
  step: "type" | "form";
  selectedType: ProposalType | null;
  payload: Record<string, any>;
  customTitle: string;
  customDescription: string;
  creating: boolean;
  onPickType: (type: ProposalType) => void;
  onBack: () => void;
  onClose: () => void;
  onChangePayload: (next: Record<string, any>) => void;
  onChangeCustomTitle: (s: string) => void;
  onChangeCustomDescription: (s: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  const setField = (key: string, value: any) =>
    onChangePayload({ ...payload, [key]: value });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />

          {/* Header */}
          <View style={sheetStyles.headerRow}>
            {step === "form" ? (
              <TouchableOpacity onPress={onBack} accessibilityRole="button">
                <Ionicons name="chevron-back" size={22} color="#0A2342" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 22 }} />
            )}
            <Text style={sheetStyles.title}>
              {step === "type"
                ? t("circle_voting.create_step_pick_type")
                : t(`circle_voting.type_${selectedType}`)}
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={22} color="#0A2342" />
            </TouchableOpacity>
          </View>

          {/* Step 1 — type picker */}
          {step === "type" && (
            <ScrollView style={{ maxHeight: 480 }}>
              {PROPOSAL_TEMPLATES.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.type}
                  style={sheetStyles.typeCard}
                  onPress={() => onPickType(tmpl.type)}
                  accessibilityRole="button"
                >
                  <View style={sheetStyles.typeIconWrap}>
                    <Ionicons name={tmpl.icon} size={22} color="#00C6AE" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={sheetStyles.typeNameRow}>
                      <Text style={sheetStyles.typeName}>
                        {t(`circle_voting.type_${tmpl.type}`)}
                      </Text>
                      {tmpl.isCritical && (
                        <View style={sheetStyles.criticalPill}>
                          <Text style={sheetStyles.criticalText}>
                            {t("circle_voting.type_critical_pill")}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={sheetStyles.typeDesc} numberOfLines={2}>
                      {t(`circle_voting.type_${tmpl.type}_desc`)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Step 2 — type-specific form */}
          {step === "form" && selectedType && (
            <ScrollView style={{ maxHeight: 480 }}>
              <Text style={sheetStyles.formHint}>
                {t(`circle_voting.type_${selectedType}_desc`)}
              </Text>

              {selectedType === "admit_member" && (
                <Field
                  label={t("circle_voting.field_member_email")}
                  value={payload.member ?? ""}
                  onChangeText={(v) => setField("member", v)}
                />
              )}

              {selectedType === "remove_member" && (
                <>
                  <Field
                    label={t("circle_voting.field_target_member")}
                    value={payload.member ?? ""}
                    onChangeText={(v) => setField("member", v)}
                  />
                  <Field
                    label={t("circle_voting.field_reason")}
                    value={payload.reason ?? ""}
                    onChangeText={(v) => setField("reason", v)}
                    multiline
                  />
                </>
              )}

              {selectedType === "change_rules" && (
                <>
                  <Text style={sheetStyles.inputLabel}>
                    {t("circle_voting.field_rule_to_change")}
                  </Text>
                  <View style={sheetStyles.segmented}>
                    {RULE_OPTIONS.map((rk) => {
                      const active = payload.rule === rk;
                      return (
                        <TouchableOpacity
                          key={rk}
                          style={[sheetStyles.segment, active && sheetStyles.segmentActive]}
                          onPress={() => onChangePayload({ ...payload, rule: rk, value: "" })}
                        >
                          <Text style={[sheetStyles.segmentText, active && sheetStyles.segmentTextActive]}>
                            {t(`circle_voting.field_rule_${rk}`)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Field
                    label={t("circle_voting.field_new_value")}
                    value={payload.value ?? ""}
                    onChangeText={(v) => setField("value", v)}
                  />
                </>
              )}

              {selectedType === "change_payout_order" && (
                <Field
                  label={t("circle_voting.field_order_proposal")}
                  value={payload.order_proposal ?? ""}
                  onChangeText={(v) => setField("order_proposal", v)}
                  multiline
                />
              )}

              {selectedType === "dissolve_circle" && (
                <Field
                  label={t("circle_voting.field_reason")}
                  value={payload.reason ?? ""}
                  onChangeText={(v) => setField("reason", v)}
                  multiline
                />
              )}

              {selectedType === "custom" && (
                <>
                  <Field
                    label={t("circle_voting.field_custom_title")}
                    value={customTitle}
                    onChangeText={onChangeCustomTitle}
                  />
                  <Field
                    label={t("circle_voting.field_custom_description")}
                    value={customDescription}
                    onChangeText={onChangeCustomDescription}
                    multiline
                  />
                </>
              )}

              <TouchableOpacity
                style={[sheetStyles.submitBtn, creating && { opacity: 0.6 }]}
                onPress={onSubmit}
                disabled={creating}
                accessibilityRole="button"
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                    <Text style={sheetStyles.submitBtnText}>
                      {t("circle_voting.create_submit")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={sheetStyles.inputLabel}>{label}</Text>
      <TextInput
        style={[sheetStyles.input, multiline && sheetStyles.inputMultiline]}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VoteConfirmSheet — bottom sheet that replaces Alert.alert on vote tap.
// ══════════════════════════════════════════════════════════════════════════════
function VoteConfirmSheet({
  payload,
  voting,
  onChangeReason,
  onCancel,
  onConfirm,
}: {
  payload: ConfirmVote;
  voting: boolean;
  onChangeReason: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const visible = payload != null;
  const choice = payload?.choice;
  const meta = choice ? VOTE_META[choice] : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={sheetStyles.backdrop} onPress={onCancel}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          {payload && choice && meta ? (
            <>
              <View style={[sheetStyles.confirmChoice, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.icon as any} size={20} color={meta.text} />
                <Text style={[sheetStyles.confirmChoiceText, { color: meta.text }]}>
                  {t(`circle_voting.vote_${choice}`)}
                </Text>
              </View>
              <Text style={sheetStyles.title}>
                {t(`circle_voting.vote_confirm_title_${choice}`)}
              </Text>
              <Text style={sheetStyles.body}>
                {t(`circle_voting.vote_confirm_body_${choice}`, { title: payload.title })}
              </Text>
              <Text style={sheetStyles.inputLabel}>
                {t("circle_voting.placeholder_reason")}
              </Text>
              <TextInput
                style={[sheetStyles.input, sheetStyles.inputMultiline]}
                placeholderTextColor="#9CA3AF"
                value={payload.reasoning}
                onChangeText={onChangeReason}
                multiline
                textAlignVertical="top"
              />
              <View style={sheetStyles.confirmRow}>
                <TouchableOpacity
                  style={sheetStyles.cancelBtn}
                  onPress={onCancel}
                  disabled={voting}
                  accessibilityRole="button"
                >
                  <Text style={sheetStyles.cancelBtnText}>
                    {t("circle_voting.vote_confirm_cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sheetStyles.submitBtn, { flex: 1, marginTop: 0 }, voting && { opacity: 0.6 }]}
                  onPress={onConfirm}
                  disabled={voting}
                  accessibilityRole="button"
                >
                  {voting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={sheetStyles.submitBtnText}>
                      {t("circle_voting.vote_confirm_confirm")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F7FA" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7280" },

  // Header
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },

  statsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  statText: { fontSize: 12, color: "#FFFFFF", fontWeight: "500" },

  // Tabs
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: "#FFFFFF" },
  tabActive: { backgroundColor: "#00C6AE15", borderWidth: 1, borderColor: "#00C6AE" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#00C6AE" },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#EF4444", flex: 1 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center", paddingHorizontal: 24 },

  // Card
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },
  deadline: { fontSize: 11, color: "#6B7280" },

  proposalTitle: { fontSize: 16, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  proposalDesc: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 8 },

  // Pills row (type + threshold)
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#8B5CF615", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  typeText: { fontSize: 11, color: "#8B5CF6", fontWeight: "600" },
  thresholdBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E5E7EB", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  thresholdText: { fontSize: 11, color: "#0A2342", fontWeight: "600" },

  // Vote progress
  voteProgress: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12, marginBottom: 10 },
  voteRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  voteItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  voteCount: { fontSize: 14, fontWeight: "700" },
  progressBarBg: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressBarFill: { height: 6, backgroundColor: "#10B981", borderRadius: 3 },
  quorumLineRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  quorumLine: { fontSize: 12, color: "#6B7280", fontWeight: "500" },

  // Result chip
  resultChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8 },
  resultLabel: { fontSize: 12, fontWeight: "600", flex: 1 },

  // Vote buttons
  voteButtons: { flexDirection: "row", gap: 8, marginTop: 4 },
  voteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 8 },
  voteBtnText: { fontSize: 13, fontWeight: "600" },

  // Bucket B — first-visit coach overlay.
  coachOverlay: { position: "absolute", left: 16, right: 16, bottom: 24 },
  coachCard: {
    backgroundColor: "#0A2342",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  coachText: { flex: 1, color: "#FFFFFF", fontSize: 13, lineHeight: 18 },
});

// ══════════════════════════════════════════════════════════════════════════════
// HelpSheet — six-topic glossary modal (Bucket B), opened by the header
// (?) button. Reads circle_voting.help_<topic>_{title,body}.
// ══════════════════════════════════════════════════════════════════════════════
function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>{t("circle_voting.help_sheet_title")}</Text>
          <ScrollView style={{ maxHeight: 460 }}>
            {HELP_TOPICS.map((topic, idx) => (
              <View
                key={topic}
                style={[
                  sheetStyles.helpItem,
                  idx === HELP_TOPICS.length - 1 && sheetStyles.helpItemLast,
                ]}
              >
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`circle_voting.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.body}>
                  {t(`circle_voting.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={sheetStyles.submitBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.submitBtnText}>{t("circle_voting.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PillExplainerSheet — opens from a tappable pill on the proposal card.
// Three kinds: "type" (per proposal type), "quorum", "threshold". The
// "type" kind interpolates {{label}} so the title reads naturally for
// each type. quorum / threshold have static title/body keys.
// ══════════════════════════════════════════════════════════════════════════════
function PillExplainerSheet({
  explainer,
  onClose,
}: {
  explainer: PillExplainer;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const visible = explainer != null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          {explainer?.kind === "type" ? (
            <>
              <Text style={sheetStyles.title}>
                {t(`circle_voting.type_explainer_${explainer.key}_title`)}
              </Text>
              <Text style={sheetStyles.body}>
                {t(`circle_voting.type_explainer_${explainer.key}_body`)}
              </Text>
            </>
          ) : explainer?.kind === "quorum" ? (
            <>
              <Text style={sheetStyles.title}>{t("circle_voting.quorum_explainer_title")}</Text>
              <Text style={sheetStyles.body}>{t("circle_voting.quorum_explainer_body")}</Text>
            </>
          ) : explainer?.kind === "threshold" ? (
            <>
              <Text style={sheetStyles.title}>{t("circle_voting.threshold_explainer_title")}</Text>
              <Text style={sheetStyles.body}>{t("circle_voting.threshold_explainer_body")}</Text>
            </>
          ) : null}
          <TouchableOpacity
            style={sheetStyles.submitBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={sheetStyles.submitBtnText}>{t("circle_voting.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Sheet styles (shared by Create + VoteConfirm + Help + PillExplainer) ───
const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "700", color: "#0A2342" },
  body: { fontSize: 13, color: "#0A2342", lineHeight: 19, marginBottom: 12 },

  formHint: { fontSize: 12, color: "#6B7280", marginBottom: 12 },

  // Type cards
  typeCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  typeIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#00C6AE15", alignItems: "center", justifyContent: "center" },
  typeNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  typeName: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  typeDesc: { fontSize: 12, color: "#6B7280", lineHeight: 16 },
  criticalPill: { backgroundColor: "#FEE2E2", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  criticalText: { fontSize: 10, fontWeight: "700", color: "#991B1B", letterSpacing: 0.3 },

  // Inputs
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#0A2342", marginTop: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { backgroundColor: "#F5F7FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#0A2342" },
  inputMultiline: { minHeight: 80, paddingTop: 12 },

  // Segmented (change_rules → which rule)
  segmented: { flexDirection: "row", gap: 6, marginBottom: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8, backgroundColor: "#F5F7FA" },
  segmentActive: { backgroundColor: "#00C6AE15", borderWidth: 1, borderColor: "#00C6AE" },
  segmentText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  segmentTextActive: { color: "#00C6AE" },

  // Submit
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  // Confirm sheet
  confirmChoice: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  confirmChoiceText: { fontSize: 13, fontWeight: "700" },
  confirmRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#0A2342", fontSize: 14, fontWeight: "700" },

  // Bucket B — HelpSheet items.
  helpItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  helpItemLast: { borderBottomWidth: 0 },
  helpItemTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
});
