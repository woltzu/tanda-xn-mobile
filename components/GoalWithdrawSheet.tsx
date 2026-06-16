// ══════════════════════════════════════════════════════════════════════════════
// components/GoalWithdrawSheet.tsx — goal → wallet withdraw bottom-sheet.
// ══════════════════════════════════════════════════════════════════════════════
//
// Opened from GoalDetailV2Screen's "Withdraw" button. Replaces the
// full-screen GoalWithdrawScreen for the common case (wallet-destination,
// no penalty branch — the legacy screen surfaced penalty rules for
// emergency/locked tiers; that detailed UX is deferred). Calls
// `transfer_from_goal` RPC via useGoalActions.withdraw.
//
// Penalty for non-flexible tiers is computed in `useGoalActions.withdraw`
// from the `penaltyPercent` we pass in (mirror of the legacy contract).
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

type Props = {
  visible: boolean;
  goalId: string;
  goalName: string;
  /** Goal balance in dollars — used to gate the Confirm button. */
  goalBalance: number;
  /** 0 for flexible; the tier penalty % otherwise. */
  penaltyPercent?: number;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function GoalWithdrawSheet({
  visible,
  goalId,
  goalName,
  goalBalance,
  penaltyPercent = 0,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const { withdraw } = useGoalActions();

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount("");
      setReason("");
    }
  }, [visible]);

  const numericAmount = parseFloat(amount) || 0;
  const overdraw = numericAmount > goalBalance;
  const isValid = numericAmount > 0 && !overdraw;

  const penaltyAmount =
    penaltyPercent > 0 ? (numericAmount * penaltyPercent) / 100 : 0;
  const netToWallet = numericAmount - penaltyAmount;

  const handleConfirm = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    const { error } = await withdraw(
      goalId,
      numericAmount,
      reason || undefined,
      penaltyPercent || undefined,
    );
    setSubmitting(false);
    if (error) {
      Alert.alert(
        t("goal_withdraw_sheet.alert_error_title"),
        (error as any)?.message ?? t("goal_withdraw_sheet.alert_error_body"),
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
        {/* Lift the sheet above the keyboard; inner ScrollView keeps the
            action buttons reachable on small phones with a tall IME. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
          style={styles.kavWrap}
          pointerEvents="box-none"
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.handle} />

              <Text style={styles.title}>
            {t("goal_withdraw_sheet.title", { goal: goalName })}
          </Text>
          <Text style={styles.subtitle}>
            {t("goal_withdraw_sheet.subtitle", {
              balance: goalBalance.toFixed(2),
            })}
          </Text>

          <Text style={styles.label}>
            {t("goal_withdraw_sheet.label_amount")}
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

          {penaltyPercent > 0 && numericAmount > 0 ? (
            <View style={styles.penaltyBox}>
              <Text style={styles.penaltyTitle}>
                {t("goal_withdraw_sheet.penalty_title", {
                  percent: penaltyPercent,
                })}
              </Text>
              <View style={styles.penaltyRow}>
                <Text style={styles.penaltyLabel}>
                  {t("goal_withdraw_sheet.penalty_amount")}
                </Text>
                <Text style={styles.penaltyValue}>
                  −${penaltyAmount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.penaltyRow}>
                <Text style={styles.penaltyLabelBold}>
                  {t("goal_withdraw_sheet.penalty_net")}
                </Text>
                <Text style={styles.penaltyValueBold}>
                  ${netToWallet.toFixed(2)}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={[styles.label, { marginTop: 14 }]}>
            {t("goal_withdraw_sheet.label_reason_optional")}
          </Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder={t("goal_withdraw_sheet.placeholder_reason")}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={140}
          />

          {overdraw ? (
            <View style={styles.errorBar}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>
                {t("goal_withdraw_sheet.error_overdraw")}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.btnSecondaryText}>
                {t("goal_withdraw_sheet.btn_cancel")}
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
                  {t("goal_withdraw_sheet.btn_confirm")}
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
  kavWrap: { justifyContent: "flex-end" },
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
  subtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 16 },
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

  penaltyBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  penaltyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  penaltyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  penaltyLabel: { fontSize: 12, color: "#92400E" },
  penaltyValue: { fontSize: 12, color: "#92400E", fontWeight: "600" },
  penaltyLabelBold: { fontSize: 13, color: "#92400E", fontWeight: "700" },
  penaltyValueBold: { fontSize: 13, color: "#92400E", fontWeight: "800" },

  reasonInput: {
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
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
