import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, Pressable, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useProposalDetail, useCastVote, useCreateProposal } from "../hooks/useCircleDemocracy";
import { useProfileBatch } from "../hooks/useProfileBatch";
import { useAuth } from "../context/AuthContext";
import type { VoteChoice } from "../services/CircleDemocracyEngine";

type RouteParams = { ProposalDetail: { proposalId: string } };

// Same palette as CircleVotingScreen so cards on both screens read the same.
const VOTE_META: Record<VoteChoice, { bg: string; text: string; icon: string }> = {
  yes:     { bg: "#10B98115", text: "#10B981", icon: "thumbs-up" },
  no:      { bg: "#EF444415", text: "#EF4444", icon: "thumbs-down" },
  abstain: { bg: "#6B728015", text: "#6B7280", icon: "remove-circle-outline" },
};

const STATUS_META: Record<string, { color: string; icon: string; labelKey: string }> = {
  draft:     { color: "#6B7280", icon: "create-outline",          labelKey: "circle_voting.status_draft" },
  open:      { color: "#3B82F6", icon: "radio-button-on",          labelKey: "circle_voting.status_open" },
  closed:    { color: "#F59E0B", icon: "lock-closed",              labelKey: "circle_voting.status_closed" },
  executed:  { color: "#10B981", icon: "checkmark-done-circle",    labelKey: "circle_voting.status_executed" },
  cancelled: { color: "#EF4444", icon: "close-circle",             labelKey: "circle_voting.status_cancelled" },
};

// Shortened UUID fallback when a voter profile hasn't loaded yet.
const shortId = (id: string | undefined | null): string =>
  id ? `${id.slice(0, 8)}…` : "—";

// Confirm-sheet payload type — vote confirms and cancel-proposal confirm
// share the same bottom sheet shape so we only mount one Modal.
type ConfirmPayload =
  | { kind: "vote"; choice: VoteChoice; reasoning: string }
  | { kind: "cancel" }
  | null;

export default function ProposalDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "ProposalDetail">>();
  const { proposalId } = route.params;
  const { user } = useAuth();

  const {
    proposal,
    votes,
    myVote,
    votingProgress,
    isVotingOpen,
    typeInfo,
    loading,
    refetch,
  } = useProposalDetail(proposalId);

  const { castVote, loading: voting } = useCastVote();
  const { cancelProposal, loading: cancelling } = useCreateProposal();

  // Confirm sheet state — drives both the vote-confirm and cancel-proposal
  // flows. Local to the screen so the action handlers can mutate it
  // without round-tripping through a child component.
  const [confirm, setConfirm] = useState<ConfirmPayload>(null);

  // Batch fetch voter names so the "Who voted" list shows real people
  // instead of UUID prefixes. Falls back to shortId on a profile miss.
  const voterIds = useMemo(() => votes.map((v) => v.voterId), [votes]);
  const { names } = useProfileBatch(voterIds);
  const resolveName = useCallback(
    (id?: string | null) => (id && names.get(id)) || shortId(id ?? undefined),
    [names],
  );

  const isProposer = !!(user?.id && proposal?.proposerId === user.id);
  const canCancel = isProposer && proposal && (proposal.status === "open" || proposal.status === "draft");

  // ── Confirm executors ──────────────────────────────────────────────────────
  const executeConfirm = useCallback(async () => {
    if (!confirm) return;
    const payload = confirm;
    setConfirm(null);
    if (payload.kind === "vote") {
      const result = await castVote(
        proposalId,
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
    } else if (payload.kind === "cancel") {
      const result = await cancelProposal(proposalId);
      if (result) {
        navigation.goBack();
      } else {
        Alert.alert(
          t("circle_voting.alert_error_title"),
          t("circle_voting.alert_cancel_failed"),
        );
      }
    }
  }, [confirm, castVote, cancelProposal, proposalId, refetch, navigation, t]);

  // ── Loading / not-found ────────────────────────────────────────────────────
  if (loading && !proposal) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>{t("circle_voting.detail_loading")}</Text>
      </View>
    );
  }
  if (!proposal) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>{t("circle_voting.detail_not_found_title")}</Text>
        <Text style={styles.errorBody}>{t("circle_voting.detail_not_found_body")}</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.errorBackText}>{t("circle_voting.btn_cancel")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived metrics for the detail card ────────────────────────────────────
  const statusMeta = STATUS_META[proposal.status] || STATUS_META.draft;
  const quorumNeeded = Math.ceil(proposal.eligibleVoters * proposal.quorumPct);
  const totalVoted = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const decisive = proposal.votesFor + proposal.votesAgainst;
  const yesPct = decisive > 0 ? Math.round((proposal.votesFor / decisive) * 100) : 0;
  const thresholdPctLabel = Math.round(proposal.thresholdPct * 100);
  const thresholdLabel = thresholdPctLabel === 50
    ? t("circle_voting.threshold_simple_majority")
    : t("circle_voting.threshold_label", { pct: thresholdPctLabel });

  const endsAt = proposal.votingEndsAt ? new Date(proposal.votingEndsAt) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("circle_voting.detail_header_title")}</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
      >
        {/* Main info card */}
        <View style={styles.card}>
          {/* Status + deadline */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + "15" }]}>
              <Ionicons name={statusMeta.icon as any} size={12} color={statusMeta.color} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {t(statusMeta.labelKey)}
              </Text>
            </View>
            {endsAt && (
              <Text style={styles.deadline}>
                {proposal.status === "open"
                  ? t("circle_voting.deadline_ends_at", { date: endsAt.toLocaleDateString() })
                  : t("circle_voting.deadline_ended")}
              </Text>
            )}
          </View>

          <Text style={styles.title}>{proposal.title}</Text>
          {proposal.description && (
            <Text style={styles.description}>{proposal.description}</Text>
          )}

          {/* Type + threshold pills */}
          <View style={styles.pillRow}>
            <View style={styles.typeBadge}>
              <Ionicons name="document-text-outline" size={12} color="#8B5CF6" />
              <Text style={styles.typeText}>
                {t(`circle_voting.type_${proposal.proposalType}`)}
              </Text>
            </View>
            <View style={styles.thresholdBadge}>
              <Ionicons name="speedometer-outline" size={12} color="#0A2342" />
              <Text style={styles.thresholdText}>{thresholdLabel}</Text>
            </View>
            {typeInfo?.isCritical && (
              <View style={styles.criticalPill}>
                <Text style={styles.criticalText}>{t("circle_voting.type_critical_pill")}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payload */}
        <PayloadCard proposalType={proposal.proposalType} payload={proposal.proposalPayload} />

        {/* Vote breakdown */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>{t("circle_voting.detail_vote_breakdown")}</Text>

          {/* Bar */}
          <View style={styles.voteCountsRow}>
            <VoteCountTile color="#10B981" icon="thumbs-up" value={proposal.votesFor} />
            <VoteCountTile color="#EF4444" icon="thumbs-down" value={proposal.votesAgainst} />
            <VoteCountTile color="#6B7280" icon="remove-circle-outline" value={proposal.votesAbstain} />
          </View>

          {decisive > 0 && (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${yesPct}%` }]} />
            </View>
          )}

          {/* Quorum + threshold rows */}
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>{t("circle_voting.detail_quorum")}</Text>
            <Text style={styles.metricValue}>
              {t("circle_voting.detail_quorum_value", {
                voted: totalVoted,
                need: quorumNeeded,
                met: votingProgress?.quorumMet
                  ? t("circle_voting.detail_met")
                  : t("circle_voting.detail_not_met"),
              })}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>{t("circle_voting.detail_threshold")}</Text>
            <Text style={styles.metricValue}>
              {t("circle_voting.detail_threshold_value", {
                pct: yesPct,
                needed: thresholdPctLabel,
                met: votingProgress?.thresholdMet
                  ? t("circle_voting.detail_met")
                  : t("circle_voting.detail_not_met"),
              })}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>{t("circle_voting.detail_eligible")}</Text>
            <Text style={styles.metricValue}>
              {t("circle_voting.detail_eligible_value", {
                voted: totalVoted,
                eligible: proposal.eligibleVoters,
              })}
            </Text>
          </View>
        </View>

        {/* Result (closed proposals) */}
        {(proposal.status === "closed" || proposal.status === "executed") && proposal.result && (
          <ResultCard
            result={proposal.result}
            executedAt={proposal.executedAt}
            resultReason={proposal.resultReason}
            closedAt={proposal.closedAt}
          />
        )}

        {/* Who voted */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>
            {t("circle_voting.detail_who_voted", { count: votes.length })}
          </Text>
          {votes.length === 0 ? (
            <Text style={styles.emptySubtitle}>
              {t("circle_voting.detail_no_votes_yet")}
            </Text>
          ) : (
            votes.map((v) => {
              const meta = VOTE_META[v.vote];
              return (
                <View key={v.id} style={styles.voterRow}>
                  <View style={styles.voterAvatar}>
                    <Ionicons name="person" size={14} color="#9CA3AF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voterName}>{resolveName(v.voterId)}</Text>
                    {v.reasoning ? (
                      <Text style={styles.voterReason} numberOfLines={2}>
                        {v.reasoning}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.voterChoice, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon as any} size={12} color={meta.text} />
                    <Text style={[styles.voterChoiceText, { color: meta.text }]}>
                      {t(`circle_voting.vote_${v.vote}`)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Action area — vote or "you voted" indicator */}
        {isVotingOpen && (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>{t("circle_voting.detail_your_vote")}</Text>
            {myVote ? (
              <View style={styles.myVoteRow}>
                <Ionicons
                  name={VOTE_META[myVote.vote].icon as any}
                  size={18}
                  color={VOTE_META[myVote.vote].text}
                />
                <Text style={[styles.myVoteText, { color: VOTE_META[myVote.vote].text }]}>
                  {t("circle_voting.detail_you_voted", {
                    choice: t(`circle_voting.vote_${myVote.vote}`),
                  })}
                </Text>
              </View>
            ) : (
              <View style={styles.voteButtons}>
                {(["yes", "no", "abstain"] as const).map((choice) => {
                  const cfg = VOTE_META[choice];
                  return (
                    <TouchableOpacity
                      key={choice}
                      style={[styles.voteBtn, { backgroundColor: cfg.bg }]}
                      onPress={() => setConfirm({ kind: "vote", choice, reasoning: "" })}
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
        )}

        {/* Cancel proposal — only for proposer + draft/open. */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelProposalBtn}
            onPress={() => setConfirm({ kind: "cancel" })}
            disabled={cancelling}
            accessibilityRole="button"
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text style={styles.cancelProposalText}>
                  {t("circle_voting.cancel_button")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Confirm sheet — vote or cancel-proposal */}
      <ConfirmSheet
        payload={confirm}
        proposalTitle={proposal.title}
        busy={voting || cancelling}
        onChangeReason={(r) =>
          setConfirm(confirm?.kind === "vote" ? { ...confirm, reasoning: r } : confirm)
        }
        onCancel={() => setConfirm(null)}
        onConfirm={executeConfirm}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PayloadCard — type-specific payload renderer. Each templated type stamps a
// known shape into proposal_payload at create time (Bucket A). The card shows
// nothing for custom proposals (their content sits in the description above).
// ══════════════════════════════════════════════════════════════════════════════
function PayloadCard({
  proposalType,
  payload,
}: {
  proposalType: string;
  payload: Record<string, any>;
}) {
  const { t } = useTranslation();
  const rows = useMemo(() => {
    switch (proposalType) {
      case "admit_member":
        return [
          { label: t("circle_voting.detail_payload_member"), value: payload.member || "—" },
        ];
      case "remove_member":
        return [
          { label: t("circle_voting.detail_payload_member"), value: payload.member || "—" },
          { label: t("circle_voting.detail_payload_reason"), value: payload.reason || "—" },
        ];
      case "change_rules":
        return [
          {
            label: t("circle_voting.detail_payload_rule"),
            value: payload.rule
              ? t(`circle_voting.field_rule_${payload.rule}`)
              : "—",
          },
          { label: t("circle_voting.detail_payload_new_value"), value: payload.value || "—" },
        ];
      case "change_payout_order":
        return [
          { label: t("circle_voting.detail_payload_order"), value: payload.order_proposal || "—" },
        ];
      case "dissolve_circle":
        return [
          { label: t("circle_voting.detail_payload_reason"), value: payload.reason || "—" },
        ];
      default:
        return [];
    }
  }, [proposalType, payload, t]);

  if (rows.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeader}>{t("circle_voting.detail_payload")}</Text>
      {rows.map((row, i) => (
        <View key={i} style={styles.metricRow}>
          <Text style={styles.metricLabel}>{row.label}</Text>
          <Text style={styles.metricValueWrap}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ResultCard — renders the same Approved / Rejected / No quorum chip as the
// list card, plus a closed/executed timestamp underneath.
// ══════════════════════════════════════════════════════════════════════════════
function ResultCard({
  result,
  resultReason,
  executedAt,
  closedAt,
}: {
  result: string;
  resultReason: string | null;
  executedAt: string | null;
  closedAt: string | null;
}) {
  const { t } = useTranslation();
  const meta =
    result === "approved"
      ? { color: "#10B981", bg: "#10B98115", icon: "checkmark-circle" as const, label: t("circle_voting.result_approved") }
      : result === "rejected"
        ? { color: "#EF4444", bg: "#EF444415", icon: "close-circle" as const, label: t("circle_voting.result_rejected") }
        : { color: "#F59E0B", bg: "#F59E0B15", icon: "alert-circle" as const, label: t("circle_voting.result_no_quorum") };

  const executionLine =
    result === "approved"
      ? executedAt
        ? t("circle_voting.detail_executed_at", { date: new Date(executedAt).toLocaleString() })
        : t("circle_voting.detail_pending_execution")
      : null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeader}>{t("circle_voting.detail_result")}</Text>
      <View style={[styles.resultChip, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
        <Text style={[styles.resultLabel, { color: meta.color }]}>{meta.label}</Text>
      </View>
      {resultReason ? (
        <Text style={styles.resultReason}>{resultReason}</Text>
      ) : null}
      {closedAt ? (
        <Text style={styles.resultTimestamp}>
          {t("circle_voting.detail_closed_at", { date: new Date(closedAt).toLocaleString() })}
        </Text>
      ) : null}
      {executionLine ? <Text style={styles.resultTimestamp}>{executionLine}</Text> : null}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VoteCountTile — small icon + count column used in the breakdown card.
// ══════════════════════════════════════════════════════════════════════════════
function VoteCountTile({
  color,
  icon,
  value,
}: {
  color: string;
  icon: string;
  value: number;
}) {
  return (
    <View style={styles.voteTile}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={[styles.voteTileValue, { color }]}>{value}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ConfirmSheet — bottom sheet shared by vote-confirm and cancel-proposal.
//   • vote   → highlights the chosen vote with a colour chip + reason input
//   • cancel → no reason input, just a destructive Confirm button.
// ══════════════════════════════════════════════════════════════════════════════
function ConfirmSheet({
  payload,
  proposalTitle,
  busy,
  onChangeReason,
  onCancel,
  onConfirm,
}: {
  payload: ConfirmPayload;
  proposalTitle: string;
  busy: boolean;
  onChangeReason: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const visible = payload != null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={sheetStyles.backdrop} onPress={onCancel}>
        <Pressable style={sheetStyles.sheet} onPress={() => {}}>
          <View style={sheetStyles.handle} />
          {payload?.kind === "vote" ? (
            <>
              <View style={[sheetStyles.choiceChip, { backgroundColor: VOTE_META[payload.choice].bg }]}>
                <Ionicons
                  name={VOTE_META[payload.choice].icon as any}
                  size={20}
                  color={VOTE_META[payload.choice].text}
                />
                <Text style={[sheetStyles.choiceText, { color: VOTE_META[payload.choice].text }]}>
                  {t(`circle_voting.vote_${payload.choice}`)}
                </Text>
              </View>
              <Text style={sheetStyles.title}>
                {t(`circle_voting.vote_confirm_title_${payload.choice}`)}
              </Text>
              <Text style={sheetStyles.body}>
                {t(`circle_voting.vote_confirm_body_${payload.choice}`, { title: proposalTitle })}
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
            </>
          ) : payload?.kind === "cancel" ? (
            <>
              <Text style={sheetStyles.title}>
                {t("circle_voting.cancel_confirm_title")}
              </Text>
              <Text style={sheetStyles.body}>
                {t("circle_voting.cancel_confirm_body", { title: proposalTitle })}
              </Text>
            </>
          ) : null}
          <View style={sheetStyles.row}>
            <TouchableOpacity
              style={sheetStyles.cancelBtn}
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={sheetStyles.cancelBtnText}>
                {t("circle_voting.vote_confirm_cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                sheetStyles.confirmBtn,
                payload?.kind === "cancel" && sheetStyles.destructiveBtn,
                busy && { opacity: 0.6 },
              ]}
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={sheetStyles.confirmBtnText}>
                  {payload?.kind === "cancel"
                    ? t("circle_voting.cancel_confirm_button")
                    : t("circle_voting.vote_confirm_confirm")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F7FA", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7280" },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginTop: 12 },
  errorBody: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center" },
  errorBackBtn: { backgroundColor: "#0A2342", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 16 },
  errorBackText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // Header
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  // Card
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionHeader: { fontSize: 13, fontWeight: "700", color: "#0A2342", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  emptySubtitle: { fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingVertical: 12 },

  // Status row
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },
  deadline: { fontSize: 11, color: "#6B7280" },

  title: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginBottom: 6 },
  description: { fontSize: 14, color: "#6B7280", lineHeight: 20, marginBottom: 12 },

  // Pills
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#8B5CF615", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  typeText: { fontSize: 11, color: "#8B5CF6", fontWeight: "600" },
  thresholdBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E5E7EB", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  thresholdText: { fontSize: 11, color: "#0A2342", fontWeight: "600" },
  criticalPill: { backgroundColor: "#FEE2E2", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  criticalText: { fontSize: 10, fontWeight: "700", color: "#991B1B", letterSpacing: 0.3 },

  // Vote counts
  voteCountsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  voteTile: { flexDirection: "row", alignItems: "center", gap: 6 },
  voteTileValue: { fontSize: 18, fontWeight: "700" },
  progressBarBg: { height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden", marginBottom: 14 },
  progressBarFill: { height: 8, backgroundColor: "#10B981", borderRadius: 4 },

  // Metric rows
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  metricLabel: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  metricValue: { fontSize: 13, color: "#0A2342", fontWeight: "600" },
  metricValueWrap: { fontSize: 13, color: "#0A2342", fontWeight: "600", flex: 1, marginLeft: 12, textAlign: "right" },

  // Result chip
  resultChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8 },
  resultLabel: { fontSize: 14, fontWeight: "700" },
  resultReason: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 6 },
  resultTimestamp: { fontSize: 12, color: "#9CA3AF" },

  // Voter row
  voterRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  voterAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  voterName: { fontSize: 13, color: "#0A2342", fontWeight: "600" },
  voterReason: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  voterChoice: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  voterChoiceText: { fontSize: 11, fontWeight: "700" },

  // My vote row + vote buttons
  myVoteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  myVoteText: { fontSize: 14, fontWeight: "700" },
  voteButtons: { flexDirection: "row", gap: 8 },
  voteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 8 },
  voteBtnText: { fontSize: 13, fontWeight: "600" },

  // Cancel proposal button
  cancelProposalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EF4444",
    backgroundColor: "#FFFFFF",
    marginTop: 4,
  },
  cancelProposalText: { fontSize: 14, color: "#EF4444", fontWeight: "700" },
});

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "700", color: "#0A2342", marginBottom: 12 },
  body: { fontSize: 13, color: "#0A2342", lineHeight: 19, marginBottom: 12 },

  choiceChip: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  choiceText: { fontSize: 13, fontWeight: "700" },

  inputLabel: { fontSize: 12, fontWeight: "600", color: "#0A2342", marginTop: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { backgroundColor: "#F5F7FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#0A2342" },
  inputMultiline: { minHeight: 80, paddingTop: 12 },

  row: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#0A2342", fontSize: 14, fontWeight: "700" },
  confirmBtn: { flex: 1, backgroundColor: "#0A2342", borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  destructiveBtn: { backgroundColor: "#EF4444" },
  confirmBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
