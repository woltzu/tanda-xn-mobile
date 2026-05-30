// ══════════════════════════════════════════════════════════════════════════════
// screens/ApplicationFlowScreen.tsx — ADVANCE-004 application wizard
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 106-ADVANCE-004-ApplicationFlow.jsx.
//
// 3-step in-screen wizard (no nested navigator). Step state lives in
// local React state; the in-screen back button steps back through
// the wizard before falling through to navigation.goBack().
//
// Steps:
//   1. Select payout — pick which upcoming circle payout to advance against.
//   2. Advance Details — review fees, "after withholding" balance, timeline.
//   3. Agreement — 3 required checkboxes (withholding, default impact, terms).
//
// Route params (all optional — defaults match the canonical web mock):
//   user?: { name; xnScore }
//   upcomingPayouts?: PayoutOption[]
//   advanceDetails?: { amount; fee; total; rate }     ← forwarded from
//                                                       SmartCalculator
//
// Navigation:
//   - back chevron: step > 1 ? setStep(step - 1) : goBack
//   - bottom "Continue" advances step 1→2 / 2→3
//   - bottom "Confirm & Get $X Now" (step 3) → AdvanceApproval
//
// Auto-save drafts:
//   The cross-step state (selected payout, advance details snapshot, agreed
//   checkboxes) is persisted to AsyncStorage under the 'advance-application'
//   key via useFormDraft. On re-mount, a yellow banner offers Restore /
//   Discard; Restore jumps directly to the saved step with all state
//   re-hydrated. The draft is cleared on Discard and on the final
//   step 3 → AdvanceApproval handoff. Back navigation does NOT clear.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useFormDraft } from "../hooks/useFormDraft";
import { Routes } from "../lib/routes";
import type { AdvanceDraft } from "../types/advance";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";

type PayoutOption = {
  id: string;
  circleName: string;
  amount: number;
  date: string;
  maxAdvance: number;
};

type AdvanceDetails = {
  amount: number;
  fee: number;
  total: number;
  rate: number;
};

type ApplicationFlowParams = {
  upcomingPayouts?: PayoutOption[];
  advanceDetails?: AdvanceDetails;
  // Plus forwarded fields from SmartCalculator (amount, term, etc.)
  amount?: number;
  term?: number;
  rate?: number;
  fee?: number;
  total?: number;
};
type ApplicationFlowRouteProp = RouteProp<
  { ApplicationFlow: ApplicationFlowParams },
  "ApplicationFlow"
>;

const DEFAULT_PAYOUTS: PayoutOption[] = [
  { id: "p1", circleName: "Family Circle", amount: 500, date: "Feb 15, 2025", maxAdvance: 400 },
  { id: "p2", circleName: "Business Builders", amount: 800, date: "Mar 1, 2025", maxAdvance: 640 },
  { id: "p3", circleName: "Community Fund", amount: 300, date: "Mar 10, 2025", maxAdvance: 240 },
];

export default function ApplicationFlowScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<ApplicationFlowRouteProp>();

  const upcomingPayouts = route.params?.upcomingPayouts ?? DEFAULT_PAYOUTS;

  // Build advanceDetails from forwarded SmartCalculator params on first
  // render. Stored as state (rather than const) so a restored draft can
  // replay the snapshot — useful if the user returns without the original
  // route params.
  const [advanceDetails, setAdvanceDetails] = useState<AdvanceDetails>(
    () =>
      route.params?.advanceDetails ?? {
        amount: route.params?.amount ?? 300,
        fee: route.params?.fee ?? 15,
        total: route.params?.total ?? 315,
        rate: route.params?.rate ?? 9.5,
      }
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPayout, setSelectedPayout] = useState<PayoutOption | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToWithholding, setAgreedToWithholding] = useState(false);
  const [agreedToDefault, setAgreedToDefault] = useState(false);

  // ── Draft auto-save (mirrors GoalCreate / CreateCircle pattern) ─────────
  // Key 'advance-application'. Draft persists across app launches and
  // surfaces via a yellow restore banner. Saved on every step transition
  // and on every step-3 checkbox toggle. Cleared on final confirmation
  // (the step 3 → AdvanceApproval handoff) or explicit Discard.
  const { hasDraft, saveDraft, restoreDraft, clearDraft } =
    useFormDraft<AdvanceDraft>("advance-application", { step: 1 });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Helper: snapshot current state into draft shape ─────────────────────
  const buildDraft = (overrides: Partial<AdvanceDraft> = {}): AdvanceDraft => ({
    step,
    selectedPayout: selectedPayout ?? undefined,
    advanceDetails,
    termsAgreed: {
      agreedToWithholding,
      agreedToDefault,
      agreedToTerms,
    },
    ...overrides,
  });

  const handleRestoreDraft = () => {
    const d = restoreDraft();
    if (!d) {
      setBannerDismissed(true);
      return;
    }
    if (d.selectedPayout) {
      setSelectedPayout(d.selectedPayout);
    }
    if (d.advanceDetails) {
      setAdvanceDetails({
        amount: d.advanceDetails.amount,
        fee: d.advanceDetails.fee,
        total: d.advanceDetails.total,
        rate: d.advanceDetails.rate,
      });
    }
    if (d.termsAgreed) {
      setAgreedToWithholding(!!d.termsAgreed.agreedToWithholding);
      setAgreedToDefault(!!d.termsAgreed.agreedToDefault);
      setAgreedToTerms(!!d.termsAgreed.agreedToTerms);
    }
    setStep(d.step);
    setBannerDismissed(true);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setBannerDismissed(true);
  };

  // ── Checkbox setters that also persist termsAgreed ──────────────────────
  // We wrap rather than use a setter-watching useEffect so the saved value
  // reflects the toggled state immediately (no stale-closure window).
  const toggleWithholding = () => {
    const next = !agreedToWithholding;
    setAgreedToWithholding(next);
    saveDraft(
      buildDraft({
        termsAgreed: {
          agreedToWithholding: next,
          agreedToDefault,
          agreedToTerms,
        },
      })
    );
  };

  const toggleDefault = () => {
    const next = !agreedToDefault;
    setAgreedToDefault(next);
    saveDraft(
      buildDraft({
        termsAgreed: {
          agreedToWithholding,
          agreedToDefault: next,
          agreedToTerms,
        },
      })
    );
  };

  const toggleTerms = () => {
    const next = !agreedToTerms;
    setAgreedToTerms(next);
    saveDraft(
      buildDraft({
        termsAgreed: {
          agreedToWithholding,
          agreedToDefault,
          agreedToTerms: next,
        },
      })
    );
  };

  const allAgreed = agreedToTerms && agreedToWithholding && agreedToDefault;
  const canAdvance =
    step === 1 ? !!selectedPayout : step === 2 ? true : allAgreed;

  const handleBack = () => {
    // Going back keeps the draft intact — only Discard or final
    // confirmation should clear it.
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
    } else {
      navigation.goBack();
    }
  };

  const handleContinue = () => {
    if (!canAdvance) return;
    if (step < 3) {
      const nextStep = (step + 1) as 1 | 2 | 3;
      // Persist the snapshot for the *next* step so a fresh launch can
      // resume directly there. Step 2 has no editable fields so the
      // snapshot here is identical to the route-supplied values.
      saveDraft(buildDraft({ step: nextStep }));
      setStep(nextStep);
    } else {
      // Final confirmation. The advance is created downstream on
      // AdvanceApproval; we clear the draft here because "Confirm & Get $X"
      // is the user-facing point of no return. If a deferred clear is
      // preferred (only on AdvanceApproval success), that would require a
      // second-screen change.
      clearDraft();
      navigation.navigate(Routes.AdvanceApproval, {
        payoutId: selectedPayout?.id,
        amount: advanceDetails.amount,
        total: advanceDetails.total,
      });
    }
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
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Request Advance</Text>
              <Text style={styles.headerSubtitle}>Step {step} of 3</Text>
            </View>
          </View>

          {/* Progress pills */}
          <View style={styles.pillsRow}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.pill,
                  s === step && styles.pillActive,
                  s <= step && styles.pillFilled,
                ]}
              />
            ))}
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Unfinished-application draft banner — mirrors GoalCreate / CreateCircle */}
          {hasDraft && !bannerDismissed && (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>
                You have an unfinished advance application. Restore it?
              </Text>
              <View style={styles.draftBannerActions}>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleRestoreDraft}
                  accessibilityRole="button"
                  accessibilityLabel="Restore draft application"
                >
                  <Text style={styles.draftBannerButtonText}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleDiscardDraft}
                  accessibilityRole="button"
                  accessibilityLabel="Discard draft application"
                >
                  <Text style={styles.draftBannerButtonText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 1 — Select payout */}
          {step === 1 && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={styles.fieldLabel}>
                  Which circle payout do you want to advance?
                </Text>
                <Text style={styles.fieldHint}>
                  Select the payout you want to receive early. We'll
                  automatically withhold repayment when it arrives.
                </Text>

                <View style={styles.payoutList}>
                  {upcomingPayouts.map((payout) => {
                    const isSelected = selectedPayout?.id === payout.id;
                    return (
                      <TouchableOpacity
                        key={payout.id}
                        style={[
                          styles.payoutRow,
                          isSelected && styles.payoutRowSelected,
                        ]}
                        onPress={() => setSelectedPayout(payout)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={payout.circleName}
                      >
                        <View style={styles.payoutLeft}>
                          <View
                            style={[
                              styles.payoutIconBox,
                              isSelected && styles.payoutIconBoxSelected,
                            ]}
                          >
                            <Ionicons
                              name="ellipse-outline"
                              size={22}
                              color={isSelected ? "#FFFFFF" : MUTED}
                            />
                          </View>
                          <View>
                            <Text style={styles.payoutName}>
                              {payout.circleName}
                            </Text>
                            <Text style={styles.payoutDate}>
                              Payout: {payout.date}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={[
                              styles.payoutAmount,
                              isSelected && styles.payoutAmountSelected,
                            ]}
                          >
                            ${payout.amount}
                          </Text>
                          <Text style={styles.payoutMax}>
                            Up to ${payout.maxAdvance}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {selectedPayout && (
                <View style={styles.selectedBanner}>
                  <Text style={styles.selectedBannerText}>
                    <Text style={styles.selectedBannerStrong}>Selected:</Text>{" "}
                    {selectedPayout.circleName} payout of $
                    {selectedPayout.amount}
                    {"\n"}
                    <Text style={styles.selectedBannerSub}>
                      You can advance up to 80% (${selectedPayout.maxAdvance})
                    </Text>
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* STEP 2 — Advance details */}
          {step === 2 && selectedPayout && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={styles.detailsTitle}>Advance Details</Text>
                <View style={styles.detailsList}>
                  <DetailRow
                    label="Advancing from"
                    value={selectedPayout.circleName}
                  />
                  <DetailRow label="Payout date" value={selectedPayout.date} />
                  <DetailRow
                    label="Payout amount"
                    value={`$${selectedPayout.amount}`}
                  />
                  <View style={styles.divider} />
                  <DetailRow
                    label="Advance amount"
                    value={`$${advanceDetails.amount}`}
                    valueStyle={styles.tealLargeValue}
                  />
                  <DetailRow
                    label={`Advance fee (${advanceDetails.rate}%)`}
                    value={`+$${advanceDetails.fee.toFixed(2)}`}
                    valueStyle={styles.amberValue}
                  />
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabelStrong}>
                      Total withheld from payout
                    </Text>
                    <Text style={styles.detailValueBig}>
                      ${advanceDetails.total.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* After-withhold card */}
              <View style={styles.afterCard}>
                <Text style={styles.afterLabel}>After repayment, you keep:</Text>
                <Text style={styles.afterAmount}>
                  $
                  {(selectedPayout.amount - advanceDetails.total).toFixed(2)}
                </Text>
                <Text style={styles.afterSub}>
                  From your ${selectedPayout.amount} payout
                </Text>
              </View>

              {/* Timeline */}
              <View style={styles.sectionCard}>
                <Text style={styles.detailsTitle}>What happens next</Text>
                <View style={styles.timelineList}>
                  {[
                    {
                      icon: "⚡",
                      title: "Instant",
                      text: `$${advanceDetails.amount} sent to your wallet now`,
                    },
                    {
                      icon: "📅",
                      title: selectedPayout.date,
                      text: "Your circle payout arrives",
                    },
                    {
                      icon: "🔄",
                      title: "Auto-withhold",
                      text: `$${advanceDetails.total.toFixed(2)} deducted automatically`,
                    },
                    {
                      icon: "✅",
                      title: "Done",
                      text: `$${(selectedPayout.amount - advanceDetails.total).toFixed(2)} credited to your wallet`,
                    },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.timelineRow}>
                      <View style={styles.timelineIconBox}>
                        <Text style={styles.timelineIcon}>{item.icon}</Text>
                      </View>
                      <View>
                        <Text style={styles.timelineTitle}>{item.title}</Text>
                        <Text style={styles.timelineText}>{item.text}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* STEP 3 — Agreement */}
          {step === 3 && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={styles.detailsTitle}>Auto-Repayment Agreement</Text>

                <CheckboxRow
                  checked={agreedToWithholding}
                  onToggle={toggleWithholding}
                  accent={TEAL}
                  bgChecked="#F0FDFB"
                >
                  I authorize TandaXn to{" "}
                  <Text style={styles.checkboxStrong}>
                    withhold ${advanceDetails.total.toFixed(2)}
                  </Text>{" "}
                  from my {selectedPayout?.circleName} payout on{" "}
                  <Text style={styles.checkboxStrong}>{selectedPayout?.date}</Text>.
                </CheckboxRow>

                <CheckboxRow
                  checked={agreedToDefault}
                  onToggle={toggleDefault}
                  accent={AMBER}
                  bgChecked="#FEF3C7"
                >
                  I understand that if my payout is insufficient, my{" "}
                  <Text style={styles.checkboxStrong}>XnScore drops 20 points</Text>{" "}
                  and I may be restricted from circles until I repay.
                </CheckboxRow>

                <CheckboxRow
                  checked={agreedToTerms}
                  onToggle={toggleTerms}
                  accent={TEAL}
                  bgChecked="#F0FDFB"
                >
                  I have read and agree to the{" "}
                  <Text style={styles.linkText}>Advance Payout Terms</Text> and
                  understand this is not a traditional loan.
                </CheckboxRow>
              </View>

              {/* Summary card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>You receive now</Text>
                  <Text style={styles.summaryReceive}>
                    ${advanceDetails.amount}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Withheld on {selectedPayout?.date}
                  </Text>
                  <Text style={styles.summaryWithheld}>
                    ${advanceDetails.total.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            !canAdvance && styles.primaryButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!canAdvance}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdvance }}
        >
          <Text
            style={[
              styles.primaryButtonText,
              !canAdvance && styles.primaryButtonTextDisabled,
            ]}
          >
            {step < 3
              ? "Continue"
              : `Confirm & Get $${advanceDetails.amount} Now`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function CheckboxRow({
  checked,
  onToggle,
  accent,
  bgChecked,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  accent: string;
  bgChecked: string;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.checkboxRow,
        {
          backgroundColor: checked ? bgChecked : "#F5F7FA",
          borderColor: checked ? accent : BORDER,
          borderWidth: checked ? 2 : 1,
        },
      ]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.checkbox,
          checked
            ? { backgroundColor: accent, borderWidth: 0 }
            : { borderWidth: 2, borderColor: "#D1D5DB" },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
      <Text style={styles.checkboxText}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  pillsRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  pill: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  pillActive: { width: 40 },
  pillFilled: { backgroundColor: TEAL },

  contentWrap: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },
  fieldHint: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 16,
    marginTop: -8,
  },

  payoutList: { gap: 10 },
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  payoutRowSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  payoutLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  payoutIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  payoutIconBoxSelected: { backgroundColor: TEAL },
  payoutName: { fontSize: 15, fontWeight: "600", color: NAVY },
  payoutDate: { fontSize: 12, color: MUTED, marginTop: 2 },
  payoutAmount: { fontSize: 18, fontWeight: "700", color: NAVY },
  payoutAmountSelected: { color: TEAL },
  payoutMax: { fontSize: 11, color: MUTED, marginTop: 2 },

  selectedBanner: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: TEAL,
  },
  selectedBannerText: {
    fontSize: 13,
    color: "#065F46",
    lineHeight: 20,
  },
  selectedBannerStrong: { fontWeight: "700" },
  selectedBannerSub: { fontSize: 12, color: "#047857" },

  detailsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 16,
  },
  detailsList: { gap: 4 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailLabel: { fontSize: 13, color: MUTED },
  detailLabelStrong: { fontSize: 14, fontWeight: "600", color: NAVY },
  detailValue: { fontSize: 14, fontWeight: "600", color: NAVY },
  detailValueBig: { fontSize: 20, fontWeight: "700", color: NAVY },
  tealLargeValue: { fontSize: 18, fontWeight: "700", color: TEAL },
  amberValue: { fontSize: 14, fontWeight: "600", color: AMBER },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },

  afterCard: {
    backgroundColor: NAVY,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  afterLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  afterAmount: { fontSize: 28, fontWeight: "700", color: TEAL },
  afterSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
  },

  timelineList: { gap: 14 },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIcon: { fontSize: 16 },
  timelineTitle: { fontSize: 13, fontWeight: "600", color: NAVY },
  timelineText: { fontSize: 12, color: MUTED, marginTop: 2 },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: NAVY,
    lineHeight: 20,
  },
  checkboxStrong: { fontWeight: "700" },
  linkText: { color: TEAL, fontWeight: "600" },

  summaryCard: {
    backgroundColor: NAVY,
    borderRadius: 14,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  summaryReceive: { fontSize: 20, fontWeight: "700", color: TEAL },
  summaryWithheld: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: BORDER },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  primaryButtonTextDisabled: { color: "#9CA3AF" },

  // Draft restore banner — same shape as GoalCreate / CreateCircle.
  draftBanner: {
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  draftBannerText: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    fontWeight: "500",
  },
  draftBannerActions: { flexDirection: "row", alignItems: "center" },
  draftBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginLeft: 8,
  },
  draftBannerButtonText: { color: "#D97706", fontWeight: "600", fontSize: 13 },
});
