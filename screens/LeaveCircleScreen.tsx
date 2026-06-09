// ═══════════════════════════════════════════════════════════════════════════════
// LeaveCircleScreen — Phase D3.1 of feat(substitute)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Full rewrite. The previous version was theatrical UI: setTimeout(1500)
// simulation, fake LV-{timestamp}-{rand} IDs, no DB writes, mismatched
// reason enums. This version uses the migration-101 RPCs end to end:
//   * evaluate_exit_for_member(circle_id)  — impact preview on mount
//   * submit_exit_request(circle_id, reason, acknowledged_impact=true)
//     — server-side computes evaluation + inserts circle_exit_requests,
//       the auto-match trigger from migration 099 fires immediately.
//
// Single-step UX (was 2-step wizard). The impact card is shown up front
// so the user can see exactly what happens before they commit. Reason
// picker maps UI labels → engine enum.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type EngineReason =
  | "financial_hardship"
  | "relocation"
  | "life_change"
  | "other";

interface LeaveCircleParams {
  circleId?: string;
  circleName?: string;
  // Older callers may pass these but we always re-evaluate server-side
  memberPosition?: number;
  totalMembers?: number;
  currentCycle?: number;
  totalCycles?: number;
  hasReceivedPayout?: boolean;
}

interface ExitEvaluation {
  success: boolean;
  notice_days?: number;
  cycles_completed?: number;
  total_cycles?: number;
  completion_percentage?: number;
  payout_already_received?: boolean;
  payout_entitlement_status?: string;
  original_payout_amount_cents?: number;
  substitute_share_cents?: number;
  insurance_pool_share_cents?: number;
  original_member_settlement_cents?: number;
  xnscore_impact?: "none" | "partial" | "full_default";
  xnscore_adjustment?: number;
  position?: number;
  error?: string;
}

const REASON_OPTIONS: Array<{
  key: EngineReason;
  uiLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}> = [
  {
    key: "financial_hardship",
    uiLabel: "Financial Difficulties",
    icon: "wallet-outline",
    description: "Cannot continue with contributions",
  },
  {
    key: "life_change",
    uiLabel: "Personal Reasons",
    icon: "person-outline",
    description: "Family or health-related matters",
  },
  {
    key: "relocation",
    uiLabel: "Relocating",
    icon: "airplane-outline",
    description: "Moving to a different area",
  },
  {
    key: "other",
    uiLabel: "Other Reason",
    icon: "ellipsis-horizontal",
    description: "Something else",
  },
];

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function LeaveCircleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
  const params = (route.params as LeaveCircleParams) || {};
  const { user } = useAuth();
  const circleId = params.circleId ?? "";
  const fallbackCircleName = params.circleName ?? "this circle";

  const [evaluation, setEvaluation] = useState<ExitEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(true);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [circleName, setCircleName] = useState<string>(fallbackCircleName);

  const [selectedReason, setSelectedReason] = useState<EngineReason | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{
    requestId: string;
    evaluation: ExitEvaluation;
  } | null>(null);

  // ── Load evaluation + circle name ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!circleId || !user?.id) {
        setEvalError("Missing circle or user context");
        setEvalLoading(false);
        return;
      }
      setEvalLoading(true);
      setEvalError(null);
      try {
        const [{ data: evalData, error: evalErr }, circleResp] = await Promise.all([
          supabase.rpc("evaluate_exit_for_member", { p_circle_id: circleId }),
          supabase.from("circles").select("name").eq("id", circleId).maybeSingle(),
        ]);

        if (cancelled) return;

        if (evalErr) {
          setEvalError(evalErr.message);
          setEvalLoading(false);
          return;
        }

        const ev = evalData as ExitEvaluation;
        if (!ev?.success) {
          setEvalError(ev?.error ?? "Could not evaluate exit");
        } else {
          setEvaluation(ev);
        }
        if (circleResp.data?.name) setCircleName(circleResp.data.name);
      } catch (err: any) {
        if (!cancelled) setEvalError(err?.message ?? "Unknown error");
      } finally {
        if (!cancelled) setEvalLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [circleId, user?.id]);

  const hasPayoutPending = useMemo(
    () => evaluation?.payout_entitlement_status === "pending_transfer",
    [evaluation],
  );

  const xnscoreCopy = useMemo(() => {
    if (!evaluation) return null;
    const delta = evaluation.xnscore_adjustment ?? 0;
    if (evaluation.xnscore_impact === "none") {
      return { tone: "good" as const, text: "No XnScore impact (clean exit)." };
    }
    return {
      tone: delta <= -10 ? ("bad" as const) : ("warn" as const),
      text: `Your XnScore will change by ${delta > 0 ? "+" : ""}${delta}.`,
    };
  }, [evaluation]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedReason || !acknowledged) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_exit_request", {
        p_circle_id: circleId,
        p_reason: selectedReason,
        p_acknowledged_impact: true,
      });
      if (error) {
        Alert.alert(t("leave_circle_v2.alert_could_not_submit"), error.message);
        return;
      }
      const result = data as {
        success: boolean;
        request_id?: string;
        evaluation?: ExitEvaluation;
        error?: string;
        existing_request_id?: string;
      };
      if (!result.success) {
        const detail = result.existing_request_id
          ? `${result.error}\n\nExisting request: ${result.existing_request_id}`
          : result.error ?? "Unknown error";
        Alert.alert(t("leave_circle_v2.alert_could_not_submit"), detail);
        return;
      }
      setSubmitted({
        requestId: result.request_id ?? "",
        evaluation: result.evaluation ?? (evaluation as ExitEvaluation),
      });
    } catch (err: any) {
      Alert.alert(t("leave_circle_v2.alert_could_not_submit"), err?.message ?? t("leave_circle_v2.alert_unknown_error"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Renderers ─────────────────────────────────────────────────────────────
  const renderImpact = () => {
    if (!evaluation) return null;
    return (
      <View style={styles.impactCard}>
        <Text style={styles.cardTitle}>{t("leave_circle_v2.card_what_happens")}</Text>

        <View style={styles.impactRow}>
          <Ionicons name="layers-outline" size={18} color="#2563EB" />
          <Text style={styles.impactLabel}>{t("leave_circle_v2.impact_cycles")}</Text>
          <Text style={styles.impactValue}>
            {evaluation.cycles_completed} of {evaluation.total_cycles}
            {evaluation.total_cycles && evaluation.total_cycles > 0
              ? ` (${evaluation.completion_percentage}%)`
              : ""}
          </Text>
        </View>

        <View style={styles.impactRow}>
          <Ionicons
            name={evaluation.payout_already_received ? "checkmark-circle-outline" : "time-outline"}
            size={18}
            color={evaluation.payout_already_received ? "#10B981" : "#6B7280"}
          />
          <Text style={styles.impactLabel}>{t("leave_circle_v2.impact_payout")}</Text>
          <Text style={styles.impactValue}>
            {evaluation.payout_already_received ? "Yes" : "Not yet"}
          </Text>
        </View>

        <View style={styles.impactRow}>
          <Ionicons name="calendar-outline" size={18} color="#2563EB" />
          <Text style={styles.impactLabel}>{t("leave_circle_v2.impact_notice")}</Text>
          <Text style={styles.impactValue}>{evaluation.notice_days} days</Text>
        </View>

        {xnscoreCopy && (
          <View style={styles.impactRow}>
            <Ionicons
              name="trending-down-outline"
              size={18}
              color={
                xnscoreCopy.tone === "good"
                  ? "#10B981"
                  : xnscoreCopy.tone === "warn"
                    ? "#F59E0B"
                    : "#DC2626"
              }
            />
            <Text style={styles.impactLabel}>{t("leave_circle_v2.impact_xnscore")}</Text>
            <Text
              style={[
                styles.impactValue,
                xnscoreCopy.tone === "good" && { color: "#10B981" },
                xnscoreCopy.tone === "warn" && { color: "#92400E" },
                xnscoreCopy.tone === "bad" && { color: "#DC2626" },
              ]}
            >
              {xnscoreCopy.text}
            </Text>
          </View>
        )}

        {hasPayoutPending && (
          <View style={styles.splitBlock}>
            <Text style={styles.splitTitle}>80/10/10 payout split</Text>
            <Text style={styles.splitHint}>
              Since your payout hasn't been delivered yet, it transfers when a substitute fills your seat:
            </Text>
            <View style={styles.splitRow}>
              <Text style={styles.splitLabel}>{t("leave_circle_v2.split_substitute")}</Text>
              <Text style={styles.splitValue}>
                {fmtCents(evaluation.substitute_share_cents ?? 0)}
              </Text>
            </View>
            <View style={styles.splitRow}>
              <Text style={styles.splitLabel}>{t("leave_circle_v2.split_insurance")}</Text>
              <Text style={styles.splitValue}>
                {fmtCents(evaluation.insurance_pool_share_cents ?? 0)}
              </Text>
            </View>
            <View style={styles.splitRow}>
              <Text style={styles.splitLabel}>{t("leave_circle_v2.split_you_settle")}</Text>
              <Text style={[styles.splitValue, { color: "#10B981" }]}>
                {fmtCents(evaluation.original_member_settlement_cents ?? 0)}
              </Text>
            </View>
            <View style={[styles.splitRow, styles.splitTotalRow]}>
              <Text style={styles.splitLabelTotal}>{t("leave_circle_v2.split_original")}</Text>
              <Text style={styles.splitValueTotal}>
                {fmtCents(evaluation.original_payout_amount_cents ?? 0)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderForm = () => (
    <>
      <View style={styles.warningBanner}>
        <Ionicons name="warning" size={22} color="#F59E0B" />
        <View style={styles.warningContent}>
          <Text style={styles.warningTitle}>Leaving {circleName}</Text>
          <Text style={styles.warningText}>
            Once submitted, the system will immediately search for a qualified substitute. You'll be
            notified when the match is confirmed.
          </Text>
        </View>
      </View>

      {renderImpact()}

      <Text style={styles.sectionTitle}>Why are you leaving?</Text>
      {REASON_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          style={[
            styles.reasonCard,
            selectedReason === opt.key && styles.reasonCardSelected,
          ]}
          onPress={() => setSelectedReason(opt.key)}
        >
          <View
            style={[
              styles.reasonIcon,
              selectedReason === opt.key && styles.reasonIconSelected,
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={22}
              color={selectedReason === opt.key ? "#FFFFFF" : "#6B7280"}
            />
          </View>
          <View style={styles.reasonContent}>
            <Text
              style={[
                styles.reasonLabel,
                selectedReason === opt.key && styles.reasonLabelSelected,
              ]}
            >
              {opt.uiLabel}
            </Text>
            <Text style={styles.reasonDescription}>{opt.description}</Text>
          </View>
          <View
            style={[
              styles.radioOuter,
              selectedReason === opt.key && styles.radioOuterSelected,
            ]}
          >
            {selectedReason === opt.key && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.ackRow}
        onPress={() => setAcknowledged((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acknowledged }}
      >
        <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
          {acknowledged && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <Text style={styles.ackLabel}>
          I understand the impact above and want to proceed.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!selectedReason || !acknowledged || submitting) &&
            styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedReason || !acknowledged || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.submitButtonText}>{t("leave_circle_v2.btn_submit")}</Text>
            <Ionicons name="exit-outline" size={18} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>
    </>
  );

  const renderConfirmation = () => {
    if (!submitted) return null;
    const ev = submitted.evaluation;
    return (
      <View style={styles.confirmContainer}>
        <Ionicons name="checkmark-circle" size={72} color="#10B981" />
        <Text style={styles.confirmTitle}>{t("leave_circle_v2.confirm_title")}</Text>
        <Text style={styles.confirmSubtitle}>
          The system is now searching for a qualified substitute. You'll be
          notified as soon as a match is found.
        </Text>

        <View style={styles.requestCard}>
          <Text style={styles.requestLabel}>{t("leave_circle_v2.request_label")}</Text>
          <Text style={styles.requestId} numberOfLines={1}>
            {submitted.requestId.slice(0, 8)}…{submitted.requestId.slice(-4)}
          </Text>
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>{t("leave_circle_v2.steps_title")}</Text>
          {[
            "The system automatically offered your seat to a top-ranked substitute.",
            "They have 48 hours to confirm. If they decline or time out, the system tries the next candidate.",
            `Your circle admin will be asked to approve within 24 hours of confirmation — silence auto-approves.`,
            ev.payout_entitlement_status === "pending_transfer"
              ? `Your payout splits 80/10/10 — you settle for ${fmtCents(ev.original_member_settlement_cents ?? 0)}.`
              : "Your XnScore impact will be applied when the substitution completes.",
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneButtonText}>{t("leave_circle_v2.btn_done")}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Top-level layout ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("leave_circle.header_title")}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {evalLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2563EB" />
            <Text style={styles.loadingText}>Evaluating your exit…</Text>
          </View>
        ) : evalError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={22} color="#DC2626" />
            <Text style={styles.errorText}>{evalError}</Text>
          </View>
        ) : submitted ? (
          renderConfirmation()
        ) : (
          renderForm()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBackButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  headerPlaceholder: { width: 40 },
  content: { flex: 1 },
  loadingBox: { alignItems: "center", padding: 32, gap: 12 },
  loadingText: { color: "#6B7280", fontSize: 14 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  errorText: { color: "#991B1B", fontSize: 14, flex: 1, lineHeight: 20 },
  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningContent: { marginLeft: 10, flex: 1 },
  warningTitle: { fontSize: 15, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  warningText: { fontSize: 13, color: "#92400E", lineHeight: 18 },
  impactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 12 },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 10,
  },
  impactLabel: { flex: 1, fontSize: 13, color: "#6B7280" },
  impactValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  splitBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  splitTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937", marginBottom: 4 },
  splitHint: { fontSize: 12, color: "#6B7280", lineHeight: 17, marginBottom: 10 },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  splitLabel: { fontSize: 13, color: "#4B5563" },
  splitValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  splitTotalRow: { borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 4, paddingTop: 8 },
  splitLabelTotal: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  splitValueTotal: { fontSize: 14, fontWeight: "800", color: "#1F2937" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 10 },
  reasonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reasonCardSelected: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  reasonIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reasonIconSelected: { backgroundColor: "#2563EB" },
  reasonContent: { flex: 1 },
  reasonLabel: { fontSize: 15, fontWeight: "600", color: "#1F2937" },
  reasonLabelSelected: { color: "#2563EB" },
  reasonDescription: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: { borderColor: "#2563EB" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563EB" },
  ackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  ackLabel: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 19 },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: { backgroundColor: "#9CA3AF" },
  submitButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  confirmContainer: { alignItems: "center", paddingTop: 20 },
  confirmTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    marginTop: 12,
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 12,
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  requestLabel: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  requestId: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2563EB",
    fontFamily: "monospace",
  },
  stepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    width: "100%",
    marginBottom: 18,
  },
  stepsTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 14 },
  step: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 12 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  stepText: { flex: 1, fontSize: 13, color: "#4B5563", lineHeight: 19 },
  doneButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
