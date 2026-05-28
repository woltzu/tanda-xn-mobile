// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalWithdrawScreen.tsx — GOALS-008 (v2: Savings Type withdrawal rules)
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 159-GOALS-008-GoalWithdraw-v2.jsx.
//
// Withdraw from a savings goal, enforcing per-savings-type rules:
//   FLEXIBLE  — withdraw anytime, no penalty
//   EMERGENCY — valid emergency reasons free; other reasons 10% penalty
//   LOCKED    — 10% penalty for ANY early withdrawal (free after maturity)
//
// CONFIRMATION — implemented as an in-screen conditional render (early
// return when showConfirmation is true), NOT a separate route — matching
// the EarlyRepayment confirmation pattern.
//
// NAMING — *new* v2 screen; route name (added later) `GoalWithdraw`. Does
// NOT overwrite the existing WithdrawFromGoal route/screen.
//
// NAVIGATION — translation-only batch. `onBack`/`onCancel` → goBack();
// confirming the withdrawal resolves to an Alert + goBack() placeholder.
//
// Route params (all optional — defaults applied for standalone preview).
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
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const RED = "#DC2626";
const GREEN = "#059669";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type SavingsTypeId = "flexible" | "emergency" | "locked";

type EmergencyReason = {
  id: string;
  label: string;
  icon: string;
  noFee: boolean;
};

const VALID_EMERGENCY_REASONS: EmergencyReason[] = [
  { id: "medical", label: "Medical emergency", icon: "🏥", noFee: true },
  { id: "job_loss", label: "Job loss / Income disruption", icon: "💼", noFee: true },
  { id: "family", label: "Family emergency", icon: "👨‍👩‍👧", noFee: true },
  { id: "home_repair", label: "Essential home repair", icon: "🏠", noFee: true },
  { id: "travel", label: "Unexpected essential travel", icon: "✈️", noFee: true },
  { id: "legal", label: "Legal emergency", icon: "⚖️", noFee: true },
  { id: "other", label: "Other reason", icon: "📝", noFee: false },
];

type Goal = {
  id: string;
  name: string;
  emoji: string;
  balance: number;
  interestEarned: number;
  target: number;
  progressPercent: number;
  dailyInterest: number;
  monthlyContribution: number;
  savingsType: SavingsTypeId;
  apy: number;
  lockEndDate: string | null;
  lockPeriodMonths: number | null;
};

type Destination = {
  id: string;
  name: string;
  last4?: string;
  type: "wallet" | "bank";
  icon: string;
};

type GoalWithdrawParams = {
  goal?: Goal;
  withdrawDestinations?: Destination[];
};
type GoalWithdrawRouteProp = RouteProp<
  { GoalWithdraw: GoalWithdrawParams },
  "GoalWithdraw"
>;

const DEFAULT_GOAL: Goal = {
  id: "g1",
  name: "Emergency Fund",
  emoji: "🛡️",
  balance: 8500.0,
  interestEarned: 52.4,
  target: 25000.0,
  progressPercent: 34,
  dailyInterest: 0.47,
  monthlyContribution: 500,
  savingsType: "emergency",
  apy: 2,
  lockEndDate: null,
  lockPeriodMonths: null,
};

const DEFAULT_DESTINATIONS: Destination[] = [
  { id: "wallet", name: "TandaXn Wallet", type: "wallet", icon: "💵" },
  { id: "b1", name: "Chase Checking", last4: "4532", type: "bank", icon: "🏦" },
];

type PenaltyInfo = {
  hasPenalty: boolean;
  penaltyPercent: number;
  penaltyAmount: number;
  reason: string | null;
};

export default function GoalWithdrawScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalWithdrawRouteProp>();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const withdrawDestinations =
    route.params?.withdrawDestinations ?? DEFAULT_DESTINATIONS;

  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("wallet");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherReasonText, setOtherReasonText] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [acknowledgedPenalty, setAcknowledgedPenalty] = useState(false);

  const availableBalance = goal.balance + goal.interestEarned;
  const numAmount = Number(amount) || 0;
  const isValidAmount = numAmount > 0 && numAmount <= availableBalance;

  // Penalty determination by savings type
  const getPenaltyInfo = (): PenaltyInfo => {
    if (goal.savingsType === "flexible") {
      return { hasPenalty: false, penaltyPercent: 0, penaltyAmount: 0, reason: null };
    }

    if (goal.savingsType === "emergency") {
      const reason = VALID_EMERGENCY_REASONS.find((r) => r.id === selectedReason);
      if (reason?.noFee) {
        return {
          hasPenalty: false,
          penaltyPercent: 0,
          penaltyAmount: 0,
          reason: "Valid emergency",
        };
      }
      return {
        hasPenalty: true,
        penaltyPercent: 10,
        penaltyAmount: numAmount * 0.1,
        reason: "Non-emergency withdrawal",
      };
    }

    if (goal.savingsType === "locked") {
      const lockEnd = goal.lockEndDate ? new Date(goal.lockEndDate) : null;
      const now = new Date();
      if (lockEnd && now >= lockEnd) {
        return {
          hasPenalty: false,
          penaltyPercent: 0,
          penaltyAmount: 0,
          reason: "Lock period ended",
        };
      }
      return {
        hasPenalty: true,
        penaltyPercent: 10,
        penaltyAmount: numAmount * 0.1,
        reason: "Early withdrawal",
      };
    }

    return { hasPenalty: false, penaltyPercent: 0, penaltyAmount: 0, reason: null };
  };

  const penaltyInfo = getPenaltyInfo();
  const finalAmount = numAmount - penaltyInfo.penaltyAmount;

  // Days remaining (locked type)
  const getDaysRemaining = () => {
    if (goal.savingsType !== "locked" || !goal.lockEndDate) return null;
    const lockEnd = new Date(goal.lockEndDate);
    const now = new Date();
    const diffTime = lockEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };
  const daysRemaining = getDaysRemaining();
  const isLockEnded = daysRemaining !== null && daysRemaining <= 0;

  const canProceed = () => {
    if (!isValidAmount) return false;
    if (goal.savingsType === "emergency" && !selectedReason) return false;
    if (penaltyInfo.hasPenalty && !acknowledgedPenalty) return false;
    return true;
  };

  const handleContinue = () => {
    if (canProceed()) setShowConfirmation(true);
  };

  const handleConfirm = () => {
    // TODO(goals-wiring): persist via SavingsContext then
    // navigation.navigate(Routes.WalletTransactionSuccess, {...}).
    Alert.alert(
      "Withdrawal requested",
      `You'll receive $${finalAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
      })}` +
        (penaltyInfo.hasPenalty
          ? ` after a $${penaltyInfo.penaltyAmount.toFixed(2)} penalty.`
          : "."),
      [{ text: "Done", onPress: () => navigation.goBack() }]
    );
  };

  // Savings type display info
  const getTypeInfo = () => {
    switch (goal.savingsType) {
      case "flexible":
        return { label: "Flexible", color: "#6B7280", icon: "🔓" };
      case "emergency":
        return { label: "Emergency Fund", color: "#F59E0B", icon: "🛡️" };
      case "locked":
        return { label: "Locked Savings", color: "#059669", icon: "🔒" };
      default:
        return { label: "Savings", color: "#6B7280", icon: "💰" };
    }
  };
  const typeInfo = getTypeInfo();

  // CTA label
  const ctaLabel = !isValidAmount
    ? "Enter Amount"
    : goal.savingsType === "emergency" && !selectedReason
    ? "Select Reason"
    : penaltyInfo.hasPenalty && !acknowledgedPenalty
    ? "Acknowledge Penalty"
    : penaltyInfo.hasPenalty
    ? `Withdraw $${finalAmount.toFixed(2)} (after penalty)`
    : `Withdraw $${numAmount.toLocaleString()}`;

  // ════════════════════════════════════════════════════════════════════════════
  // CONFIRMATION (in-screen conditional render — not a separate route)
  // ════════════════════════════════════════════════════════════════════════════
  if (showConfirmation) {
    return (
      <SafeAreaView style={styles.confirmBackdrop}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.confirmCard}>
          <View
            style={[
              styles.confirmIcon,
              { backgroundColor: penaltyInfo.hasPenalty ? "#FEF2F2" : "#F0FDFB" },
            ]}
          >
            <Text style={styles.confirmIconText}>
              {penaltyInfo.hasPenalty ? "⚠️" : "✓"}
            </Text>
          </View>

          <Text style={styles.confirmTitle}>Confirm Withdrawal</Text>

          {/* Summary */}
          <View style={styles.confirmSummary}>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmRowLabel}>Withdraw amount</Text>
              <Text style={styles.confirmRowValue}>
                $
                {numAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>

            {penaltyInfo.hasPenalty && (
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmRowLabel, { color: RED }]}>
                  Penalty ({penaltyInfo.penaltyPercent}%)
                </Text>
                <Text style={[styles.confirmRowValue, { color: RED }]}>
                  -$
                  {penaltyInfo.penaltyAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            )}

            <View style={styles.confirmTotalRow}>
              <Text style={styles.confirmTotalLabel}>You receive</Text>
              <Text
                style={[
                  styles.confirmTotalValue,
                  { color: penaltyInfo.hasPenalty ? RED : GREEN },
                ]}
              >
                $
                {finalAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>

          {penaltyInfo.hasPenalty && (
            <View style={styles.confirmPenaltyNote}>
              <Text style={styles.confirmPenaltyText}>
                ${penaltyInfo.penaltyAmount.toFixed(2)} penalty will be deducted
              </Text>
            </View>
          )}

          <View style={styles.confirmActions}>
            <TouchableOpacity
              onPress={() => setShowConfirmation(false)}
              accessibilityRole="button"
              style={styles.confirmGoBack}
            >
              <Text style={styles.confirmGoBackText}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              accessibilityRole="button"
              style={[
                styles.confirmWithdraw,
                { backgroundColor: penaltyInfo.hasPenalty ? RED : TEAL },
              ]}
            >
              <Text style={styles.confirmWithdrawText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN SCREEN
  // ════════════════════════════════════════════════════════════════════════════
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
            <Text style={styles.headerTitle}>Withdraw</Text>
          </View>

          {/* Goal info */}
          <View style={styles.goalInfo}>
            <View style={styles.goalEmojiBox}>
              <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <View style={styles.goalMetaRow}>
                <View
                  style={[styles.goalTypeTag, { backgroundColor: typeInfo.color }]}
                >
                  <Text style={styles.goalTypeTagText}>
                    {typeInfo.icon} {typeInfo.label}
                  </Text>
                </View>
                <Text style={styles.goalApy}>{goal.apy}% APY</Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.availLabel}>Available</Text>
              <Text style={styles.availValue}>
                $
                {availableBalance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Locked: lock status banner */}
          {goal.savingsType === "locked" && (
            <View
              style={[
                styles.lockBanner,
                {
                  backgroundColor: isLockEnded ? "#F0FDFB" : "#FEF2F2",
                  borderColor: isLockEnded ? GREEN : RED,
                },
              ]}
            >
              {isLockEnded ? (
                <View style={styles.lockEndedRow}>
                  <Text style={styles.lockBannerEmoji}>🎉</Text>
                  <View>
                    <Text style={[styles.lockBannerTitle, { color: GREEN }]}>
                      Lock Period Ended!
                    </Text>
                    <Text style={styles.lockBannerBody}>
                      You can withdraw without any penalty
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.lockActiveRow}>
                  <Text style={styles.lockBannerEmoji}>🔒</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lockBannerTitle, { color: RED }]}>
                      Still Locked
                    </Text>
                    <Text style={styles.lockBannerBody}>
                      Unlocks:{" "}
                      {goal.lockEndDate
                        ? new Date(goal.lockEndDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </Text>
                    <Text style={styles.lockBannerWarn}>
                      ⚠️ 10% penalty for early withdrawal
                    </Text>
                  </View>
                  <View style={styles.lockDaysBox}>
                    <Text style={styles.lockDaysValue}>{daysRemaining}</Text>
                    <Text style={styles.lockDaysLabel}>days left</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Flexible: no-restrictions banner */}
          {goal.savingsType === "flexible" && (
            <View style={styles.flexBanner}>
              <Text style={styles.flexBannerEmoji}>✅</Text>
              <View>
                <Text style={styles.flexBannerTitle}>
                  Flexible Savings — No restrictions
                </Text>
                <Text style={styles.flexBannerBody}>
                  Withdraw anytime without any penalty
                </Text>
              </View>
            </View>
          )}

          {/* Amount input */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>AMOUNT TO WITHDRAW</Text>
            <View
              style={[
                styles.amountInputWrap,
                numAmount > availableBalance && { borderColor: RED },
              ]}
            >
              <Text style={styles.amountCurrency}>$</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                style={styles.amountInput}
              />
            </View>

            {numAmount > availableBalance && (
              <Text style={styles.errorText}>
                Amount exceeds available balance
              </Text>
            )}

            <View style={styles.quickRow}>
              {[100, 500].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setAmount(String(Math.min(amt, availableBalance)))}
                  accessibilityRole="button"
                  style={styles.quickPill}
                >
                  <Text style={styles.quickPillText}>${amt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setAmount(String(availableBalance))}
                accessibilityRole="button"
                style={styles.quickPillAll}
              >
                <Text style={styles.quickPillAllText}>Withdraw All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Emergency: reason selection */}
          {goal.savingsType === "emergency" && (
            <View style={styles.card}>
              <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>
                REASON FOR WITHDRAWAL
              </Text>
              <Text style={styles.cardHelp}>
                Valid emergencies = no penalty. Other reasons = 10% penalty.
              </Text>

              <View style={{ gap: 8 }}>
                {VALID_EMERGENCY_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason.id;
                  const selBorder = reason.noFee ? GREEN : RED;
                  const selBg = reason.noFee ? "#F0FDFB" : "#FEF2F2";
                  return (
                    <TouchableOpacity
                      key={reason.id}
                      onPress={() => setSelectedReason(reason.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.reasonRow,
                        isSelected && {
                          borderWidth: 2,
                          borderColor: selBorder,
                          backgroundColor: selBg,
                          margin: -1,
                        },
                      ]}
                    >
                      <View style={styles.reasonLeft}>
                        <Text style={styles.reasonIcon}>{reason.icon}</Text>
                        <Text style={styles.reasonLabel}>{reason.label}</Text>
                      </View>
                      <View
                        style={[
                          styles.reasonTag,
                          {
                            backgroundColor: reason.noFee ? "#D1FAE5" : "#FEE2E2",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reasonTagText,
                            { color: reason.noFee ? GREEN : RED },
                          ]}
                        >
                          {reason.noFee ? "No fee" : "10% penalty"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedReason === "other" && (
                <TextInput
                  value={otherReasonText}
                  onChangeText={setOtherReasonText}
                  placeholder="Please describe your reason..."
                  placeholderTextColor="#9CA3AF"
                  style={styles.otherInput}
                />
              )}
            </View>
          )}

          {/* Destination */}
          <View style={styles.card}>
            <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>SEND TO</Text>
            <View style={{ gap: 10 }}>
              {withdrawDestinations.map((dest) => {
                const isSelected = destination === dest.id;
                return (
                  <TouchableOpacity
                    key={dest.id}
                    onPress={() => setDestination(dest.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.destRow,
                      isSelected && {
                        borderWidth: 2,
                        borderColor: TEAL,
                        backgroundColor: "#F0FDFB",
                        margin: -1,
                      },
                    ]}
                  >
                    <View style={styles.destLeft}>
                      <Text style={styles.destIcon}>{dest.icon}</Text>
                      <Text style={styles.destName}>{dest.name}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        isSelected
                          ? { backgroundColor: TEAL, borderWidth: 0 }
                          : { borderWidth: 2, borderColor: "#D1D5DB" },
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Penalty acknowledgment */}
          {penaltyInfo.hasPenalty && numAmount > 0 && (
            <View style={styles.penaltyCard}>
              <View style={styles.penaltyTopRow}>
                <Text style={styles.penaltyEmoji}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.penaltyTitle}>
                    {penaltyInfo.penaltyPercent}% Penalty Applies
                  </Text>
                  <Text style={styles.penaltyReason}>
                    Reason: {penaltyInfo.reason}
                  </Text>

                  <View style={styles.penaltyBreakdown}>
                    <View style={styles.penaltyBreakRow}>
                      <Text style={styles.penaltyBreakLabel}>Withdraw</Text>
                      <Text style={styles.penaltyBreakValue}>
                        ${numAmount.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.penaltyBreakRow}>
                      <Text style={[styles.penaltyBreakLabel, { color: RED }]}>
                        Penalty
                      </Text>
                      <Text style={[styles.penaltyBreakValue, { color: RED }]}>
                        -${penaltyInfo.penaltyAmount.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.penaltyBreakTotalRow}>
                      <Text style={styles.penaltyBreakTotalLabel}>You receive</Text>
                      <Text style={styles.penaltyBreakTotalValue}>
                        ${finalAmount.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Acknowledgment checkbox */}
                  <TouchableOpacity
                    onPress={() => setAcknowledgedPenalty(!acknowledgedPenalty)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: acknowledgedPenalty }}
                    style={[
                      styles.ackRow,
                      { backgroundColor: acknowledgedPenalty ? "#FECACA" : "#FFFFFF" },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        acknowledgedPenalty
                          ? { backgroundColor: RED, borderWidth: 0 }
                          : { borderWidth: 2, borderColor: RED },
                      ]}
                    >
                      {acknowledgedPenalty && (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.ackText}>
                      I understand I will lose $
                      {penaltyInfo.penaltyAmount.toFixed(2)} due to the penalty
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ===== BOTTOM CTA ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!canProceed()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canProceed() }}
          style={[
            styles.primaryButton,
            !canProceed()
              ? styles.primaryButtonDisabled
              : { backgroundColor: penaltyInfo.hasPenalty ? RED : TEAL },
          ]}
        >
          <Text
            style={[
              styles.primaryButtonText,
              !canProceed() && styles.primaryButtonTextDisabled,
            ]}
          >
            {ctaLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel</Text>
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

  goalInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
  },
  goalEmojiBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  goalEmoji: { fontSize: 26 },
  goalName: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  goalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  goalTypeTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  goalTypeTagText: { fontSize: 10, fontWeight: "600", color: "#FFFFFF" },
  goalApy: { fontSize: 11, color: "rgba(255,255,255,0.8)" },
  availLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  availValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },

  contentWrap: { marginTop: -25, paddingHorizontal: 16 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHelp: { fontSize: 12, color: MUTED, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: MUTED },

  // Lock banner
  lockBanner: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  lockEndedRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lockActiveRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  lockBannerEmoji: { fontSize: 24 },
  lockBannerTitle: { fontSize: 14, fontWeight: "600" },
  lockBannerBody: { fontSize: 12, color: MUTED, marginTop: 4 },
  lockBannerWarn: { fontSize: 13, color: RED, fontWeight: "500", marginTop: 8 },
  lockDaysBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    alignItems: "center",
  },
  lockDaysValue: { fontSize: 20, fontWeight: "700", color: RED },
  lockDaysLabel: { fontSize: 10, color: MUTED, marginTop: 2 },

  // Flexible banner
  flexBanner: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flexBannerEmoji: { fontSize: 20 },
  flexBannerTitle: { fontSize: 13, fontWeight: "600", color: GREEN },
  flexBannerBody: { fontSize: 11, color: MUTED, marginTop: 2 },

  // Amount input
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
  },
  amountCurrency: { fontSize: 32, fontWeight: "700", color: NAVY },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: "700",
    color: NAVY,
    marginLeft: 4,
    padding: 0,
  },
  errorText: { marginTop: 8, fontSize: 12, color: RED },

  quickRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  quickPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  quickPillText: { fontSize: 13, fontWeight: "600", color: MUTED },
  quickPillAll: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: RED,
    backgroundColor: "#FEF2F2",
  },
  quickPillAllText: { fontSize: 13, fontWeight: "600", color: RED },

  // Emergency reasons
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
  },
  reasonLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  reasonIcon: { fontSize: 18 },
  reasonLabel: { fontSize: 13, fontWeight: "500", color: NAVY, flex: 1 },
  reasonTag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  reasonTagText: { fontSize: 10, fontWeight: "600" },
  otherInput: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    fontSize: 14,
    color: NAVY,
  },

  // Destination
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
  },
  destLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  destIcon: { fontSize: 18 },
  destName: { fontSize: 14, fontWeight: "500", color: NAVY },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Penalty card
  penaltyCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: RED,
  },
  penaltyTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  penaltyEmoji: { fontSize: 24 },
  penaltyTitle: { fontSize: 14, fontWeight: "600", color: RED },
  penaltyReason: { fontSize: 13, color: "#7F1D1D", marginTop: 6 },
  penaltyBreakdown: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
  },
  penaltyBreakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  penaltyBreakLabel: { fontSize: 12, color: MUTED },
  penaltyBreakValue: { fontSize: 13, color: NAVY },
  penaltyBreakTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  penaltyBreakTotalLabel: { fontSize: 13, fontWeight: "600", color: NAVY },
  penaltyBreakTotalValue: { fontSize: 15, fontWeight: "700", color: RED },
  ackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ackText: { fontSize: 12, color: "#7F1D1D", flex: 1 },

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
  cancelButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "500", color: MUTED },

  // Confirmation overlay
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  confirmCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: "center",
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmIconText: { fontSize: 32 },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },
  confirmSummary: {
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  confirmRowLabel: { fontSize: 13, color: MUTED },
  confirmRowValue: { fontSize: 15, fontWeight: "600", color: NAVY },
  confirmTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  confirmTotalLabel: { fontSize: 14, fontWeight: "600", color: NAVY },
  confirmTotalValue: { fontSize: 18, fontWeight: "700" },
  confirmPenaltyNote: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  confirmPenaltyText: { fontSize: 12, color: RED, textAlign: "center" },
  confirmActions: { flexDirection: "row", gap: 12 },
  confirmGoBack: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  confirmGoBackText: { fontSize: 15, fontWeight: "600", color: NAVY },
  confirmWithdraw: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmWithdrawText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
});
