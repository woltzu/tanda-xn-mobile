// ══════════════════════════════════════════════════════════════════════════════
// screens/CreateCircleWizardFormScreen.tsx — merged Details + Schedule.
// ══════════════════════════════════════════════════════════════════════════════
//
// Bucket B of the Create-a-circle review. Replaces the prior
// Details + Schedule two-screen hop with a single scrolling form, so
// users picking a non-traditional circle type only navigate through:
//
//   CreateCircleStart  →  CreateCircleWizardForm  →  CreateCircleInvite
//                                                  → CreateCircleSuccess
//
// Sections (top to bottom):
//   1. Basics            name / amount / frequency / member count
//   2. Type extras       conditional on circleType
//                        • beneficiary → recipient name + reason + phone
//                        • goal        → totalCycles
//                        • emergency   → target community id
//   3. Schedule          start date / rotation method / grace period
//                        + (Bucket A) live cycle-date preview
//                        + (Bucket A) rotation method tooltip
//
// The draft persists across step navigations via useFormDraft<CircleDraft>
// (debounced AsyncStorage save). Forward navigation passes a typed flat
// param object to CreateCircleInvite — no `as any` casts on this leg.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { RootStackParamList } from "../App";
import { useAuth } from "../context/AuthContext";
import { useFormDraft } from "../hooks/useFormDraft";
import {
  CIRCLE_DRAFT_KEY,
  type CircleDraft,
  type CircleType,
  type CircleFrequency,
  type CircleRotationMethod,
} from "../lib/circleDraft";
import {
  computeCycleDates,
  formatDateForPreview,
} from "../lib/circleSchedule";

type WizardFormNavigationProp = StackNavigationProp<
  RootStackParamList,
  "CreateCircleWizardForm"
>;
type WizardFormRouteProp = RouteProp<
  RootStackParamList,
  "CreateCircleWizardForm"
>;

const FREQUENCIES: CircleFrequency[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
];
const ROTATIONS: CircleRotationMethod[] = ["xnscore", "random", "manual"];
const GRACE_OPTIONS = [0, 1, 2, 3] as const;

// Smart-default start date for a frequency. Mirrors the Express screen's
// helper so the wizard's seed matches the user's expectation when they
// land here from Start without prior Schedule state.
function nextStartDateFor(freq: CircleFrequency): Date {
  const now = new Date();
  if (freq === "daily") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (freq === "weekly" || freq === "biweekly") {
    const d = new Date(now);
    const dow = d.getDay();
    const days = ((8 - dow) % 7) || 7;
    d.setDate(d.getDate() + days);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function CreateCircleWizardFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<WizardFormNavigationProp>();
  const route = useRoute<WizardFormRouteProp>();
  const { user } = useAuth();

  // Initial values: route params (passed forward from Start) take precedence,
  // then the persisted draft, then defaults. The draft load is async so we
  // hydrate from it in a useEffect once useFormDraft fires.
  const incoming = route.params?.draft ?? ({} as CircleDraft);
  const circleType: CircleType = incoming.circleType ?? "traditional";

  const { draft, saveDraft } = useFormDraft<CircleDraft>(CIRCLE_DRAFT_KEY, {
    circleType,
  });

  // Bucket C — first-visit explainer. One-shot modal that explains what
  // the Advanced wizard adds over Express. Gated by AsyncStorage so it
  // only ever fires once per install. AsyncStorage failures fall through
  // silently — worst case the user just doesn't see the explainer this
  // session, no functional impact.
  const ADVANCED_FIRST_SEEN_KEY = "@tandaxn_advanced_first_seen";
  const [showAdvancedExplainer, setShowAdvancedExplainer] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ADVANCED_FIRST_SEEN_KEY)
      .then((v) => {
        if (cancelled) return;
        if (!v) setShowAdvancedExplainer(true);
      })
      .catch(() => {
        // ignore — no nag on storage failure
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissAdvancedExplainer = () => {
    setShowAdvancedExplainer(false);
    AsyncStorage.setItem(ADVANCED_FIRST_SEEN_KEY, "1").catch(() => undefined);
  };

  // ── Form state — Basics ─────────────────────────────────────────────
  const [name, setName] = useState<string>(incoming.name ?? "");
  const [amount, setAmount] = useState<string>(
    incoming.amount != null ? String(incoming.amount) : "",
  );
  const [frequency, setFrequency] = useState<CircleFrequency>(
    incoming.frequency ?? "monthly",
  );
  const [memberCount, setMemberCount] = useState<number>(
    incoming.memberCount ?? 6,
  );
  const [memberCountText, setMemberCountText] = useState<string>(
    String(incoming.memberCount ?? 6),
  );

  // ── Form state — Type extras ────────────────────────────────────────
  const [beneficiaryName, setBeneficiaryName] = useState<string>(
    incoming.beneficiaryName ?? "",
  );
  const [beneficiaryReason, setBeneficiaryReason] = useState<string>(
    incoming.beneficiaryReason ?? "",
  );
  const [beneficiaryPhone, setBeneficiaryPhone] = useState<string>(
    incoming.beneficiaryPhone ?? "",
  );
  const [totalCycles, setTotalCycles] = useState<number>(
    incoming.totalCycles ?? 1,
  );
  const [totalCyclesText, setTotalCyclesText] = useState<string>(
    String(incoming.totalCycles ?? 1),
  );
  const [targetCommunityId, setTargetCommunityId] = useState<string>(
    incoming.targetCommunityId != null
      ? String(incoming.targetCommunityId)
      : "",
  );

  // ── Form state — Schedule ───────────────────────────────────────────
  const initialStart = incoming.startDate
    ? new Date(incoming.startDate)
    : nextStartDateFor(incoming.frequency ?? "monthly");
  const [startDate, setStartDate] = useState<Date>(initialStart);
  const [startDateTouched, setStartDateTouched] = useState<boolean>(
    !!incoming.startDate,
  );
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [rotationMethod, setRotationMethod] = useState<CircleRotationMethod>(
    incoming.rotationMethod ?? "xnscore",
  );
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(
    incoming.gracePeriodDays ?? 2,
  );

  // Hydrate from persisted draft once it lands — but only if no incoming
  // route params overrode (the route params take precedence when both
  // exist). This covers the "user backgrounded the app mid-wizard" path.
  useEffect(() => {
    if (!draft || incoming.name != null) return;
    if (draft.name) setName(draft.name);
    if (typeof draft.amount === "number") setAmount(String(draft.amount));
    if (draft.frequency) setFrequency(draft.frequency);
    if (typeof draft.memberCount === "number") {
      setMemberCount(draft.memberCount);
      setMemberCountText(String(draft.memberCount));
    }
    if (draft.beneficiaryName) setBeneficiaryName(draft.beneficiaryName);
    if (draft.beneficiaryReason) setBeneficiaryReason(draft.beneficiaryReason);
    if (draft.beneficiaryPhone) setBeneficiaryPhone(draft.beneficiaryPhone);
    if (typeof draft.totalCycles === "number") {
      setTotalCycles(draft.totalCycles);
      setTotalCyclesText(String(draft.totalCycles));
    }
    if (draft.targetCommunityId != null) {
      setTargetCommunityId(String(draft.targetCommunityId));
    }
    if (draft.startDate) {
      setStartDate(new Date(draft.startDate));
      setStartDateTouched(true);
    }
    if (draft.rotationMethod) setRotationMethod(draft.rotationMethod);
    if (typeof draft.gracePeriodDays === "number") {
      setGracePeriodDays(draft.gracePeriodDays);
    }
  }, [draft, incoming.name]);

  // Auto-recompute start date when frequency changes (unless user picked).
  const handleFrequencyChange = (f: CircleFrequency) => {
    setFrequency(f);
    if (!startDateTouched) setStartDate(nextStartDateFor(f));
  };

  // Validate the basics — type-specific extras are validated separately
  // below so the Next button shows the user *which* required field is
  // missing on its first tap.
  const numericAmount = parseFloat(amount) || 0;
  const isBasicsValid =
    name.trim().length >= 2 &&
    numericAmount > 0 &&
    memberCount >= 2 &&
    memberCount <= 100;

  const isBeneficiaryValid =
    circleType !== "beneficiary" ||
    (beneficiaryName.trim().length >= 1 &&
      beneficiaryReason.trim().length >= 1);

  const isValid = isBasicsValid && isBeneficiaryValid;

  // Bucket A — live cycle-date preview, same helper Express uses.
  const cycleDates = useMemo(
    () =>
      computeCycleDates({
        startDate,
        frequency,
        memberCount,
        totalCycles:
          circleType === "goal" ? totalCycles : undefined,
      }),
    [startDate, frequency, memberCount, circleType, totalCycles],
  );
  const previewCycles = cycleDates.slice(0, 3);
  const remainingCycles = Math.max(0, cycleDates.length - previewCycles.length);

  // Rotation help — same Alert pattern + i18n keys Express uses.
  const handleShowRotationHelp = () => {
    Alert.alert(
      t("create_circle_express.payout_help_title"),
      t("create_circle_express.payout_help_body"),
    );
  };

  const handleMemberCountChange = (txt: string) => {
    const cleaned = txt.replace(/[^0-9]/g, "");
    setMemberCountText(cleaned);
    const n = parseInt(cleaned, 10);
    if (!isNaN(n) && n >= 2) setMemberCount(n);
  };

  const handleTotalCyclesChange = (txt: string) => {
    const cleaned = txt.replace(/[^0-9]/g, "");
    setTotalCyclesText(cleaned);
    const n = parseInt(cleaned, 10);
    if (!isNaN(n) && n >= 1) setTotalCycles(n);
  };

  // Forward navigation. Merges the form state into the draft, persists,
  // and hands a typed flat payload to CreateCircleInvite — no `as any`.
  const handleNext = () => {
    if (!isValid) return;
    const trimmedName = name.trim();
    const startIso = toIsoDate(startDate);

    const nextDraft: CircleDraft = {
      circleType,
      name: trimmedName,
      amount: numericAmount,
      frequency,
      memberCount,
      startDate: startIso,
      rotationMethod,
      gracePeriodDays,
    };
    if (circleType === "beneficiary") {
      nextDraft.beneficiaryName = beneficiaryName.trim();
      nextDraft.beneficiaryReason = beneficiaryReason.trim();
      nextDraft.beneficiaryPhone = beneficiaryPhone.trim() || undefined;
    }
    if (circleType === "goal") {
      nextDraft.totalCycles = totalCycles;
    }
    if (circleType === "emergency" && targetCommunityId) {
      nextDraft.targetCommunityId = targetCommunityId;
    }
    saveDraft(nextDraft);

    navigation.navigate("CreateCircleInvite", {
      circleType,
      name: trimmedName,
      amount: numericAmount,
      frequency,
      memberCount,
      startDate: startIso,
      rotationMethod,
      gracePeriodDays,
      beneficiaryName: nextDraft.beneficiaryName,
      beneficiaryReason: nextDraft.beneficiaryReason,
      beneficiaryPhone: nextDraft.beneficiaryPhone,
      totalCycles: nextDraft.totalCycles,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex1}
      >
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("common.back", { defaultValue: "Back" })}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>
                {t("create_circle_wizard.header_title")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("create_circle_wizard.header_subtitle")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Section: Basics ──────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>
            {t("create_circle_wizard.section_basics")}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_name")}
              <Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("create_circle_express.placeholder_name")}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              maxLength={60}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_amount")}
              <Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
              placeholder="100"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              maxLength={9}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_frequency")}
            </Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => {
                const isSel = frequency === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, isSel && styles.chipSelected]}
                    onPress={() => handleFrequencyChange(f)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSel && styles.chipTextSelected,
                      ]}
                    >
                      {t(`create_circle_express.freq_${f}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_member_count")}
              <Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={memberCountText}
              onChangeText={handleMemberCountChange}
              placeholder="6"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          {/* ── Section: Type extras (conditional) ───────────────────── */}
          {circleType === "beneficiary" ? (
            <>
              <Text style={styles.sectionTitle}>
                {t("create_circle_wizard.section_beneficiary")}
              </Text>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_wizard.label_beneficiary_name")}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={beneficiaryName}
                  onChangeText={setBeneficiaryName}
                  placeholder={t(
                    "create_circle_wizard.placeholder_beneficiary_name",
                  )}
                  placeholderTextColor="#9CA3AF"
                  maxLength={80}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_wizard.label_beneficiary_reason")}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={beneficiaryReason}
                  onChangeText={setBeneficiaryReason}
                  placeholder={t(
                    "create_circle_wizard.placeholder_beneficiary_reason",
                  )}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={200}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_wizard.label_beneficiary_phone")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={beneficiaryPhone}
                  onChangeText={setBeneficiaryPhone}
                  placeholder="+1 555 0123"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  maxLength={20}
                />
              </View>
            </>
          ) : null}

          {circleType === "goal" ? (
            <>
              <Text style={styles.sectionTitle}>
                {t("create_circle_wizard.section_goal")}
              </Text>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_wizard.label_total_cycles")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={totalCyclesText}
                  onChangeText={handleTotalCyclesChange}
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.helpText}>
                  {t("create_circle_wizard.help_total_cycles")}
                </Text>
              </View>
            </>
          ) : null}

          {circleType === "emergency" ? (
            <>
              <Text style={styles.sectionTitle}>
                {t("create_circle_wizard.section_emergency")}
              </Text>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("create_circle_wizard.label_community_id")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={targetCommunityId}
                  onChangeText={setTargetCommunityId}
                  placeholder={t(
                    "create_circle_wizard.placeholder_community_id",
                  )}
                  placeholderTextColor="#9CA3AF"
                  maxLength={60}
                />
                <Text style={styles.helpText}>
                  {t("create_circle_wizard.help_community_id")}
                </Text>
              </View>
            </>
          ) : null}

          {/* ── Section: Schedule ────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>
            {t("create_circle_wizard.section_schedule")}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_start_date")}
            </Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color="#0A2342" />
              <Text style={styles.dateBtnText}>
                {formatDateLabel(startDate)}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6B7280" />
            </TouchableOpacity>
            {showDatePicker ? (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={(() => {
                  const m = new Date();
                  m.setDate(m.getDate() + 1);
                  return m;
                })()}
                onChange={(_e, selected) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selected) {
                    setStartDate(selected);
                    setStartDateTouched(true);
                  }
                }}
              />
            ) : null}
          </View>

          {/* Live cycle-date preview — same helper Express uses. */}
          {previewCycles.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.label}>
                {t("create_circle_express.cycle_dates_label")}
              </Text>
              <View style={styles.cyclePreviewRow}>
                {previewCycles.map((d, i) => (
                  <View key={i} style={styles.cycleChip}>
                    <Text style={styles.cycleChipText}>
                      {t("create_circle_express.cycle_date_format", {
                        cycle: i + 1,
                        date: formatDateForPreview(d),
                      })}
                    </Text>
                  </View>
                ))}
                {remainingCycles > 0 ? (
                  <View style={[styles.cycleChip, styles.cycleChipMore]}>
                    <Text style={styles.cycleChipMoreText}>
                      {t("create_circle_express.cycle_more", {
                        count: remainingCycles,
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Rotation method + Bucket A tooltip + preview line. */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                {t("create_circle_express.label_rotation")}
              </Text>
              <TouchableOpacity
                onPress={handleShowRotationHelp}
                accessibilityRole="button"
                accessibilityLabel={t(
                  "create_circle_express.payout_help_title",
                )}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={16}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.chipRow}>
              {ROTATIONS.map((r) => {
                const isSel = rotationMethod === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, isSel && styles.chipSelected]}
                    onPress={() => setRotationMethod(r)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSel && styles.chipTextSelected,
                      ]}
                    >
                      {t(`create_circle_express.rotation_${r}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.payoutPreview}>
              {rotationMethod === "xnscore"
                ? t("create_circle_express.payout_preview_xnscore", {
                    score: user?.xnScore ?? 0,
                  })
                : rotationMethod === "random"
                  ? t("create_circle_express.payout_preview_random")
                  : t("create_circle_express.payout_preview_manual")}
            </Text>
          </View>

          {/* Grace period */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t("create_circle_express.label_grace")}
            </Text>
            <View style={styles.chipRow}>
              {GRACE_OPTIONS.map((g) => {
                const isSel = gracePeriodDays === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, isSel && styles.chipSelected]}
                    onPress={() => setGracePeriodDays(g)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSel && styles.chipTextSelected,
                      ]}
                    >
                      {g === 0
                        ? t("create_circle_express.grace_none")
                        : t("create_circle_express.grace_days", { count: g })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.nextBtn,
              !isValid && styles.nextBtnDisabled,
            ]}
            onPress={handleNext}
            disabled={!isValid}
            accessibilityRole="button"
          >
            <Text style={styles.nextBtnText}>
              {t("create_circle_wizard.next_btn")}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Bucket C — first-visit explainer modal. Single slide + "Got
          it" button. Dismiss writes the AsyncStorage flag so it never
          shows again. */}
      <Modal
        visible={showAdvancedExplainer}
        transparent
        animationType="fade"
        onRequestClose={dismissAdvancedExplainer}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons
              name="compass-outline"
              size={36}
              color="#00C6AE"
              style={styles.modalIcon}
            />
            <Text style={styles.modalTitle}>
              {t("create_circle_wizard.advanced_explainer_title")}
            </Text>
            <Text style={styles.modalBody}>
              {t("create_circle_wizard.advanced_explainer_body")}
            </Text>
            <Pressable
              onPress={dismissAdvancedExplainer}
              style={styles.modalBtn}
              accessibilityRole="button"
            >
              <Text style={styles.modalBtnText}>
                {t("create_circle_wizard.advanced_explainer_btn")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  flex1: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    marginTop: 2,
  },
  scrollContent: { padding: 20, paddingBottom: 140 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 6,
  },
  field: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  required: { color: "#DC2626" },
  helpText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 6,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipSelected: {
    backgroundColor: "#0A2342",
    borderColor: "#0A2342",
  },
  chipText: { fontSize: 13, color: "#0A2342", fontWeight: "600" },
  chipTextSelected: { color: "#FFFFFF" },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dateBtnText: { flex: 1, fontSize: 14, color: "#0A2342", fontWeight: "600" },
  cyclePreviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cycleChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  cycleChipText: { fontSize: 12, fontWeight: "600", color: "#4F46E5" },
  cycleChipMore: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  cycleChipMoreText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  payoutPreview: {
    fontSize: 12,
    color: "#374151",
    fontStyle: "italic",
    marginTop: 10,
    lineHeight: 17,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#00C6AE",
  },
  nextBtnDisabled: { backgroundColor: "#9CA3AF" },
  nextBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  // ----- Bucket C — first-visit explainer modal -----
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
  modalIcon: { marginBottom: 12 },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 10,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  modalBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#00C6AE",
  },
  modalBtnText: { fontSize: 13, color: "#FFFFFF", fontWeight: "700" },
});
