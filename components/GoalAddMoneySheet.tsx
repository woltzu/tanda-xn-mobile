// ══════════════════════════════════════════════════════════════════════════════
// components/GoalAddMoneySheet.tsx — wallet → goal deposit bottom-sheet.
// ══════════════════════════════════════════════════════════════════════════════
//
// Opened from GoalDetailV2Screen's "Add money" button. Replaces the
// full-screen GoalAddMoneyScreen for the common case (wallet-funded
// deposit). Calls `transfer_to_goal` RPC via useGoalActions.addMoney —
// same atomic path the legacy screen used.
//
// Bank / card sources are NOT supported here (the legacy screen had a
// Stripe payment-sheet branch for those; that's deferred to a follow-up
// since the express flow targets the median case).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { useGoalActions } from "../hooks/useGoalActions";

const QUICK_AMOUNTS = [10, 25, 50, 100, 250] as const;

type Props = {
  visible: boolean;
  goalId: string;
  goalName: string;
  /** Walletbalance in dollars — shown beneath the source row, used to gate
   *  the Confirm button. */
  walletBalance: number;
  onClose: () => void;
  /** Fired after a successful deposit so the parent can refetch. */
  onSuccess?: () => void;
  /** Optional starting amount in dollars. When the sheet is opened from a
   *  milestone-driven surface ("$750 to unlock the 25% milestone"), the
   *  caller passes the delta so the user just confirms. Reset to "" on
   *  every open when omitted. */
  prefillAmount?: number;
};

export default function GoalAddMoneySheet({
  visible,
  goalId,
  goalName,
  walletBalance,
  onClose,
  onSuccess,
  prefillAmount,
}: Props) {
  const { t } = useTranslation();
  const { addMoney } = useGoalActions();

  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on each open so a prior amount doesn't bleed into the next visit.
  // When the caller supplies a prefillAmount (e.g. the "$750 to unlock the
  // 25% milestone" chip), start with it — Ceil-then-toFixed(2) so the
  // rendered value has no floating-point tail like 749.99999.
  useEffect(() => {
    if (!visible) return;
    if (prefillAmount != null && prefillAmount > 0) {
      const rounded = Math.ceil(prefillAmount * 100) / 100;
      setAmount(String(rounded));
    } else {
      setAmount("");
    }
  }, [visible, prefillAmount]);

  const numericAmount = parseFloat(amount) || 0;
  const overdraw = numericAmount > walletBalance;
  const isValid = numericAmount > 0 && !overdraw;

  const handleConfirm = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    const { error } = await addMoney(goalId, numericAmount, "wallet");
    setSubmitting(false);
    if (error) {
      Alert.alert(
        t("goal_add_money_sheet.alert_error_title"),
        (error as any)?.message ?? t("goal_add_money_sheet.alert_error_body"),
      );
      return;
    }
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* KeyboardAvoidingView lifts the sheet above the IME so the amount
            input stays visible while the user types. Inner ScrollView lets
            the keyboard NOT clip the action buttons on small phones. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
          style={styles.kavWrap}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.sheet}
            onPress={() => {}}
            // Stop the backdrop dismiss from firing through the sheet
            // when the user taps inside it.
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.handle} />

              <Text style={styles.title}>
            {t("goal_add_money_sheet.title", { goal: goalName })}
          </Text>
          <Text style={styles.subtitle}>
            {t("goal_add_money_sheet.subtitle")}
          </Text>

          {/* Amount input */}
          <Text style={styles.label}>
            {t("goal_add_money_sheet.label_amount")}
          </Text>
          <View
            style={[styles.amountRow, overdraw && styles.amountRowError]}
          >
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          {/* Quick chips */}
          <View style={styles.chipRow}>
            {QUICK_AMOUNTS.map((q) => {
              const selected = numericAmount === q;
              return (
                <TouchableOpacity
                  key={q}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setAmount(String(q))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    ${q}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Source = wallet (only) */}
          <View style={styles.sourceCard}>
            <Ionicons name="wallet-outline" size={18} color={colors.accentTeal} />
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceLabel}>
                {t("goal_add_money_sheet.source_wallet")}
              </Text>
              <Text style={styles.sourceMeta}>
                {t("goal_add_money_sheet.source_balance", {
                  amount: walletBalance.toFixed(2),
                })}
              </Text>
            </View>
          </View>

          {overdraw ? (
            <View style={styles.errorBar}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>
                {t("goal_add_money_sheet.error_overdraw")}
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.btnSecondaryText}>
                {t("goal_add_money_sheet.btn_cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                (!isValid || submitting) && styles.btnPrimaryDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textWhite} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {t("goal_add_money_sheet.btn_confirm")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  kavWrap: {
    // Sit at the bottom of the backdrop so the keyboard-avoiding push
    // looks natural (the sheet rises with the keyboard, not the whole
    // screen).
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountRowError: { borderColor: "#DC2626", borderWidth: 2 },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.tealTintBg,
    borderColor: colors.accentTeal,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  chipTextSelected: { color: colors.accentTeal },

  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: colors.tealTintBg,
    borderRadius: 10,
    marginTop: 16,
  },
  sourceInfo: { flex: 1 },
  sourceLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sourceMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    marginTop: 10,
  },
  errorText: { fontSize: 11, color: "#DC2626", flex: 1 },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryNavy,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 14,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryDisabled: { opacity: 0.5 },
  btnPrimaryText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 14,
  },
});
