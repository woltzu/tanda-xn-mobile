// ══════════════════════════════════════════════════════════════════════════════
// screens/CircleAutopaySetupScreen.tsx
//
// Phase 0 of Circle Contribution Autopay. Create or edit an autopay
// config for a single circle.
//
// Route params:
//   circleId?: string  — pre-selects the circle; hides the circle
//                        picker. Set when navigated to from CircleDetail.
//   configId?: string  — reserved for the management screen's
//                        "Edit" path. Currently unused — the config
//                        lookup keys on (user, circle), not id.
//
// Sources of truth:
//   - useCircles().myCircles               → user's circle list
//   - usePayment().paymentMethods + default → payment-method picker
//   - useWallet().balance                  → wallet row balance
//   - useCircleAutopayConfig(circleId)     → load existing config + save()
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
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useCircles } from "../context/CirclesContext";
import { usePayment } from "../context/PaymentContext";
import { useWallet } from "../context/WalletContext";
import {
  useCircleAutopayConfig,
  SaveCircleAutopayParams,
} from "../hooks/useCircleAutopay";
import { showToast } from "../components/Toast";
import { RootStackParamList } from "../App";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

const WALLET_METHOD_ID = "wallet";
const DAYS_BEFORE_OPTIONS = [1, 2, 3, 5, 7];

type SetupRoute = RouteProp<RootStackParamList, "CircleAutopaySetup">;

function Toggle({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleOn]}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </TouchableOpacity>
  );
}

export default function CircleAutopaySetupScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<SetupRoute>();
  const { t } = useTranslation();
  const { myCircles } = useCircles();
  const { paymentMethods, defaultPaymentMethod } = usePayment();
  const { balance: walletBalance } = useWallet();

  const preSelectedCircleId = route.params?.circleId ?? null;
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(
    preSelectedCircleId,
  );
  const [circlePickerOpen, setCirclePickerOpen] = useState(false);

  const {
    config,
    loading: configLoading,
    save,
  } = useCircleAutopayConfig(selectedCircleId);

  const selectedCircle = useMemo(
    () => myCircles.find((c) => c.id === selectedCircleId) ?? null,
    [myCircles, selectedCircleId],
  );

  // UI state — defaulted on first mount; rehydrated when `config`
  // arrives. Save persists optimistic state and the hook busts the
  // cache, so the screen state IS the source of truth until next
  // focus refetches.
  const [enabled, setEnabled] = useState(true);
  const [methodId, setMethodId] = useState<string>(WALLET_METHOD_ID);
  const [scheduleType, setScheduleType] = useState<"on_due" | "days_before">(
    "on_due",
  );
  const [daysBefore, setDaysBefore] = useState<number>(3);
  // Phase 2 — opt-in round-up sweep.
  const [roundUpEnabled, setRoundUpEnabled] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  // Pre-select default pay-in method on first mount unless we already
  // have a saved config.
  useEffect(() => {
    if (config) return;
    if (defaultPaymentMethod?.id) {
      setMethodId(defaultPaymentMethod.id);
    }
  }, [config, defaultPaymentMethod?.id]);

  // Hydrate from the saved config when it lands.
  useEffect(() => {
    if (!config) return;
    setEnabled(config.enabled);
    setMethodId(
      config.payment_method_type === "wallet" || !config.payment_method_id
        ? WALLET_METHOD_ID
        : config.payment_method_id,
    );
    setScheduleType(config.schedule_type);
    setDaysBefore(config.days_before || 3);
    // Phase 2 — restore the saved round-up choice.
    setRoundUpEnabled(!!config.round_up_enabled);
  }, [config]);

  // Payment-method picker rows: wallet always first, then real PMs.
  const methodRows = useMemo(() => {
    const wallet = {
      id: WALLET_METHOD_ID,
      label: t("circle_autopay_setup.wallet_label"),
      sub: t("circle_autopay_setup.wallet_balance", {
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

  const amountDollars = selectedCircle?.amount ?? 0;

  const handleSave = useCallback(async () => {
    if (!selectedCircleId || !selectedCircle) {
      showToast(t("circle_autopay_setup.err_pick_circle"), "error");
      return;
    }
    if (amountDollars <= 0) {
      showToast(t("circle_autopay_setup.err_amount_unknown"), "error");
      return;
    }
    setSaving(true);
    try {
      const chosen = methodRows.find((m) => m.id === methodId);
      const isWallet = chosen?.isWallet ?? true;
      const real = isWallet
        ? undefined
        : paymentMethods.find((m) => m.id === methodId);
      const params: SaveCircleAutopayParams = {
        enabled,
        paymentMethodId: isWallet ? null : methodId,
        paymentMethodType: isWallet
          ? "wallet"
          : ((real?.type === "us_bank_account"
              ? "us_bank_account"
              : "card") as "card" | "us_bank_account"),
        contributionAmountCents: Math.round(amountDollars * 100),
        scheduleType,
        daysBefore: scheduleType === "days_before" ? daysBefore : 0,
        roundUpEnabled,
      };
      await save(params);
      showToast(t("circle_autopay_setup.toast_saved"), "success");
      navigation.goBack();
    } catch (err: any) {
      showToast(
        err?.message || t("circle_autopay_setup.toast_save_failed"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [
    selectedCircleId,
    selectedCircle,
    amountDollars,
    methodRows,
    methodId,
    paymentMethods,
    enabled,
    scheduleType,
    daysBefore,
    save,
    navigation,
    t,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("circle_autopay_setup.a11y_back")}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {t("circle_autopay_setup.header_title")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t("circle_autopay_setup.header_subtitle")}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Circle picker / display */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t("circle_autopay_setup.section_circle")}
            </Text>
            {preSelectedCircleId && selectedCircle ? (
              <View style={styles.staticCircleRow}>
                <Ionicons name="people-circle" size={28} color={TEAL} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.staticCircleName}>
                    {selectedCircle.name}
                  </Text>
                  <Text style={styles.staticCircleAmount}>
                    {t("circle_autopay_setup.circle_amount_per_cycle", {
                      amount: amountDollars.toFixed(2),
                      frequency: selectedCircle.frequency,
                    })}
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => setCirclePickerOpen(true)}
              >
                <Ionicons name="people-circle-outline" size={24} color={NAVY} />
                <Text style={styles.pickerText}>
                  {selectedCircle
                    ? selectedCircle.name
                    : t("circle_autopay_setup.tap_to_pick_circle")}
                </Text>
                <Ionicons name="chevron-down" size={18} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>

          {/* Payment method */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t("circle_autopay_setup.section_method")}
            </Text>
            <View style={styles.methodsList}>
              {methodRows.map((m) => {
                const selected = methodId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.methodRow,
                      selected && styles.methodRowSelected,
                    ]}
                    onPress={() => setMethodId(m.id)}
                  >
                    <Ionicons name={m.icon} size={20} color={NAVY} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.methodName}>{m.label}</Text>
                      {!!m.sub && <Text style={styles.methodSub}>{m.sub}</Text>}
                    </View>
                    <View
                      style={[
                        styles.radioDot,
                        selected && styles.radioDotSelected,
                      ]}
                    >
                      {selected && (
                        <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Amount (read-only) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t("circle_autopay_setup.section_amount")}
            </Text>
            <Text style={styles.amountValue}>${amountDollars.toFixed(2)}</Text>
            <Text style={styles.amountHint}>
              {t("circle_autopay_setup.amount_locked_hint")}
            </Text>
          </View>

          {/* Schedule */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t("circle_autopay_setup.section_schedule")}
            </Text>
            <View style={styles.segmentRow}>
              <SegmentChip
                label={t("circle_autopay_setup.schedule_on_due")}
                selected={scheduleType === "on_due"}
                onPress={() => setScheduleType("on_due")}
              />
              <SegmentChip
                label={t("circle_autopay_setup.schedule_days_before")}
                selected={scheduleType === "days_before"}
                onPress={() => setScheduleType("days_before")}
              />
            </View>

            {scheduleType === "days_before" && (
              <View style={styles.daysRow}>
                {DAYS_BEFORE_OPTIONS.map((d) => {
                  const sel = daysBefore === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, sel && styles.dayChipSelected]}
                      onPress={() => setDaysBefore(d)}
                    >
                      <Text
                        style={[
                          styles.dayChipValue,
                          sel && styles.dayChipValueSelected,
                        ]}
                      >
                        {d}
                      </Text>
                      <Text
                        style={[
                          styles.dayChipUnit,
                          sel && styles.dayChipUnitSelected,
                        ]}
                      >
                        {t("circle_autopay_setup.day_unit", { count: d })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Enabled toggle */}
          <View style={styles.sectionCard}>
            <View style={styles.toggleHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.sectionTitle}>
                  {t("circle_autopay_setup.section_enabled")}
                </Text>
                <Text style={styles.toggleHint}>
                  {t("circle_autopay_setup.enabled_hint")}
                </Text>
              </View>
              {configLoading ? (
                <ActivityIndicator size="small" color={TEAL} />
              ) : (
                <Toggle value={enabled} onToggle={() => setEnabled(!enabled)} />
              )}
            </View>
          </View>

          {/* Phase 2 — Round-up sweep toggle. Opt-in. When on,
              wallet-funded sends round up to the next dollar and the
              cents-delta is credited to this circle's next
              contribution. Surplus carries over. */}
          <View style={styles.sectionCard}>
            <View style={styles.toggleHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.sectionTitle}>
                  {t("circle_autopay_setup.section_round_up")}
                </Text>
                <Text style={styles.toggleHint}>
                  {t("circle_autopay_setup.round_up_hint")}
                </Text>
              </View>
              <Toggle
                value={roundUpEnabled}
                onToggle={() => setRoundUpEnabled(!roundUpEnabled)}
              />
            </View>

            {/* Surfaces the accumulated credit so the user sees the
                feature working. Only shown when there's a saved config
                with a non-zero credit. */}
            {!!config && config.pending_round_up_credit_cents > 0 && (
              <View style={styles.creditChip}>
                <Ionicons name="cash-outline" size={14} color="#047857" />
                <Text style={styles.creditChipText}>
                  {t("circle_autopay_setup.round_up_credit", {
                    amount: (
                      config.pending_round_up_credit_cents / 100
                    ).toFixed(2),
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!selectedCircleId || saving) && styles.primaryButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!selectedCircleId || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {t("circle_autopay_setup.btn_save")}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Circle picker modal — only used when the route didn't pre-select. */}
      <Modal
        visible={circlePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCirclePickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCirclePickerOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {t("circle_autopay_setup.modal_pick_circle_title")}
            </Text>
            {myCircles.length === 0 ? (
              <Text style={styles.modalEmpty}>
                {t("circle_autopay_setup.modal_no_circles")}
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {myCircles.map((c) => {
                  const sel = selectedCircleId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.modalRow,
                        sel && styles.modalRowSelected,
                      ]}
                      onPress={() => {
                        setSelectedCircleId(c.id);
                        setCirclePickerOpen(false);
                      }}
                    >
                      <Ionicons
                        name="people-circle"
                        size={22}
                        color={sel ? TEAL : NAVY}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalRowName}>{c.name}</Text>
                        <Text style={styles.modalRowAmount}>
                          ${c.amount.toFixed(2)} / {c.frequency}
                        </Text>
                      </View>
                      {sel && (
                        <Ionicons name="checkmark-circle" size={18} color={TEAL} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SegmentChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentChip, selected && styles.segmentChipSelected]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.segmentChipText,
          selected && styles.segmentChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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

  content: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: NAVY },

  staticCircleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  staticCircleName: { fontSize: 15, fontWeight: "700", color: NAVY },
  staticCircleAmount: { fontSize: 12, color: MUTED, marginTop: 2 },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingVertical: 10,
  },
  pickerText: { flex: 1, fontSize: 14, color: NAVY, fontWeight: "600" },

  methodsList: { gap: 8, marginTop: 12 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  methodRowSelected: {
    backgroundColor: "#F0FDFB",
    borderColor: TEAL,
    borderWidth: 2,
    margin: -1,
  },
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

  amountValue: {
    fontSize: 24,
    fontWeight: "800",
    color: NAVY,
    marginTop: 12,
  },
  amountHint: { fontSize: 11, color: MUTED, marginTop: 4 },

  segmentRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  segmentChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  segmentChipSelected: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  segmentChipText: { fontSize: 13, fontWeight: "600", color: NAVY },
  segmentChipTextSelected: { color: "#00897B" },

  daysRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  dayChipSelected: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  dayChipValue: { fontSize: 14, fontWeight: "700", color: NAVY },
  dayChipValueSelected: { color: "#00897B" },
  dayChipUnit: { fontSize: 9, color: MUTED, marginTop: 1 },
  dayChipUnitSelected: { color: "#00897B" },

  toggleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  toggleHint: { fontSize: 12, color: MUTED, marginTop: 4 },

  // Phase 2 — accumulated round-up credit pill.
  creditChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
  },
  creditChipText: { fontSize: 12, fontWeight: "700", color: "#047857" },

  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: BORDER,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: TEAL },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobOn: { alignSelf: "flex-end" },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: "#9CA3AF" },
  primaryButtonText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  // Modal styles for the circle picker
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 12,
  },
  modalEmpty: {
    fontSize: 13,
    color: MUTED,
    paddingVertical: 24,
    textAlign: "center",
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalRowSelected: { backgroundColor: "#F0FDFB" },
  modalRowName: { fontSize: 14, fontWeight: "700", color: NAVY },
  modalRowAmount: { fontSize: 12, color: MUTED, marginTop: 2 },
});
