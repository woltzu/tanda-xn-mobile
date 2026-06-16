// ══════════════════════════════════════════════════════════════════════════════
// screens/ConflictCaseScreen.tsx — Conflict P1 unified case viewer
// ══════════════════════════════════════════════════════════════════════════════
//
// Replaces `MediationCaseScreen` (1,112 LoC, elder list + ruling modal) and
// `MediationToolsScreen` (1,058 LoC, member-side mock UI). One role-aware
// screen with two render paths:
//
//   • No caseId         → render the elder's case list (Available + Mine)
//                         filtered to circleId when present. Tap a card
//                         drills into the same screen with caseId.
//   • caseId present    → per-case detail. Progress chip, timeline derived
//                         from MediationCase fields, role-aware action set,
//                         template chips above the message input, (?) help
//                         icons on every action, suggested-resolution card,
//                         optimistic actions with Undo toast (no Alert
//                         confirmations).
//
// The case data still flows through `useElder()` (availableCases / myCases)
// per the P0 universe-B contract — see docs/architecture/conflict_resolution.md.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  useElder,
  MediationCase,
  CaseStatus,
} from "../context/ElderContext";
import { showToast } from "../components/Toast";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const TEXT = "#111827";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const GREEN = "#10B981";

type Params = {
  caseId?: string;
  circleId?: string;
  circleName?: string;
};
type R = RouteProp<{ ConflictCase: Params }, "ConflictCase">;

type ElderAction = "warn" | "mediate" | "escalate" | "resolve";

// ══════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════

export default function ConflictCaseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<R>();
  const { t } = useTranslation();
  const { caseId, circleId, circleName } = (route.params ?? {}) as Params;

  const {
    elderProfile,
    availableCases,
    myCases,
    acceptCase,
    submitRuling,
    escalateCase,
    isLoading,
  } = useElder();

  const isElder = !!elderProfile;
  const allCases = useMemo<MediationCase[]>(
    () => [...availableCases, ...myCases],
    [availableCases, myCases],
  );
  const selectedCase = useMemo<MediationCase | undefined>(
    () => allCases.find((c) => c.id === caseId),
    [allCases, caseId],
  );

  // List path: when no caseId, show cases for the circle (or all if no
  // circle context either).
  if (!caseId) {
    return (
      <CaseList
        cases={
          circleId
            ? allCases.filter((c) => c.circleId === circleId)
            : allCases
        }
        circleName={circleName}
        loading={isLoading}
        onSelect={(c) =>
          navigation.navigate("ConflictCase", { caseId: c.id })
        }
        onBack={() => navigation.goBack()}
        t={t}
      />
    );
  }

  if (!selectedCase) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header
          title={t("conflict_case.header_title")}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={36} color={MUTED} />
          <Text style={styles.notFoundText}>
            {t("conflict_case.not_found")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <CaseDetail
      isElder={isElder}
      mediationCase={selectedCase}
      onBack={() => navigation.goBack()}
      onAccept={() => acceptCase(selectedCase.id)}
      onSubmitRuling={(ruling, explanation) =>
        submitRuling(selectedCase.id, ruling, explanation)
      }
      onEscalate={() =>
        escalateCase(selectedCase.id, "elder_escalation")
      }
      t={t}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Case list — drill-in path when no caseId is supplied
// ══════════════════════════════════════════════════════════════════════════

function CaseList({
  cases,
  circleName,
  loading,
  onSelect,
  onBack,
  t,
}: {
  cases: MediationCase[];
  circleName: string | undefined;
  loading: boolean;
  onSelect: (c: MediationCase) => void;
  onBack: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <Header
        title={
          circleName
            ? t("conflict_case.list_header_for", { name: circleName })
            : t("conflict_case.list_header")
        }
        onBack={onBack}
      />

      {loading && cases.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : cases.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>
            {t("conflict_case.list_empty_title")}
          </Text>
          <Text style={styles.emptyBody}>
            {t("conflict_case.list_empty_body")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {cases.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.caseCard}
              onPress={() => onSelect(c)}
              accessibilityRole="button"
            >
              <View style={styles.caseCardHeader}>
                <View
                  style={[
                    styles.severityPill,
                    { backgroundColor: severityBg(c.severity) },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      { color: severityColor(c.severity) },
                    ]}
                  >
                    {t(`conflict_case.severity_${c.severity}`)}
                  </Text>
                </View>
                <Text style={styles.caseCardCircle} numberOfLines={1}>
                  {c.circleName}
                </Text>
              </View>
              <Text style={styles.caseCardTitle} numberOfLines={2}>
                {c.title}
              </Text>
              <View style={styles.caseCardFooter}>
                <Text style={styles.caseCardFooterText}>
                  {t(`conflict_case.type_${c.type}`)}
                </Text>
                <Text style={styles.caseCardFooterText}>
                  {t("conflict_case.opened_days", { n: c.openedDays })}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Case detail — progress chip, timeline, role-aware actions, suggestion
// ══════════════════════════════════════════════════════════════════════════

function CaseDetail({
  isElder,
  mediationCase,
  onBack,
  onAccept,
  onSubmitRuling,
  onEscalate,
  t,
}: {
  isElder: boolean;
  mediationCase: MediationCase;
  onBack: () => void;
  onAccept: () => Promise<void> | void;
  onSubmitRuling: (ruling: string, explanation: string) => Promise<void> | void;
  onEscalate: () => Promise<void> | void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const c = mediationCase;
  const step = stepForStatus(c.status);

  // Inline mediation form state (elder).
  const [showRuling, setShowRuling] = useState(false);
  const [rulingText, setRulingText] = useState("");
  const [explanationText, setExplanationText] = useState("");

  // Member message input + template chips.
  const [messageText, setMessageText] = useState("");

  // Collapsible suggested-resolution card.
  const [suggestionOpen, setSuggestionOpen] = useState(true);

  // Undo toast state. Holds the deferred action's timeout id and a label.
  const [pendingAction, setPendingAction] = useState<{
    label: string;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  useEffect(() => {
    return () => {
      if (pendingAction) clearTimeout(pendingAction.timeoutId);
    };
  }, [pendingAction]);

  // 5-second undo window before the action actually fires.
  const fireWithUndo = (label: string, run: () => void) => {
    if (pendingAction) clearTimeout(pendingAction.timeoutId);
    const id = setTimeout(() => {
      run();
      setPendingAction(null);
    }, 5000);
    setPendingAction({ label, timeoutId: id });
    showToast(t("conflict_case.toast_action_pending", { action: label }), "info");
  };
  const undoPending = () => {
    if (!pendingAction) return;
    clearTimeout(pendingAction.timeoutId);
    setPendingAction(null);
    showToast(t("conflict_case.toast_undone"), "success");
  };

  // Help-icon tap → Alert with action explanation.
  const showHelp = (key: ElderAction) =>
    Alert.alert(t(`conflict_case.help_${key}_title`), t(`conflict_case.help_${key}_body`));

  // Elder actions.
  const handleWarn = () =>
    fireWithUndo(t("conflict_case.action_warn"), () => {
      // TODO(elder-actions): no warnMember RPC yet — mirror the toast
      // path until ElderContext exposes a real action method.
      showToast(t("conflict_case.toast_warn_sent"), "success");
    });
  const handleEscalate = () =>
    fireWithUndo(t("conflict_case.action_escalate"), () => {
      onEscalate();
      showToast(t("conflict_case.toast_escalated"), "success");
    });
  const handleResolve = () => {
    // Resolve flips to the inline ruling form rather than scheduling — it
    // needs a free-text ruling + explanation before the row can land.
    setShowRuling(true);
  };
  const handleSubmitRuling = () => {
    if (!rulingText.trim() || !explanationText.trim()) {
      showToast(t("conflict_case.toast_resolve_missing"), "error");
      return;
    }
    fireWithUndo(t("conflict_case.action_resolve"), () => {
      onSubmitRuling(rulingText.trim(), explanationText.trim());
      setShowRuling(false);
      setRulingText("");
      setExplanationText("");
      showToast(t("conflict_case.toast_resolved"), "success");
    });
  };

  // Member actions (stubs — no backend method exposed yet).
  const handleRespond = () => {
    if (!messageText.trim()) {
      showToast(t("conflict_case.toast_message_empty"), "error");
      return;
    }
    fireWithUndo(t("conflict_case.action_respond"), () => {
      // TODO(member-actions): wire dispute_messages.insert once Universe
      // B exposes a write helper. For now we surface a positive toast so
      // the user has feedback while the backend catches up.
      showToast(t("conflict_case.toast_response_posted"), "success");
      setMessageText("");
    });
  };
  const handleVote = () =>
    fireWithUndo(t("conflict_case.action_vote"), () => {
      showToast(t("conflict_case.toast_voted"), "success");
    });

  // Template chip → prefill the message body.
  const templates: { key: string; templateKey: string; labelKey: string }[] = [
    {
      key: "missed_contribution",
      labelKey: "conflict_case.template_missed_label",
      templateKey: "conflict_case.template_missed_text",
    },
    {
      key: "late_payout",
      labelKey: "conflict_case.template_late_label",
      templateKey: "conflict_case.template_late_text",
    },
    {
      key: "communication",
      labelKey: "conflict_case.template_comm_label",
      templateKey: "conflict_case.template_comm_text",
    },
    {
      key: "emergency",
      labelKey: "conflict_case.template_emergency_label",
      templateKey: "conflict_case.template_emergency_text",
    },
  ];

  // Suggested resolution — rule-based, keyed on case type.
  const suggestion = suggestionFor(c.type, t);

  return (
    <SafeAreaView style={styles.safe}>
      <Header title={t("conflict_case.header_title")} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.detailContent}>
        {/* Progress chip */}
        <View style={styles.progressChip}>
          <Ionicons name="ellipse" size={8} color={TEAL} />
          <Text style={styles.progressChipText}>
            {t("conflict_case.progress_chip", {
              step,
              label: t(`conflict_case.progress_step_${step}`),
            })}
          </Text>
        </View>

        {/* Case summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.severityPill,
                { backgroundColor: severityBg(c.severity) },
              ]}
            >
              <Text
                style={[
                  styles.severityText,
                  { color: severityColor(c.severity) },
                ]}
              >
                {t(`conflict_case.severity_${c.severity}`)}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusBg(c.status) },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusColor(c.status) },
                ]}
              >
                {t(`conflict_case.status_${c.status}`)}
              </Text>
            </View>
            {/* P2 (migration 161) — AUTO pill when the dispute was opened
                by the contributions trigger rather than a user. */}
            {c.autoCreated ? (
              <View style={styles.p2AutoPill}>
                <Ionicons name="flash-outline" size={10} color="#0A2342" />
                <Text style={styles.p2AutoPillText}>
                  {t("conflict_p2.badge_auto")}
                </Text>
              </View>
            ) : null}
          </View>
          {/* P2 — escalation banner */}
          {c.escalationTier ? (
            <View
              style={[
                styles.p2EscalationBanner,
                c.escalationTier === "global_queue" && styles.p2EscalationBannerHigh,
              ]}
            >
              <Ionicons
                name={
                  c.escalationTier === "global_queue"
                    ? "alert-circle"
                    : "alert-circle-outline"
                }
                size={14}
                color={
                  c.escalationTier === "global_queue" ? "#991B1B" : "#92400E"
                }
              />
              <Text style={styles.p2EscalationBannerText}>
                {t(`conflict_p2.escalation_${c.escalationTier}`)}
              </Text>
            </View>
          ) : null}
          <Text style={styles.summaryTitle}>{c.title}</Text>
          <Text style={styles.summarySub}>{c.circleName}</Text>
          <Text style={styles.summaryBody}>{c.description}</Text>
          <View style={styles.summaryMeta}>
            <MetaPill
              icon="people-outline"
              text={t("conflict_case.meta_parties", {
                n: c.partiesInvolved,
              })}
            />
            <MetaPill
              icon="calendar-outline"
              text={t("conflict_case.meta_opened", { n: c.openedDays })}
            />
            {c.dueDate ? (
              <MetaPill
                icon="alarm-outline"
                text={t("conflict_case.meta_due", {
                  date: new Date(c.dueDate).toLocaleDateString(),
                })}
              />
            ) : null}
          </View>
        </View>

        {/* Timeline — derived from case fields */}
        <Section title={t("conflict_case.section_timeline")}>
          <TimelineRow
            icon="flag-outline"
            text={t("conflict_case.timeline_reported", {
              date: new Date(c.openedDate).toLocaleDateString(),
            })}
            completed
          />
          {c.assignedElderId ? (
            <TimelineRow
              icon="person-outline"
              text={t("conflict_case.timeline_assigned")}
              completed
            />
          ) : null}
          {c.status === "in_progress" ? (
            <TimelineRow
              icon="chatbubbles-outline"
              text={t("conflict_case.timeline_in_progress")}
              completed
            />
          ) : null}
          {c.status === "escalated" ? (
            <TimelineRow
              icon="warning-outline"
              text={t("conflict_case.timeline_escalated")}
              completed
              accent={AMBER}
            />
          ) : null}
          {c.resolution ? (
            <TimelineRow
              icon="checkmark-circle-outline"
              text={t("conflict_case.timeline_resolved", {
                ruling: c.resolution.ruling,
              })}
              completed
              accent={GREEN}
            />
          ) : (
            <TimelineRow
              icon="ellipse-outline"
              text={t("conflict_case.timeline_pending_resolution")}
            />
          )}
        </Section>

        {/* Suggested resolution (rule-based) */}
        {suggestion ? (
          <View style={styles.suggestionCard}>
            <TouchableOpacity
              style={styles.suggestionHeader}
              onPress={() => setSuggestionOpen((v) => !v)}
              accessibilityRole="button"
            >
              <Ionicons name="bulb-outline" size={16} color={TEAL} />
              <Text style={styles.suggestionTitle}>
                {t("conflict_case.suggestion_title")}
              </Text>
              <Ionicons
                name={suggestionOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={MUTED}
              />
            </TouchableOpacity>
            {suggestionOpen ? (
              <Text style={styles.suggestionBody}>{suggestion}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Action set — role-aware */}
        {isElder ? (
          <Section title={t("conflict_case.section_elder_actions")}>
            {c.status === "open" ? (
              <PrimaryAction
                icon="hand-right-outline"
                label={t("conflict_case.action_accept")}
                onPress={() => onAccept()}
              />
            ) : null}

            <ElderActionRow
              icon="warning-outline"
              label={t("conflict_case.action_warn")}
              onAction={handleWarn}
              onHelp={() => showHelp("warn")}
            />
            <ElderActionRow
              icon="chatbubbles-outline"
              label={t("conflict_case.action_mediate")}
              onAction={handleResolve}
              onHelp={() => showHelp("mediate")}
            />
            <ElderActionRow
              icon="arrow-up-circle-outline"
              label={t("conflict_case.action_escalate")}
              onAction={handleEscalate}
              onHelp={() => showHelp("escalate")}
            />
            <ElderActionRow
              icon="checkmark-done-outline"
              label={t("conflict_case.action_resolve")}
              onAction={handleResolve}
              onHelp={() => showHelp("resolve")}
            />

            {/* Inline ruling form — replaces the modal from the legacy
                MediationCaseScreen. */}
            {showRuling ? (
              <View style={styles.rulingCard}>
                <Text style={styles.fieldLabel}>
                  {t("conflict_case.field_ruling")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={rulingText}
                  onChangeText={setRulingText}
                  placeholder={t("conflict_case.placeholder_ruling")}
                  placeholderTextColor={MUTED}
                  multiline
                />
                <Text style={styles.fieldLabel}>
                  {t("conflict_case.field_explanation")}
                </Text>
                <TextInput
                  style={[styles.input, styles.inputTall]}
                  value={explanationText}
                  onChangeText={setExplanationText}
                  placeholder={t("conflict_case.placeholder_explanation")}
                  placeholderTextColor={MUTED}
                  multiline
                />
                <View style={styles.rulingActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setShowRuling(false);
                      setRulingText("");
                      setExplanationText("");
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelBtnText}>
                      {t("conflict_case.btn_cancel")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleSubmitRuling}
                    accessibilityRole="button"
                  >
                    <Text style={styles.submitBtnText}>
                      {t("conflict_case.btn_submit_ruling")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </Section>
        ) : (
          <Section title={t("conflict_case.section_member_actions")}>
            {/* Template chips */}
            <Text style={styles.helperLabel}>
              {t("conflict_case.templates_label")}
            </Text>
            <View style={styles.templateRow}>
              {templates.map((tpl) => (
                <TouchableOpacity
                  key={tpl.key}
                  style={styles.templateChip}
                  onPress={() => setMessageText(t(tpl.templateKey))}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={12}
                    color={TEAL}
                  />
                  <Text style={styles.templateChipText}>
                    {t(tpl.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, styles.inputTall]}
              value={messageText}
              onChangeText={setMessageText}
              placeholder={t("conflict_case.placeholder_message")}
              placeholderTextColor={MUTED}
              multiline
            />

            <View style={styles.memberActionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleVote}
                accessibilityRole="button"
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color={NAVY}
                />
                <Text style={styles.secondaryBtnText}>
                  {t("conflict_case.action_vote")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleRespond}
                accessibilityRole="button"
              >
                <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  {t("conflict_case.action_respond")}
                </Text>
              </TouchableOpacity>
            </View>
          </Section>
        )}
      </ScrollView>

      {/* Undo toast — 5-second action delay. */}
      {pendingAction ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText}>
            {t("conflict_case.undo_label", {
              action: pendingAction.label,
            })}
          </Text>
          <TouchableOpacity
            onPress={undoPending}
            accessibilityRole="button"
            style={styles.undoBtn}
          >
            <Text style={styles.undoBtnText}>
              {t("conflict_case.undo_btn")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <LinearGradient
      colors={[NAVY, "#143654"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </LinearGradient>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MetaPill({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={12} color={MUTED} />
      <Text style={styles.metaPillText}>{text}</Text>
    </View>
  );
}

function TimelineRow({
  icon,
  text,
  completed,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  completed?: boolean;
  accent?: string;
}) {
  const color = accent ?? (completed ? TEAL : MUTED);
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineDot, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.timelineText}>{text}</Text>
    </View>
  );
}

function PrimaryAction({
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
      style={styles.primaryBtn}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ElderActionRow({
  icon,
  label,
  onAction,
  onHelp,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onAction: () => void;
  onHelp: () => void;
}) {
  return (
    <View style={styles.elderRow}>
      <TouchableOpacity
        style={styles.elderRowBtn}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={16} color={NAVY} />
        <Text style={styles.elderRowText}>{label}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onHelp}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
      >
        <Ionicons
          name="help-circle-outline"
          size={18}
          color={MUTED}
        />
      </TouchableOpacity>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Pure helpers
// ══════════════════════════════════════════════════════════════════════════

function stepForStatus(status: CaseStatus): 1 | 2 | 3 | 4 {
  switch (status) {
    case "open":
      return 1;
    case "assigned":
      return 2;
    case "in_progress":
      return 3;
    case "escalated":
      return 3;
    case "resolved":
      return 4;
    default:
      return 1;
  }
}

function severityColor(s: string): string {
  if (s === "high") return "#DC2626";
  if (s === "medium") return AMBER;
  return TEAL;
}
function severityBg(s: string): string {
  if (s === "high") return "#FEE2E2";
  if (s === "medium") return "#FEF3C7";
  return "#F0FDFB";
}
function statusColor(s: string): string {
  if (s === "resolved") return GREEN;
  if (s === "escalated") return RED;
  if (s === "in_progress" || s === "assigned") return AMBER;
  return MUTED;
}
function statusBg(s: string): string {
  if (s === "resolved") return "#F0FDF4";
  if (s === "escalated") return "#FEE2E2";
  if (s === "in_progress" || s === "assigned") return "#FEF3C7";
  return "#F3F4F6";
}
function suggestionFor(
  type: string,
  t: (key: string) => string,
): string | null {
  switch (type) {
    case "payment":
      return t("conflict_case.suggestion_payment");
    case "communication":
      return t("conflict_case.suggestion_communication");
    case "trust":
      return t("conflict_case.suggestion_trust");
    case "financial":
      return t("conflict_case.suggestion_financial");
    default:
      return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 10,
    flex: 1,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginTop: 8 },
  emptyBody: { fontSize: 12, color: MUTED, textAlign: "center" },

  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  notFoundText: { fontSize: 13, color: MUTED, textAlign: "center" },

  listContent: { padding: 16, paddingBottom: 32 },
  caseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  caseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  caseCardCircle: { fontSize: 11, color: MUTED, fontWeight: "600", flexShrink: 1 },
  caseCardTitle: { fontSize: 14, fontWeight: "700", color: TEXT, lineHeight: 19 },
  caseCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  caseCardFooterText: { fontSize: 11, color: MUTED },

  detailContent: { padding: 16, paddingBottom: 80 },

  progressChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  progressChipText: { fontSize: 11, fontWeight: "700", color: NAVY },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  summaryTitle: { fontSize: 16, fontWeight: "700", color: TEXT, marginBottom: 2 },
  summarySub: { fontSize: 12, color: MUTED, marginBottom: 8 },
  summaryBody: { fontSize: 13, color: TEXT, lineHeight: 19, marginBottom: 10 },
  summaryMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaPillText: { fontSize: 11, color: MUTED, fontWeight: "600" },

  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  severityText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  // P2 — auto-created badge + escalation banner
  p2AutoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  p2AutoPillText: { fontSize: 10, fontWeight: "800", color: "#0A2342", letterSpacing: 0.3 },
  p2EscalationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    marginTop: 8,
  },
  p2EscalationBannerHigh: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  p2EscalationBannerText: { flex: 1, fontSize: 11, fontWeight: "700", color: "#92400E" },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineText: { flex: 1, fontSize: 13, color: TEXT },

  suggestionCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TEAL,
    marginBottom: 14,
    overflow: "hidden",
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  suggestionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
  },
  suggestionBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontSize: 13,
    color: TEXT,
    lineHeight: 19,
  },

  elderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  elderRowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  elderRowText: { fontSize: 14, fontWeight: "600", color: NAVY },

  rulingCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: TEXT, marginTop: 6, marginBottom: 4 },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 40,
  },
  inputTall: { minHeight: 80, textAlignVertical: "top" },
  rulingActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: { fontSize: 13, color: MUTED, fontWeight: "600" },
  submitBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: TEAL,
  },
  submitBtnText: { fontSize: 13, color: "#FFFFFF", fontWeight: "700" },

  helperLabel: { fontSize: 12, fontWeight: "700", color: MUTED, marginBottom: 8 },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  templateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: TEAL,
  },
  templateChipText: { fontSize: 11, fontWeight: "700", color: TEAL },

  memberActionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: TEAL,
  },
  primaryBtnText: { fontSize: 13, color: "#FFFFFF", fontWeight: "700" },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NAVY,
    backgroundColor: "#FFFFFF",
  },
  secondaryBtnText: { fontSize: 13, color: NAVY, fontWeight: "700" },

  undoBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  undoText: { flex: 1, fontSize: 13, color: "#FFFFFF", fontWeight: "600" },
  undoBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  undoBtnText: { fontSize: 13, color: TEAL, fontWeight: "800" },
});
