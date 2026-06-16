// ══════════════════════════════════════════════════════════════════════════════
// screens/AutopaySetupScreen.tsx — ADVANCE-015 early-repayment autopay
// ══════════════════════════════════════════════════════════════════════════════
//
// Originally translated from web JSX 117-ADVANCE-015-AutopaySetup.jsx as a
// pure mock. The autopay-review P0 (2026-06-15) replaced every hardcoded
// fixture with live data and started persisting changes to the database.
//
// Framing: advance repayment is auto-withheld from payouts by DEFAULT.
// This screen is for the *optional* early-repayment autopay — pay the
// advance off from wallet / card once it can be covered, so the user
// saves on fees and gets a small XnScore bump.
//
// Data sources (P0):
//   - active advance        useAdvanceDashboard().data.active_advances[0]
//   - payment methods       usePayment().paymentMethods + a synthesised
//                           "Wallet" entry powered by useWallet().balance
//   - default selection     usePayment().defaultPaymentMethod (which now
//                           respects default_for_payin from migration 168)
//   - existing config       loan_autopay_configs row keyed by
//                           (user_id, loan_id)
//
// Persistence (P0):
//   - load on focus  → SELECT loan_autopay_configs WHERE user_id, loan_id
//   - save on change → SELECT ↦ INSERT or UPDATE (single-write semantics
//                       come later in P2 with a UNIQUE partial index)
//   - status enum    → 'active' when autopayEnabled, 'disabled' otherwise
//   - autopay_type   → 'full_balance' (full early repayment from balance)
//   - payment_method_id is NULL when "wallet" is selected (Stripe
//     payment methods get their UUID stored)
//
// Empty state: no active advance → CTA back to AdvanceHubV2. The
// Profile menu also hides the entry point in that case (P0.1), but a
// user could still reach this screen via a stale notification deep link.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useAdvanceDashboard } from "../hooks/useAdvanceDashboard";
import { useAutopayConfig } from "../hooks/useAutopay";
import { usePayment, SavedPaymentMethod } from "../context/PaymentContext";
import { useWallet } from "../context/WalletContext";
import { showToast } from "../components/Toast";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

// P1.4 (autopay review): the "Reminder Before Withholding" chip row
// moved out of this screen. The column is still loaded + persisted so
// the existing cron + notification path keep working — we just stop
// exposing the chip-picker UI here. TODO(P2): build the real picker
// inside NotificationPrefsScreen under an "Advance reminders" section
// + drop this default once that ships.
const DEFAULT_REMINDER_DAYS = 3;

// P1.3 (autopay review): once-per-device coach mark gate. Suffix bump
// re-shows the tip if we materially change the copy.
const COACH_TIP_KEY = "@tandaxn_autopay_tip_seen_v1";

// Wallet sentinel — pgkey for the synthesised "TandaXn Wallet" picker
// row. Never stored in payment_method_id (we write NULL + 'wallet' for
// payment_method_type when the user picks wallet).
const WALLET_METHOD_ID = "wallet";

// The autopay_type / status enum values + the on-disk schema mapping
// live in hooks/useAutopay.ts now (P2 hook extraction). The screen
// just calls save({ enabled, paymentMethodId, paymentMethodType,
// daysBeforeDue }) and the hook does the right thing.

function Toggle({
  value,
  onToggle,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toggle,
        value && styles.toggleOn,
        disabled && styles.toggleDisabled,
      ]}
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </TouchableOpacity>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function AutopaySetupScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const { data: dashboard, loading: dashboardLoading } = useAdvanceDashboard();
  const { paymentMethods, defaultPaymentMethod } = usePayment();
  const { balance: walletBalance } = useWallet();

  // Pick the first active advance. Multi-advance picker is future work.
  const activeAdvance = dashboard?.active_advances?.[0] ?? null;
  const loanId = activeAdvance?.loan_id ?? null;

  // P2 (autopay review): hook-owned config state. The hook caches by
  // (userId, loanId) for 60 s and busts the cache on save().
  const {
    config,
    loading: configLoading,
    save: saveAutopay,
  } = useAutopayConfig(loanId);

  // Local UI state — what the toggle / picker render right now. Driven
  // by the hook's snapshot on first hit; updated optimistically on
  // each save, reverted on failure.
  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string>(
    WALLET_METHOD_ID,
  );
  // Still tracked + persisted (default 3) — only the picker UI is gone
  // for P1.4. See DEFAULT_REMINDER_DAYS comment above.
  const [reminderDays, setReminderDays] = useState(DEFAULT_REMINDER_DAYS);

  // ── Payment-method picker rows ────────────────────────────────────────────
  // Synthesise a Wallet entry first; then append real Stripe-backed
  // methods. The list flips order based on whether the user has any
  // saved methods at all — wallet is always present.
  const methodRows = useMemo(() => {
    const wallet = {
      id: WALLET_METHOD_ID,
      label: t("autopay_setup.wallet_label"),
      sub: t("autopay_setup.wallet_balance", {
        amount: walletBalance.toFixed(2),
      }),
      icon: "wallet-outline" as const,
      isWallet: true,
    };
    const real = paymentMethods.map((m) => ({
      id: m.id,
      label: m.label,
      sub: m.bankLast4
        ? `•••• ${m.bankLast4}`
        : m.cardLast4
          ? `•••• ${m.cardLast4}`
          : "",
      icon: "card-outline" as const,
      isWallet: false,
    }));
    return [wallet, ...real];
  }, [paymentMethods, walletBalance, t]);

  // ── Hydrate local state from the hook's snapshot ──────────────────────────
  // useAutopayConfig owns the network read; this effect re-projects its
  // result into the optimistic UI state. If no config exists yet, fall
  // back to the PaymentContext default (which itself honours
  // default_for_payin from migration 168).
  useEffect(() => {
    if (configLoading) return;
    if (config) {
      setAutopayEnabled(config.status === "active");
      setSelectedMethodId(
        config.payment_method_type === "wallet" || !config.payment_method_id
          ? WALLET_METHOD_ID
          : config.payment_method_id,
      );
      setReminderDays(
        typeof config.days_before_due === "number"
          ? config.days_before_due
          : DEFAULT_REMINDER_DAYS,
      );
    } else if (defaultPaymentMethod?.id) {
      // No saved config — pre-select the user's default pay-in method.
      setSelectedMethodId(defaultPaymentMethod.id);
    }
  }, [config, configLoading, defaultPaymentMethod?.id]);

  // ── Persistence — single thin wrapper around the hook ────────────────────
  // The hook handles the upsert keyed on the migration-169 UNIQUE
  // constraint + cache invalidation. We just translate UI ↔ hook
  // params and surface failures.
  const persist = useCallback(
    async (next: { enabled: boolean; methodId: string; days: number }) => {
      const chosen = methodRows.find((r) => r.id === next.methodId);
      const isWallet = chosen?.isWallet ?? true;
      const realMethod: SavedPaymentMethod | undefined = isWallet
        ? undefined
        : paymentMethods.find((m) => m.id === next.methodId);
      try {
        await saveAutopay({
          enabled: next.enabled,
          paymentMethodId: isWallet ? null : next.methodId,
          paymentMethodType: isWallet
            ? "wallet"
            : realMethod?.type ?? "card",
          daysBeforeDue: next.days,
        });
      } catch (err: any) {
        console.warn("[AutopaySetup] persist failed:", err?.message);
        showToast(
          err?.message || t("autopay_setup.toast_save_failed"),
          "error",
        );
        throw err;
      }
    },
    [methodRows, paymentMethods, saveAutopay, t],
  );

  const handleToggle = async () => {
    const next = !autopayEnabled;
    setAutopayEnabled(next); // optimistic
    try {
      await persist({
        enabled: next,
        methodId: selectedMethodId,
        days: reminderDays,
      });
      showToast(
        next
          ? t("autopay_setup.toast_enabled")
          : t("autopay_setup.toast_disabled"),
        "success",
      );
    } catch {
      setAutopayEnabled(!next); // revert
    }
  };

  const handlePickMethod = async (methodId: string) => {
    if (methodId === selectedMethodId) return;
    const prev = selectedMethodId;
    setSelectedMethodId(methodId);
    try {
      await persist({
        enabled: autopayEnabled,
        methodId,
        days: reminderDays,
      });
      showToast(t("autopay_setup.toast_method_changed"), "success");
    } catch {
      setSelectedMethodId(prev);
    }
  };

  // P1.3 (autopay review): show the coach-mark toast once per device.
  // Gated on having an active advance (the tip references behaviour
  // that's meaningless without one) and on having finished the initial
  // config load so we don't toast on top of a still-spinning screen.
  useEffect(() => {
    if (!activeAdvance || configLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_TIP_KEY);
        if (cancelled || seen === "true") return;
        await AsyncStorage.setItem(COACH_TIP_KEY, "true");
        showToast(t("autopay_setup.coach_tip"), "info");
      } catch {
        // AsyncStorage failure → tip simply re-fires next launch.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAdvance?.loan_id, configLoading, t]);

  // ── Empty state — no active advance ───────────────────────────────────────
  if (!dashboardLoading && !activeAdvance) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
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
              accessibilityLabel={t("autopay_setup.a11y_back")}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {t("autopay_setup.header_title")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("autopay_setup.header_subtitle")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.emptyContainer}>
          <Ionicons name="repeat" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>
            {t("autopay_setup.empty_state_title")}
          </Text>
          <Text style={styles.emptyBody}>
            {t("autopay_setup.empty_state_body")}
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => navigation.navigate("AdvanceHubV2")}
          >
            <Text style={styles.emptyCtaText}>
              {t("autopay_setup.empty_state_cta")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalDueDollars = activeAdvance
    ? (activeAdvance.next_payment_cents ??
        activeAdvance.outstanding_cents ??
        0) / 100
    : 0;
  const withholdingDate = formatDate(activeAdvance?.next_payment_date ?? null);
  const days = daysUntil(activeAdvance?.next_payment_date ?? null);

  // P1.1 (autopay review): can the wallet alone clear the advance?
  // True drives the green "sufficient" chip; false drives the amber
  // "may fail" chip. We don't disable the toggle on insufficient —
  // users may add funds later, and the cron will retry. Only inform.
  const walletCovers = walletBalance >= totalDueDollars;

  // P1.2 (autopay review): rough early-repayment savings estimate.
  //
  // The dashboard DTO doesn't expose a fee schedule, so we estimate:
  //   remaining_fee = outstanding_cents - principal_cents
  //   savings       = remaining_fee × 0.5 (≈half — exact pro-rata is
  //                   product-dependent and the screen prefixes "≈").
  //
  // We never show a negative number — if the user is past principal
  // (somehow), we just suppress the line.
  const remainingFeeCents = activeAdvance
    ? Math.max(
        0,
        (activeAdvance.outstanding_cents ?? 0) -
          (activeAdvance.principal_cents ?? 0),
      )
    : 0;
  const estimatedSavingsDollars = (remainingFeeCents * 0.5) / 100;

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
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("autopay_setup.a11y_back")}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {t("autopay_setup.header_title")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("autopay_setup.header_subtitle")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* How repayment works */}
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#00897B"
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>
                {t("autopay_setup.info_title")}
              </Text>
              <Text style={styles.infoBody}>
                {t("autopay_setup.info_body", {
                  date: withholdingDate,
                })}
              </Text>
            </View>
          </View>

          {/* Current advance */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t("autopay_setup.section_current")}
            </Text>
            <View style={styles.advanceRow}>
              <View>
                <Text style={styles.advanceLabel}>
                  {t("autopay_setup.label_amount_due")}
                </Text>
                <Text style={styles.advanceAmount}>
                  ${totalDueDollars.toFixed(2)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.advanceLabel}>
                  {t("final_polish.autopaysetup_auto_withhold_on")}
                </Text>
                <Text style={styles.advanceDate}>{withholdingDate}</Text>
                <Text style={styles.advanceDays}>
                  {t("autopay_setup.days_remaining", { count: days })}
                </Text>
              </View>
            </View>

            {/* P1.2 — Savings estimate. Different copy depending on
                whether autopay is already on (informational) vs off
                (nudge). Suppressed when remainingFeeCents is 0. */}
            {estimatedSavingsDollars > 0 ? (
              <View style={styles.savingsRow}>
                <Ionicons name="cash-outline" size={14} color="#047857" />
                <Text style={styles.savingsText}>
                  {autopayEnabled
                    ? t("autopay_setup.savings_estimate_enabled", {
                        amount: estimatedSavingsDollars.toFixed(2),
                      })
                    : t("autopay_setup.savings_estimate", {
                        amount: estimatedSavingsDollars.toFixed(2),
                      })}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Early repayment autopay */}
          <View style={styles.sectionCard}>
            <View style={styles.toggleHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.sectionTitle}>
                  {t("autopay_setup.section_autopay_title")}
                </Text>
                <Text style={styles.toggleHint}>
                  {t("autopay_setup.section_autopay_hint")}
                </Text>
              </View>
              {configLoading ? (
                <ActivityIndicator size="small" color={TEAL} />
              ) : (
                <Toggle
                  value={autopayEnabled}
                  onToggle={handleToggle}
                  accessibilityLabel={t("autopay_setup.a11y_toggle")}
                />
              )}
            </View>

            {/* P1.1 — wallet-cover chip. Renders whenever there's an
                amount due so the user sees it before flipping the
                toggle. Two tones: green when wallet covers, amber when
                not. */}
            {totalDueDollars > 0 ? (
              <View
                style={[
                  styles.walletChip,
                  walletCovers ? styles.walletChipOk : styles.walletChipWarn,
                ]}
              >
                <Ionicons
                  name={walletCovers ? "checkmark-circle" : "alert-circle"}
                  size={14}
                  color={walletCovers ? "#047857" : "#92400E"}
                />
                <Text
                  style={[
                    styles.walletChipText,
                    walletCovers
                      ? styles.walletChipTextOk
                      : styles.walletChipTextWarn,
                  ]}
                >
                  {walletCovers
                    ? t("autopay_setup.wallet_sufficient_chip", {
                        amount: walletBalance.toFixed(2),
                        due: totalDueDollars.toFixed(2),
                      })
                    : t("autopay_setup.wallet_warning_chip", {
                        amount: walletBalance.toFixed(2),
                        due: totalDueDollars.toFixed(2),
                      })}
                </Text>
              </View>
            ) : null}

            {autopayEnabled && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabelSmall}>
                  {t("autopay_setup.field_pay_from")}
                </Text>
                <View style={styles.methodsList}>
                  {methodRows.map((method) => {
                    const selected = selectedMethodId === method.id;
                    return (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.methodRow,
                          selected && styles.methodRowSelected,
                        ]}
                        onPress={() => handlePickMethod(method.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={method.label}
                      >
                        <View style={styles.methodLeft}>
                          <Ionicons name={method.icon} size={20} color={NAVY} />
                          <View>
                            <Text style={styles.methodName}>{method.label}</Text>
                            {!!method.sub && (
                              <Text style={styles.methodSub}>{method.sub}</Text>
                            )}
                          </View>
                        </View>
                        <View
                          style={[
                            styles.radioDot,
                            selected && styles.radioDotSelected,
                          ]}
                        >
                          {selected && (
                            <Ionicons
                              name="checkmark"
                              size={10}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.autoTriggerNote}>
                  <Text style={styles.autoTriggerText}>
                    {t("autopay_setup.auto_trigger_note", {
                      amount: totalDueDollars.toFixed(2),
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* P1.4 — Reminder chip row removed. Value still persisted
              via reminderDays state so the daily cron + push notifier
              keep firing. TODO(P2): rebuild a dedicated picker inside
              NotificationPrefsScreen under "Advance reminders". */}

          {/* Benefits */}
          <View style={styles.sectionCard}>
            <Text style={styles.benefitsTitle}>
              {t("autopay_setup.section_benefits_title")}
            </Text>
            <View style={styles.benefitsList}>
              <Benefit
                icon="cash-outline"
                text={t("autopay_setup.benefit_savings")}
              />
              <Benefit
                icon="star-outline"
                text={t("autopay_setup.benefit_xnscore")}
              />
              <Benefit
                icon="lock-open-outline"
                text={t("autopay_setup.benefit_keep_payout")}
              />
              <Benefit
                icon="trending-up-outline"
                text={t("autopay_setup.benefit_better_rates")}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons name={icon} size={16} color={TEAL} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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

  contentWrap: { padding: 20 },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TEAL,
  },
  infoTitle: { fontSize: 13, fontWeight: "600", color: "#065F46" },
  infoBody: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 18,
    marginTop: 6,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: NAVY },

  advanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  advanceLabel: { fontSize: 12, color: MUTED },
  advanceAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  advanceDate: {
    fontSize: 14,
    fontWeight: "600",
    color: TEAL,
    marginTop: 2,
  },
  advanceDays: { fontSize: 11, color: MUTED, marginTop: 2 },

  // P1.2 — savings estimate line, sits below the advance grid.
  savingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0FDFB",
  },
  savingsText: { flex: 1, fontSize: 12, color: "#047857", fontWeight: "600" },

  // P1.1 — wallet-cover chip below the autopay toggle.
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  walletChipOk: { backgroundColor: "#ECFDF5" },
  walletChipWarn: { backgroundColor: "#FEF3C7" },
  walletChipText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  walletChipTextOk: { color: "#047857" },
  walletChipTextWarn: { color: "#92400E" },

  toggleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  toggleHint: { fontSize: 12, color: MUTED, marginTop: 4 },

  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: BORDER,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: TEAL },
  toggleDisabled: { opacity: 0.5 },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: { alignSelf: "flex-end" },

  fieldLabelSmall: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 8,
  },
  methodsList: { gap: 8 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  methodRowSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  methodLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  methodName: { fontSize: 13, fontWeight: "600", color: NAVY },
  methodSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: { backgroundColor: TEAL, borderColor: TEAL },

  autoTriggerNote: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
  },
  autoTriggerText: { fontSize: 12, color: MUTED, lineHeight: 18 },

  reminderHint: { fontSize: 12, color: MUTED, marginTop: 4, marginBottom: 12 },
  reminderRow: { flexDirection: "row", gap: 8 },
  reminderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  reminderButtonSelected: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  reminderValue: { fontSize: 16, fontWeight: "700", color: NAVY },
  reminderUnit: { fontSize: 10, color: MUTED, marginTop: 2 },

  benefitsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 10,
  },
  benefitsList: { gap: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitText: { flex: 1, fontSize: 12, color: "#4B5563" },

  // Empty state — no active advance
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    marginTop: 12,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyCta: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: TEAL,
    borderRadius: 12,
  },
  emptyCtaText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});
