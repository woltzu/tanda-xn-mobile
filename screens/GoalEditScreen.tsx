// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalEditScreen.tsx — edit goal details
// ══════════════════════════════════════════════════════════════════════════════
//
// Reached from GoalDetailV2's three-dot menu. Edits the mutable goal fields:
// name, target amount, monthly contribution, and the auto-deposit toggle.
// (Savings type / lock period are NOT editable here — they're set at
// creation.)
//
// PERSISTENCE — Save calls useGoalActions.updateGoal with the four
// editable fields (name, target, monthly contribution, auto-deposit
// toggle). On success → goBack() and GoalDetailV2's useFocusEffect
// refetches; on error → Alert. Cancel still goBack()s without saving.
//
// Route params (all optional):
//   goalId?: string
//   goal?:   { name; emoji; target; monthlyContribution; autoDepositEnabled }
//
// NAVIGATION — uses useTypedNavigation + Routes. onBack / Cancel → goBack().
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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useGoalActions } from "../hooks/useGoalActions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type EditGoal = {
  id?: string;
  name?: string;
  emoji?: string;
  target?: number;
  monthlyContribution?: number;
  autoDepositEnabled?: boolean;
};

type GoalEditParams = {
  goalId?: string;
  goal?: EditGoal;
};
type GoalEditRouteProp = RouteProp<{ GoalEdit: GoalEditParams }, "GoalEdit">;

const DEFAULT_GOAL: EditGoal = {
  id: "g1",
  name: "First Home in Atlanta",
  emoji: "🏠",
  target: 25000,
  monthlyContribution: 500,
  autoDepositEnabled: true,
};

const SUGGESTED_AMOUNTS = [5000, 10000, 25000, 50000];

export default function GoalEditScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<GoalEditRouteProp>();
  const { updateGoal } = useGoalActions();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const goalId = route.params?.goalId ?? goal.id ?? "";

  const [goalName, setGoalName] = useState(goal.name ?? "");
  const [targetAmount, setTargetAmount] = useState(goal.target ?? 25000);
  const [monthlyContribution, setMonthlyContribution] = useState(
    goal.monthlyContribution ?? 500
  );
  const [autoDeposit, setAutoDeposit] = useState(goal.autoDepositEnabled ?? true);
  const [isSaving, setIsSaving] = useState(false);

  // Validation: name non-empty, target > 0, monthly >= 0. Monthly = 0 is
  // allowed even though the stepper UI keeps it >= $50 — defensive against
  // any future input that bypasses the stepper.
  const canSave =
    !isSaving &&
    goalName.trim().length > 0 &&
    targetAmount > 0 &&
    monthlyContribution >= 0;

  const handleSave = async () => {
    if (!canSave) return;

    if (!UUID_RE.test(goalId)) {
      Alert.alert(
        "Goal not loaded",
        "Open this screen from your goal's detail page so the edit can be saved."
      );
      return;
    }

    // The hook accepts camelCase keys (UpdateGoalInput) and converts
    // dollar amounts to cents on its side.
    setIsSaving(true);
    const { error } = await updateGoal(goalId, {
      name: goalName.trim(),
      targetAmount,
      monthlyContribution,
      autoDepositEnabled: autoDeposit,
    });
    setIsSaving(false);

    if (error) {
      Alert.alert("Couldn't save", error.message ?? "Please try again.");
      return;
    }

    // GoalDetailV2's useFocusEffect refetches the goal on return,
    // so a bare goBack() is enough — no confirmation Alert.
    navigation.goBack();
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
            <Text style={styles.headerTitle}>{t("screen_headers.goal_edit")}</Text>
          </View>

          {/* Goal preview */}
          <View style={styles.goalPreview}>
            <View style={styles.goalEmojiBox}>
              <Text style={styles.goalEmoji}>{goal.emoji ?? "🎯"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalName} numberOfLines={1}>
                {goalName || "Your goal"}
              </Text>
              <Text style={styles.goalSub}>Editing goal details</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
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
            <View style={styles.amountInputWrap}>
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
            <View style={styles.quickRow}>
              {SUGGESTED_AMOUNTS.map((amt) => {
                const isActive = targetAmount === amt;
                return (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setTargetAmount(amt)}
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
        </View>
      </ScrollView>

      {/* ===== BOTTOM ACTIONS ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: isSaving }}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                !canSave && styles.saveButtonTextDisabled,
              ]}
            >
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          disabled={isSaving}
          accessibilityRole="button"
          style={[styles.cancelButton, isSaving && { opacity: 0.5 }]}
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

  header: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20 },
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
  goalEmojiBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  goalEmoji: { fontSize: 26 },
  goalName: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  goalSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  contentWrap: { paddingHorizontal: 16, paddingTop: 16 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
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

  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: BORDER },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  saveButtonTextDisabled: { color: "#9CA3AF" },
  cancelButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "500", color: MUTED },
});
