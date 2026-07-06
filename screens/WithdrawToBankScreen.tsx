// ═══════════════════════════════════════════════════════════════════════════
// screens/WithdrawToBankScreen.tsx — user-facing withdrawal flow
// ═══════════════════════════════════════════════════════════════════════════
//
// Simple three-part screen: balance card, amount input, submit. Calls
// the request_withdrawal(p_amount_cents INT) RPC (mig 284), which
// validates against user_wallets.available_balance_cents and inserts a
// pending row into withdrawal_requests. The underlying bank transfer
// (Stripe Connect / ACH) happens later in a separate flow.
//
// Balance display reads from useWallet() so the number matches
// WalletScreen exactly. Client-side validation is a UX layer only —
// authoritative checks (min amount, sufficient balance, critical-action
// gating from mig 257) happen server-side in the RPC.
//
// Deliberately avoids all Stripe / Connect terminology per the product
// direction to hide payout-provider details from users.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = colors.textSecondary;

const MIN_WITHDRAWAL_DOLLARS = 1;

export default function WithdrawToBankScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { balance, refreshWallet } = useWallet();

  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Parse the raw input into a numeric dollar amount. Only accept
  // digits and a single decimal point; strip anything else so a wayward
  // paste doesn't crash the parseFloat.
  const amount = useMemo(() => {
    const cleaned = amountText.replace(/[^0-9.]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }, [amountText]);

  const validationError = useMemo<string | null>(() => {
    if (!amountText.trim()) return null;
    if (amount < MIN_WITHDRAWAL_DOLLARS) {
      return t("withdraw.min_amount_error", { min: MIN_WITHDRAWAL_DOLLARS });
    }
    if (amount > (balance ?? 0)) {
      return t("withdraw.insufficient_balance");
    }
    return null;
  }, [amountText, amount, balance, t]);

  const canSubmit =
    !submitting &&
    amountText.trim().length > 0 &&
    validationError === null &&
    amount > 0;

  const handleAmountChange = useCallback((raw: string) => {
    // Allow only digits and a single decimal point. Extra points get
    // dropped; leading zeros collapse via parseFloat downstream.
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const normalized =
      parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setAmountText(normalized);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !user?.id) return;
    setSubmitting(true);
    try {
      const amountCents = Math.round(amount * 100);
      const { data, error } = await supabase.rpc("request_withdrawal", {
        p_amount_cents: amountCents,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("empty_response");

      showToast(t("withdraw.success"), "success");
      // Fire-and-forget wallet refresh so pending state (if the backend
      // later reserves the amount) shows up immediately.
      refreshWallet?.().catch(() => undefined);
      setAmountText("");
      navigation.goBack();
    } catch (e: any) {
      console.warn("[Withdraw] request_withdrawal failed:", e);
      showToast(
        e?.message ? `${t("withdraw.error")}: ${e.message}` : t("withdraw.error"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, user?.id, amount, t, refreshWallet, navigation]);

  const handleWithdrawAll = useCallback(() => {
    if (!balance || balance < MIN_WITHDRAWAL_DOLLARS) return;
    setAmountText(balance.toFixed(2));
  }, [balance]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("withdraw.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{t("withdraw.balance")}</Text>
            <Text style={styles.balanceValue}>
              ${(balance ?? 0).toFixed(2)}
            </Text>
          </View>

          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>{t("withdraw.amount_label")}</Text>
              <TouchableOpacity
                onPress={handleWithdrawAll}
                disabled={!balance || balance < MIN_WITHDRAWAL_DOLLARS}
              >
                <Text
                  style={[
                    styles.withdrawAllLink,
                    (!balance || balance < MIN_WITHDRAWAL_DOLLARS) &&
                      styles.linkDisabled,
                  ]}
                >
                  {t("withdraw.withdraw_all")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={handleAmountChange}
                placeholder={t("withdraw.amount_placeholder")}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                editable={!submitting}
                accessibilityLabel={t("withdraw.amount_label")}
              />
            </View>
            {validationError ? (
              <Text style={styles.errorText}>{validationError}</Text>
            ) : null}
          </View>

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={MUTED}
              style={{ marginTop: 1 }}
            />
            <Text style={styles.infoText}>{t("withdraw.description")}</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
          >
            {submitting ? (
              <View style={styles.submitInner}>
                <ActivityIndicator size="small" color={colors.cardBg} />
                <Text style={styles.submitText}>{t("withdraw.submitting")}</Text>
              </View>
            ) : (
              <Text style={styles.submitText}>
                {t("withdraw.withdraw_button")}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  flex1: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: "center",
    gap: 4,
  },
  balanceLabel: {
    fontSize: typography.label,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: NAVY,
  },
  field: { gap: 8 },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.medium,
  },
  withdrawAllLink: {
    fontSize: typography.label,
    color: TEAL,
    fontWeight: typography.bold,
  },
  linkDisabled: { color: "#CBD5E1" },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: typography.medium,
    color: MUTED,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: typography.bold,
    color: NAVY,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: typography.label,
    color: colors.errorText,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.label,
    color: MUTED,
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: spacing.md,
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: colors.cardBg,
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
});
