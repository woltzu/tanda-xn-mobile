// ══════════════════════════════════════════════════════════════════════════════
// GoalProviderPaymentScreen — pay a provider from a goal
// ══════════════════════════════════════════════════════════════════════════════
// Phase 1B. Fetches the goal balance + the provider, lets the goal owner
// commit a payment via the `process_goal_provider_payment` RPC, and then
// opens an inline review prompt (1–5 stars + optional text) so the verified-
// purchase review is captured in the same session as the payment.
//
// Flow:
//   1. Load goal + provider (parallel, on mount).
//   2. User enters an amount; the breakdown shows "goal balance after".
//      Submit disabled if amount > balance or amount <= 0.
//   3. "Pay now" → supabase.rpc.process_goal_provider_payment. The RPC
//      writes the audit trail, credits the provider, and inserts both
//      notifications atomically.
//   4. On success, the screen flips to a confirmation card AND opens the
//      ReviewSheet. Submit inserts a provider_reviews row with
//      is_verified=true; Skip dismisses without writing.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Provider, useProvider } from "../hooks/useProviders";

type RouteParams = { goalId: string; providerId: string };

type GoalRow = {
  id: string;
  name: string | null;
  current_balance_cents: number;
  user_id: string;
  goal_status: string | null;
};

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function GoalProviderPaymentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { goalId, providerId } = route.params ?? ({} as RouteParams);

  const { provider, loading: providerLoading } = useProvider(providerId);
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);

  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!goalId) return;
      setGoalLoading(true);
      const { data, error } = await supabase
        .from("user_savings_goals")
        .select("id, name, current_balance_cents, user_id, goal_status")
        .eq("id", goalId)
        .maybeSingle();
      if (!cancelled) {
        if (error || !data) {
          setGoal(null);
        } else {
          setGoal(data as GoalRow);
        }
        setGoalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId]);

  // Amount parsing: accepts "12", "12.5", "12.50". Anything else → 0.
  const amountCents = (() => {
    const clean = amountText.replace(/[^0-9.]/g, "");
    const n = parseFloat(clean);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  })();
  const goalBalance = goal?.current_balance_cents ?? 0;
  const balanceAfter = goalBalance - amountCents;
  const canSubmit =
    !submitting &&
    !paid &&
    goal !== null &&
    provider !== null &&
    amountCents > 0 &&
    amountCents <= goalBalance;

  const handlePay = async () => {
    if (!canSubmit || !goal || !provider) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("process_goal_provider_payment", {
        p_goal_id: goal.id,
        p_provider_id: provider.id,
        p_amount_cents: amountCents,
        p_payment_method: "wallet",
      });
      if (error) throw error;
      const linkIdResult = (data as any)?.link_id ?? null;
      setLinkId(linkIdResult);
      setPaid(true);
      // Optimistically update the local goal balance so the breakdown
      // doesn't show a stale "after" if the user lingers.
      setGoal((g) =>
        g ? { ...g, current_balance_cents: g.current_balance_cents - amountCents } : g,
      );
      setReviewOpen(true);
    } catch (e: any) {
      Alert.alert(
        t("goal_provider_payment.error_title"),
        e?.message ?? t("goal_provider_payment.error_body"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (rating: number, reviewText: string) => {
    if (!provider || !goal || !user?.id) return;
    try {
      await supabase.from("provider_reviews").insert({
        provider_id: provider.id,
        reviewer_id: user.id,
        goal_id: goal.id,
        rating,
        review_text: reviewText.trim() || null,
        is_verified: true,
      });
    } catch (e) {
      // Review write failed but payment already landed — keep the user
      // on the success screen and surface a non-blocking note. The
      // reviewer can retry from the provider detail page later.
      console.warn("[GoalProviderPayment] review insert failed:", e);
    }
    setReviewOpen(false);
  };

  const handleClose = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  if (goalLoading || providerLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (!goal || !provider) {
    return (
      <View style={styles.container}>
        <Header onClose={handleClose} title={t("goal_provider_payment.title")} />
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("goal_provider_payment.not_found")}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Header onClose={handleClose} title={t("goal_provider_payment.title")} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!paid ? (
            <>
              {/* Provider context card */}
              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>{t("goal_provider_payment.provider")}</Text>
                <Text style={styles.contextValue} numberOfLines={1}>
                  {provider.business_name}
                </Text>
                <Text style={styles.contextSub}>
                  {t(`provider_category.${provider.category}`)}
                </Text>
              </View>

              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>{t("goal_provider_payment.goal")}</Text>
                <Text style={styles.contextValue} numberOfLines={1}>
                  {goal.name ?? "—"}
                </Text>
                <Text style={styles.contextSub}>
                  {t("goal_provider_payment.balance")} {fmt(goalBalance)}
                </Text>
              </View>

              {/* Amount input */}
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("goal_provider_payment.amount_label")}
                </Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountPrefix}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amountText}
                    onChangeText={setAmountText}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                </View>
                {amountCents > goalBalance ? (
                  <Text style={styles.errorText}>
                    {t("goal_provider_payment.insufficient")}
                  </Text>
                ) : null}

                <View style={styles.breakdown}>
                  <BreakdownRow
                    label={t("goal_provider_payment.amount_label")}
                    value={fmt(amountCents)}
                  />
                  <BreakdownRow
                    label={t("goal_provider_payment.balance_after")}
                    value={fmt(Math.max(balanceAfter, 0))}
                    emphasised
                  />
                </View>
              </View>

              {/* Payment method (Phase 1B = wallet only — the goal IS the source) */}
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>
                  {t("goal_provider_payment.method_label")}
                </Text>
                <View style={styles.methodPill}>
                  <Ionicons name="wallet-outline" size={18} color="#00C6AE" />
                  <Text style={styles.methodPillText}>
                    {t("goal_provider_payment.method_wallet")}
                  </Text>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#00C6AE"
                    style={{ marginLeft: "auto" }}
                  />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Text style={{ fontSize: 48 }}>✅</Text>
              </View>
              <Text style={styles.successTitle}>
                {t("goal_provider_payment.success_title")}
              </Text>
              <Text style={styles.successBody}>
                {t("goal_provider_payment.success_body", {
                  amount: fmt(amountCents),
                  provider: provider.business_name,
                })}
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]}
                onPress={handleClose}
              >
                <Text style={styles.btnPrimaryText}>
                  {t("goal_provider_payment.done")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {!paid ? (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, !canSubmit && styles.btnDisabled]}
              onPress={handlePay}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {t("goal_provider_payment.pay_now")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <ReviewSheet
          visible={reviewOpen}
          providerName={provider.business_name}
          onSubmit={handleReviewSubmit}
          onSkip={() => setReviewOpen(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Header({ onClose, title }: { onClose: () => void; title: string }) {
  return (
    <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onClose}>
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </LinearGradient>
  );
}

function BreakdownRow({
  label,
  value,
  emphasised,
}: {
  label: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[styles.breakdownValue, emphasised && styles.breakdownValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

function ReviewSheet({
  visible,
  providerName,
  onSubmit,
  onSkip,
}: {
  visible: boolean;
  providerName: string;
  onSubmit: (rating: number, text: string) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  useEffect(() => {
    if (!visible) {
      setRating(5);
      setText("");
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.sheetBackdrop} onPress={onSkip}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {t("goal_provider_payment.review_prompt", { name: providerName })}
            </Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRating(n)}
                  hitSlop={{ top: 8, right: 4, bottom: 8, left: 4 }}
                >
                  <Ionicons
                    name={n <= rating ? "star" : "star-outline"}
                    size={32}
                    color="#F59E0B"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              value={text}
              onChangeText={setText}
              placeholder={t("goal_provider_payment.review_placeholder")}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { flex: 1, marginRight: 8 }]}
                onPress={onSkip}
              >
                <Text style={styles.btnSecondaryText}>
                  {t("goal_provider_payment.review_skip")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
                onPress={() => onSubmit(rating, text)}
              >
                <Text style={styles.btnPrimaryText}>
                  {t("goal_provider_payment.review_submit")}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  scrollContent: { padding: 16, paddingBottom: 96 },

  contextCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  contextLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  contextValue: { fontSize: 16, fontWeight: "800", color: "#0A2342", marginTop: 2 },
  contextSub: { fontSize: 13, color: "#6B7280", marginTop: 2 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#0A2342", marginBottom: 8 },

  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  amountPrefix: { fontSize: 22, fontWeight: "700", color: "#0A2342", marginRight: 4 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "700", color: "#0A2342", paddingVertical: 10 },
  errorText: { color: "#EF4444", fontSize: 12, marginTop: 6 },

  breakdown: { marginTop: 14, gap: 6 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 13, color: "#6B7280" },
  breakdownValue: { fontSize: 13, fontWeight: "600", color: "#0A2342" },
  breakdownValueStrong: { fontSize: 14, fontWeight: "800", color: "#00C6AE" },

  methodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  methodPillText: { fontSize: 14, fontWeight: "700", color: "#0A2342" },

  successTitle: { fontSize: 18, fontWeight: "800", color: "#0A2342", textAlign: "center" },
  successBody: { fontSize: 14, color: "#374151", textAlign: "center", marginTop: 6, lineHeight: 20 },

  bottomBar: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  btnSecondary: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  btnSecondaryText: { color: "#0A2342", fontSize: 14, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#0A2342", marginBottom: 14 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 14 },
  reviewInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#0A2342",
    textAlignVertical: "top",
    marginBottom: 14,
  },
  sheetActions: { flexDirection: "row" },
});
