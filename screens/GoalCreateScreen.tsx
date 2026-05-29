// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalCreateScreen.tsx — GOALS-005 (v2: Savings Type)
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 156-GOALS-005-GoalCreate-v2.jsx.
//
// Create a savings goal with one of three savings types:
//   FLEXIBLE  — 0% APY, withdraw anytime, no penalty, no minimum
//   EMERGENCY — 2% APY, valid emergencies only, 10% penalty, $500 min
//   LOCKED    — 4% APY (+ term bonus), at maturity only, 10% penalty, $1,000 min
//
// Route params (all optional — sensible defaults applied):
//   goalType?:       { id; emoji; name; description; suggestedTarget; suggestedMonthly }
//   availableCircles?: { id; name; monthlyPayout }[]
//
// NAMING — this is a *new* v2 screen. It does NOT overwrite the existing
// CreateGoal route/screen; route name (added later) will be `GoalCreate`.
//
// NAVIGATION — `onBack` → goBack(); "Create Goal" builds a mock goal
// object and navigates to GoalSetupSuccess { goal }. The "Link a Circle"
// picker is fully in-screen (no navigation), faithful to the web design.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useFormDraft } from "../hooks/useFormDraft";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const RED = "#DC2626";
const GREEN = "#059669";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type SavingsTypeId = "flexible" | "emergency" | "locked";

type LockPeriod = { months: number; label: string; bonus: number };

type SavingsType = {
  id: SavingsTypeId;
  name: string;
  emoji: string;
  tagline: string;
  apy: number;
  minBalance: number;
  withdrawalRule: string;
  penalty: string | null;
  penaltyPercent: number;
  color: string;
  bgColor: string;
  validReasons?: string[];
  lockPeriods?: LockPeriod[];
};

const SAVINGS_TYPES: Record<SavingsTypeId, SavingsType> = {
  flexible: {
    id: "flexible",
    name: "Flexible",
    emoji: "🔓",
    tagline: "Full access anytime",
    apy: 0,
    minBalance: 0,
    withdrawalRule: "Withdraw anytime, no restrictions",
    penalty: null,
    penaltyPercent: 0,
    color: "#6B7280",
    bgColor: "#F5F7FA",
  },
  emergency: {
    id: "emergency",
    name: "Emergency Fund",
    emoji: "🛡️",
    tagline: "Protected savings",
    apy: 2,
    minBalance: 500,
    withdrawalRule: "Only for valid emergencies",
    penalty: "10% penalty for non-emergency withdrawals",
    penaltyPercent: 10,
    validReasons: [
      "Medical emergency",
      "Job loss / income disruption",
      "Essential home repair",
      "Family emergency",
      "Unexpected essential travel",
      "Legal emergency",
    ],
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
  locked: {
    id: "locked",
    name: "Locked Savings",
    emoji: "🔒",
    tagline: "Maximum returns",
    apy: 4,
    minBalance: 1000,
    withdrawalRule: "No access until lock period ends",
    penalty: "10% penalty for ANY early withdrawal",
    penaltyPercent: 10,
    lockPeriods: [
      { months: 6, label: "6 months", bonus: 0 },
      { months: 12, label: "1 year", bonus: 0.5 },
      { months: 24, label: "2 years", bonus: 1.0 },
    ],
    color: "#059669",
    bgColor: "#F0FDFB",
  },
};

type GoalType = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  suggestedTarget?: number;
  suggestedMonthly?: number;
};

type Circle = { id: string; name: string; monthlyPayout: number };

type GoalCreateParams = {
  goalType?: GoalType;
  availableCircles?: Circle[];
};
type GoalCreateRouteProp = RouteProp<
  { GoalCreate: GoalCreateParams },
  "GoalCreate"
>;

const DEFAULT_GOAL_TYPE: GoalType = {
  id: "first_home",
  emoji: "🏠",
  name: "First Home",
  description: "Down payment and closing costs",
  suggestedTarget: 40000,
  suggestedMonthly: 800,
};

const DEFAULT_CIRCLES: Circle[] = [
  { id: "c1", name: "Home Buyers Circle", monthlyPayout: 2000 },
  { id: "c2", name: "Abidjan Savings", monthlyPayout: 500 },
];

const SUGGESTED_AMOUNTS = [5000, 10000, 25000, 50000];

type GoalDraft = {
  goalName: string;
  targetAmount: number;
  monthlyContribution: number;
  autoDeposit: boolean;
  linkedCircleId: string | null;
  savingsType: SavingsTypeId;
  lockPeriodMonths: number;
};

export default function GoalCreateScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalCreateRouteProp>();

  const goalType = route.params?.goalType ?? DEFAULT_GOAL_TYPE;
  const availableCircles = route.params?.availableCircles ?? DEFAULT_CIRCLES;

  // Savings type selection
  const [savingsType, setSavingsType] = useState<SavingsTypeId>("emergency");
  const [lockPeriodMonths, setLockPeriodMonths] = useState(12);

  // Goal details
  const [goalName, setGoalName] = useState(goalType.name);
  const [targetAmount, setTargetAmount] = useState(
    goalType.suggestedTarget || 25000
  );
  const [monthlyContribution, setMonthlyContribution] = useState(
    goalType.suggestedMonthly || 500
  );
  const [autoDeposit, setAutoDeposit] = useState(true);
  const [linkedCircleId, setLinkedCircleId] = useState<string | null>(null);
  const [showCircleSelect, setShowCircleSelect] = useState(false);

  // ── Auto-save draft (Phase C) ────────────────────────────────────────────
  const { hasDraft, saveDraft, restoreDraft, clearDraft } =
    useFormDraft<GoalDraft>("goal_create", {
      goalName: goalType.name,
      targetAmount: goalType.suggestedTarget || 25000,
      monthlyContribution: goalType.suggestedMonthly || 500,
      autoDeposit: true,
      linkedCircleId: null,
      savingsType: "emergency",
      lockPeriodMonths: 12,
    });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const isFirstDraftRender = useRef(true);

  // Persist edits (debounced). Skip the very first run so the initial/default
  // values don't clobber a freshly loaded draft before the user can restore.
  useEffect(() => {
    if (isFirstDraftRender.current) {
      isFirstDraftRender.current = false;
      return;
    }
    saveDraft({
      goalName,
      targetAmount,
      monthlyContribution,
      autoDeposit,
      linkedCircleId,
      savingsType,
      lockPeriodMonths,
    });
  }, [
    goalName,
    targetAmount,
    monthlyContribution,
    autoDeposit,
    linkedCircleId,
    savingsType,
    lockPeriodMonths,
    saveDraft,
  ]);

  const handleRestoreDraft = () => {
    const d = restoreDraft();
    if (d) {
      setGoalName(d.goalName);
      setTargetAmount(d.targetAmount);
      setMonthlyContribution(d.monthlyContribution);
      setAutoDeposit(d.autoDeposit);
      setLinkedCircleId(d.linkedCircleId);
      setSavingsType(d.savingsType);
      setLockPeriodMonths(d.lockPeriodMonths);
    }
    setBannerDismissed(true);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setBannerDismissed(true);
  };
  // ──────────────────────────────────────────────────────────────────────────

  const selectedType = SAVINGS_TYPES[savingsType];

  // Effective APY (locked gets a bonus for longer terms)
  const getEffectiveApy = () => {
    if (savingsType === "locked") {
      const period = SAVINGS_TYPES.locked.lockPeriods?.find(
        (p) => p.months === lockPeriodMonths
      );
      return SAVINGS_TYPES.locked.apy + (period?.bonus || 0);
    }
    return selectedType.apy;
  };

  // Timeline
  const monthsToGoal = Math.ceil(targetAmount / (monthlyContribution || 1));
  const estimatedDate = new Date();
  estimatedDate.setMonth(estimatedDate.getMonth() + monthsToGoal);
  const estimatedDateStr = estimatedDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  // Lock end date (locked type)
  const lockEndDate = new Date();
  lockEndDate.setMonth(lockEndDate.getMonth() + lockPeriodMonths);
  const lockEndDateStr = lockEndDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Validation
  const meetsMinimum = targetAmount >= selectedType.minBalance;
  const canCreate = goalName.trim().length > 0 && targetAmount > 0 && meetsMinimum;

  const linkedCircle = availableCircles.find((c) => c.id === linkedCircleId);

  const handleCreate = () => {
    if (!canCreate) return;
    const apy = getEffectiveApy();
    // Mock goal object. Kept comprehensive on purpose: GoalSetupSuccess
    // reads name/target/monthly/autoDeposit/estimatedAchieveDate/interestRate,
    // and it later forwards this same object to GoalDetailV2 — which reads
    // balance/interestEarned/dailyInterest/progressPercent/daysActive etc.
    // Including zeroed defaults here avoids missing-field crashes downstream.
    // Real persistence via SavingsContext lands later.
    const newGoal = {
      id: "new-" + Date.now(),
      name: goalName,
      emoji: goalType.emoji,
      category: goalType.name,
      balance: 0,
      target: targetAmount,
      interestEarned: 0,
      dailyInterest: 0,
      progressPercent: 0,
      daysActive: 0,
      isOnTrack: true,
      monthlyContribution,
      autoDepositEnabled: autoDeposit,
      linkedCircle: null,
      startDate: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      targetDate: estimatedDateStr,
      estimatedAchieveDate: estimatedDateStr,
      savingsType,
      apy,
      interestRate: apy,
      lockPeriodMonths: savingsType === "locked" ? lockPeriodMonths : null,
      lockEndDate: savingsType === "locked" ? lockEndDate.toISOString() : null,
    };
    clearDraft();
    navigation.navigate(Routes.GoalSetupSuccess, { goal: newGoal });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ===== HEADER ===== */}
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
            <Text style={styles.headerTitle}>Create Goal</Text>
          </View>

          {/* Goal type preview */}
          <View style={styles.goalPreview}>
            <View style={styles.goalPreviewEmojiBox}>
              <Text style={styles.goalPreviewEmoji}>{goalType.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalPreviewName}>{goalType.name}</Text>
              <Text style={styles.goalPreviewDesc}>{goalType.description}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Unfinished-goal draft banner (Phase C) */}
          {hasDraft && !bannerDismissed && (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerText}>
                You have an unfinished goal. Restore it?
              </Text>
              <View style={styles.draftBannerActions}>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleRestoreDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.draftBannerButton}
                  onPress={handleDiscardDraft}
                  accessibilityRole="button"
                >
                  <Text style={styles.draftBannerButtonText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Savings type selection */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitleEmoji}>💰</Text>
              <Text style={styles.cardTitle}>Savings Type</Text>
            </View>
            <Text style={styles.cardHelp}>
              Choose how accessible your savings should be. Less access = higher
              interest.
            </Text>

            <View style={{ gap: 10 }}>
              {(Object.values(SAVINGS_TYPES) as SavingsType[]).map((type) => {
                const isSelected = savingsType === type.id;
                const iconBg =
                  type.id === "flexible"
                    ? "#E5E7EB"
                    : type.id === "emergency"
                    ? "#FEF3C7"
                    : "#D1FAE5";
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setSavingsType(type.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.typeCard,
                      isSelected && {
                        borderWidth: 2,
                        borderColor: type.color,
                        backgroundColor: type.bgColor,
                        margin: -1,
                      },
                    ]}
                  >
                    <View style={styles.typeCardTop}>
                      <View style={styles.typeCardLeft}>
                        <View
                          style={[styles.typeIconBox, { backgroundColor: iconBg }]}
                        >
                          <Text style={styles.typeIconEmoji}>{type.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.typeName}>{type.name}</Text>
                          <Text style={styles.typeTagline}>{type.tagline}</Text>
                          <Text
                            style={[
                              styles.typeRule,
                              { color: type.penalty ? RED : GREEN },
                            ]}
                          >
                            {type.withdrawalRule}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={[
                            styles.typeApy,
                            { color: type.apy > 0 ? GREEN : "#9CA3AF" },
                          ]}
                        >
                          {type.apy}%
                        </Text>
                        <Text style={styles.typeApyLabel}>APY</Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View style={styles.typeExpanded}>
                        {type.minBalance > 0 && (
                          <Text style={styles.typeDetailMuted}>
                            • Minimum balance: ${type.minBalance.toLocaleString()}
                          </Text>
                        )}
                        {type.penalty && (
                          <Text style={styles.typeDetailRed}>
                            • {type.penalty}
                          </Text>
                        )}
                        {type.id === "emergency" && (
                          <Text style={styles.typeDetailGreen}>
                            • No penalty for: medical, job loss, family
                            emergencies
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Lock period (locked only) */}
          {savingsType === "locked" && (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitleEmoji}>📅</Text>
                <Text style={styles.cardTitle}>Lock Period</Text>
              </View>
              <Text style={styles.cardHelp}>
                Longer lock = higher interest. You cannot withdraw until this
                period ends.
              </Text>

              <View style={styles.lockRow}>
                {SAVINGS_TYPES.locked.lockPeriods?.map((period) => {
                  const isActive = lockPeriodMonths === period.months;
                  return (
                    <TouchableOpacity
                      key={period.months}
                      onPress={() => setLockPeriodMonths(period.months)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      style={[
                        styles.lockButton,
                        isActive && {
                          borderWidth: 2,
                          borderColor: GREEN,
                          backgroundColor: "#F0FDFB",
                          margin: -1,
                        },
                      ]}
                    >
                      <Text style={styles.lockLabel}>{period.label}</Text>
                      <Text style={styles.lockApy}>
                        {SAVINGS_TYPES.locked.apy + period.bonus}% APY
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.lockWarn}>
                <Text style={styles.lockWarnEmoji}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lockWarnTitle}>
                    Locked until {lockEndDateStr}
                  </Text>
                  <Text style={styles.lockWarnBody}>
                    10% penalty for any early withdrawal
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Goal name */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>GOAL NAME</Text>
            <TextInput
              value={goalName}
              onChangeText={setGoalName}
              placeholder="e.g., First Home in Atlanta"
              placeholderTextColor="#9CA3AF"
              style={styles.textInput}
            />
          </View>

          {/* Target amount */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>TARGET AMOUNT</Text>
            <View
              style={[
                styles.amountInputWrap,
                !meetsMinimum && { borderWidth: 2, borderColor: RED },
              ]}
            >
              <Text style={styles.amountCurrency}>$</Text>
              <TextInput
                value={String(targetAmount)}
                onChangeText={(t) =>
                  setTargetAmount(Number(t.replace(/[^0-9.]/g, "")) || 0)
                }
                keyboardType="numeric"
                style={styles.amountInput}
              />
            </View>

            {!meetsMinimum && (
              <Text style={styles.errorText}>
                ⚠️ {selectedType.name} requires minimum $
                {selectedType.minBalance.toLocaleString()}
              </Text>
            )}

            <View style={styles.quickRow}>
              {SUGGESTED_AMOUNTS.map((amt) => {
                const isActive = targetAmount === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setTargetAmount(amt)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={[styles.quickPill, isActive && styles.quickPillActive]}
                  >
                    <Text
                      style={[
                        styles.quickPillText,
                        isActive && styles.quickPillTextActive,
                      ]}
                    >
                      ${(amt / 1000).toFixed(0)}k
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Monthly contribution */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>MONTHLY CONTRIBUTION</Text>
            <View style={styles.monthlyRow}>
              <TouchableOpacity
                onPress={() =>
                  setMonthlyContribution(Math.max(50, monthlyContribution - 50))
                }
                accessibilityRole="button"
                accessibilityLabel="Decrease monthly contribution"
                style={styles.stepperButton}
              >
                <Ionicons name="remove" size={20} color={NAVY} />
              </TouchableOpacity>

              <View style={styles.monthlyDisplay}>
                <Text style={styles.monthlyValue}>${monthlyContribution}</Text>
                <Text style={styles.monthlyUnit}>/month</Text>
              </View>

              <TouchableOpacity
                onPress={() => setMonthlyContribution(monthlyContribution + 50)}
                accessibilityRole="button"
                accessibilityLabel="Increase monthly contribution"
                style={styles.stepperButton}
              >
                <Ionicons name="add" size={20} color={NAVY} />
              </TouchableOpacity>
            </View>

            {/* Timeline estimate */}
            <View style={styles.timelineBox}>
              <View style={styles.timelineLeft}>
                <Text style={styles.timelineEmoji}>🎯</Text>
                <View>
                  <Text style={styles.timelineLabel}>Estimated completion</Text>
                  <Text style={styles.timelineDate}>{estimatedDateStr}</Text>
                </View>
              </View>
              <Text style={styles.timelineMonths}>~{monthsToGoal} months</Text>
            </View>
          </View>

          {/* Auto-deposit toggle */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleEmoji}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Auto-Deposit</Text>
                  <Text style={styles.toggleBody}>
                    Save ${monthlyContribution} automatically each month
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setAutoDeposit(!autoDeposit)}
                accessibilityRole="switch"
                accessibilityState={{ checked: autoDeposit }}
                accessibilityLabel="Auto-deposit"
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: autoDeposit ? TEAL : BORDER,
                    alignItems: autoDeposit ? "flex-end" : "flex-start",
                  },
                ]}
              >
                <View style={styles.toggleKnob} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Link a circle (optional) */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitleEmoji}>🔗</Text>
              <Text style={styles.cardTitle}>
                Link a Circle{" "}
                <Text style={styles.optionalText}>(optional)</Text>
              </Text>
            </View>
            <Text style={styles.cardHelp}>
              Auto-transfer Circle payouts to this goal
            </Text>

            {linkedCircleId ? (
              <View style={styles.linkedRow}>
                <Text style={styles.linkedName}>✓ {linkedCircle?.name}</Text>
                <TouchableOpacity
                  onPress={() => setLinkedCircleId(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkedRemove}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowCircleSelect(!showCircleSelect)}
                activeOpacity={0.8}
                accessibilityRole="button"
                style={styles.linkSelectButton}
              >
                <Text style={styles.linkSelectText}>+ Select a Circle</Text>
              </TouchableOpacity>
            )}

            {showCircleSelect && !linkedCircleId && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {availableCircles.map((circle) => (
                  <TouchableOpacity
                    key={circle.id}
                    onPress={() => {
                      setLinkedCircleId(circle.id);
                      setShowCircleSelect(false);
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    style={styles.circleOption}
                  >
                    <Text style={styles.circleOptionName}>{circle.name}</Text>
                    <Text style={styles.circleOptionPayout}>
                      ${circle.monthlyPayout.toLocaleString()} payout
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Summary card */}
          <LinearGradient
            colors={[NAVY, "#143654"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <Text style={styles.summaryHeading}>YOUR GOAL</Text>
            <View style={styles.summaryTop}>
              <View style={styles.summaryEmojiBox}>
                <Text style={styles.summaryEmoji}>{goalType.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryName}>
                  {goalName || goalType.name}
                </Text>
                <Text style={styles.summarySub}>
                  {selectedType.emoji} {selectedType.name} • {getEffectiveApy()}%
                  APY
                </Text>
              </View>
            </View>

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Target</Text>
                <Text style={styles.summaryStatValue}>
                  ${targetAmount.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Monthly</Text>
                <Text style={styles.summaryStatValue}>${monthlyContribution}</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Achieve</Text>
                <Text style={[styles.summaryStatValue, { color: TEAL }]}>
                  {estimatedDateStr}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* ===== BOTTOM CTA ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!canCreate}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCreate }}
          style={[styles.primaryButton, !canCreate && styles.primaryButtonDisabled]}
        >
          <Text
            style={[
              styles.primaryButtonText,
              !canCreate && styles.primaryButtonTextDisabled,
            ]}
          >
            Create Goal
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 50, paddingHorizontal: 20 },
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

  goalPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
  },
  goalPreviewEmojiBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  goalPreviewEmoji: { fontSize: 26 },
  goalPreviewName: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  goalPreviewDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },

  contentWrap: { marginTop: -25, paddingHorizontal: 16 },

  // Draft restore banner (Phase C). Placed inside contentWrap, so it omits
  // the horizontal margin the spec used (contentWrap already pads to 16).
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

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  cardTitleEmoji: { fontSize: 18 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: NAVY },
  cardHelp: { fontSize: 12, color: MUTED, marginBottom: 14 },
  optionalText: { fontWeight: "400", color: "#9CA3AF" },

  // Savings type cards
  typeCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  typeCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  typeCardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  typeIconEmoji: { fontSize: 22 },
  typeName: { fontSize: 15, fontWeight: "600", color: NAVY },
  typeTagline: { fontSize: 12, color: MUTED, marginTop: 2 },
  typeRule: { fontSize: 11, marginTop: 4 },
  typeApy: { fontSize: 20, fontWeight: "700" },
  typeApyLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  typeExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  typeDetailMuted: { fontSize: 11, color: MUTED, marginBottom: 4 },
  typeDetailRed: { fontSize: 11, color: RED, marginBottom: 4 },
  typeDetailGreen: { fontSize: 11, color: GREEN },

  // Lock period
  lockRow: { flexDirection: "row", gap: 10 },
  lockButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  lockLabel: { fontSize: 15, fontWeight: "700", color: NAVY },
  lockApy: { fontSize: 13, fontWeight: "600", color: GREEN, marginTop: 4 },
  lockWarn: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lockWarnEmoji: { fontSize: 16 },
  lockWarnTitle: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  lockWarnBody: { fontSize: 11, color: "#A16207", marginTop: 2 },

  // Inputs
  fieldLabel: { fontSize: 12, fontWeight: "600", color: MUTED },
  textInput: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
  },
  amountCurrency: { fontSize: 28, fontWeight: "700", color: NAVY },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    color: NAVY,
    marginLeft: 4,
    padding: 0,
  },
  errorText: { marginTop: 8, fontSize: 12, color: RED },

  quickRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  quickPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  quickPillActive: { borderWidth: 2, borderColor: TEAL, backgroundColor: "#F0FDFB" },
  quickPillText: { fontSize: 13, fontWeight: "600", color: MUTED },
  quickPillTextActive: { color: GREEN },

  monthlyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 12,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  monthlyDisplay: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
  },
  monthlyValue: { fontSize: 28, fontWeight: "700", color: NAVY },
  monthlyUnit: { fontSize: 14, color: MUTED, marginLeft: 2 },

  timelineBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  timelineEmoji: { fontSize: 16 },
  timelineLabel: { fontSize: 12, color: MUTED },
  timelineDate: { fontSize: 15, fontWeight: "700", color: GREEN, marginTop: 2 },
  timelineMonths: { fontSize: 12, color: MUTED },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  toggleEmoji: { fontSize: 20 },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: NAVY },
  toggleBody: { fontSize: 12, color: MUTED, marginTop: 2 },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },

  // Link circle
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
  },
  linkedName: { fontSize: 14, fontWeight: "500", color: GREEN },
  linkedRemove: { fontSize: 12, fontWeight: "600", color: RED },
  linkSelectButton: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: TEAL,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  linkSelectText: { fontSize: 13, fontWeight: "600", color: TEAL },
  circleOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
  },
  circleOptionName: { fontSize: 14, fontWeight: "600", color: NAVY },
  circleOptionPayout: { fontSize: 12, color: MUTED, marginTop: 2 },

  // Summary
  summaryCard: { borderRadius: 16, padding: 16 },
  summaryHeading: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 12,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  summaryEmojiBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryEmoji: { fontSize: 26 },
  summaryName: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  summarySub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  summaryStats: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  summaryStat: { flex: 1, alignItems: "center" },
  summaryStatLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)" },
  summaryStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },

  // Bottom CTA
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
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
  primaryButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  primaryButtonTextDisabled: { color: "#9CA3AF" },
});
