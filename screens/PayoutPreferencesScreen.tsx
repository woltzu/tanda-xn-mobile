// screens/PayoutPreferencesScreen.tsx
//
// One screen for both the global-default and per-circle-override
// payout destination. Route param circleId flips the scope: absent →
// scope='default'; present → scope='circle_specific' with circle_id.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import ScreenHeader from "../components/ScreenHeader";
import ScreenState from "../components/ScreenState";
import { AppFlashList } from "../components/AppFlashList";
import { showToast } from "../components/Toast";
import { colors } from "../theme/tokens";
import { useCircles } from "../context/CirclesContext";
import {
  usePayoutPreference,
  PayoutDestinationKind,
  PayoutSplitEntry,
} from "../hooks/usePayoutPreference";

type NavProp = StackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "PayoutPreferences">;

export default function PayoutPreferencesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const circleId = route.params?.circleId;
  const { myCircles } = useCircles();
  const circleName = useMemo(
    () => myCircles.find((c) => c.id === circleId)?.name ?? "",
    [myCircles, circleId],
  );

  const {
    preference,
    bankOptions,
    goalOptions,
    isLoading,
    savePreference,
    refresh,
  } = usePayoutPreference(circleId);

  const [destination, setDestination] = useState<PayoutDestinationKind>("wallet");
  const [bankId, setBankId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [split, setSplit] = useState<PayoutSplitEntry[]>([
    { destination: "wallet", percentage: 50 },
    { destination: "bank", percentage: 50 },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!preference) return;
    setDestination(preference.destination);
    setBankId(preference.bank_account_id);
    setGoalId(preference.savings_goal_id);
    if (preference.split_config && preference.split_config.length > 0) {
      setSplit(preference.split_config);
    }
  }, [preference]);

  const bankDisabled = bankOptions.length === 0;
  const goalDisabled = goalOptions.length === 0;

  const splitTotal = split.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);
  const splitValid = split.length >= 2 && Math.round(splitTotal) === 100;

  const canSave =
    destination === "wallet" ||
    (destination === "bank" && !!bankId) ||
    (destination === "goal" && !!goalId) ||
    (destination === "split" && splitValid);

  const handleSave = async () => {
    if (!canSave || saving) return;
    if (destination === "split" && !splitValid) {
      if (split.length < 2) {
        Alert.alert("", t("payout_preferences.split_min_error"));
        return;
      }
      Alert.alert("", t("payout_preferences.split_sum_error"));
      return;
    }
    setSaving(true);
    try {
      await savePreference({
        preference_scope: circleId ? "circle_specific" : "default",
        circle_id: circleId ?? null,
        destination,
        bank_account_id: bankId,
        savings_goal_id: goalId,
        split_config: destination === "split" ? split : null,
      });
      showToast(t("payout_preferences.saved"), "success");
      await refresh();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(
        t("payout_preferences.error"),
        err?.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateSplitRow = (index: number, patch: Partial<PayoutSplitEntry>) => {
    setSplit((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const addSplitRow = () => {
    if (split.length >= 4) return;
    setSplit((prev) => [...prev, { destination: "wallet", percentage: 0 }]);
  };
  const removeSplitRow = (index: number) => {
    if (split.length <= 2) return;
    setSplit((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading && !preference) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t("payout_preferences.title_global")} />
        <ScreenState type="loading" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={
          circleId && circleName
            ? t("payout_preferences.title_circle", { circle: circleName })
            : t("payout_preferences.title_global")
        }
        onBackPress={() => navigation.goBack()}
      />
      <AppFlashList
        data={[0]}
        keyExtractor={() => "form"}
        estimatedItemSize={800}
        contentContainerStyle={styles.content}
        renderItem={() => (
          <View>
            {circleId && (
              <Text style={styles.scopeNote}>
                {t("payout_preferences.scope_circle")}
              </Text>
            )}

            <Text style={styles.sectionLabel}>
              {t("payout_preferences.destination_label")}
            </Text>
            <DestinationRadio
              value="wallet"
              current={destination}
              label={t("payout_preferences.destination_wallet")}
              onPress={setDestination}
            />
            <DestinationRadio
              value="bank"
              current={destination}
              label={t("payout_preferences.destination_bank")}
              onPress={setDestination}
              disabled={bankDisabled}
              disabledHint={t("payout_preferences.no_banks")}
            />
            <DestinationRadio
              value="goal"
              current={destination}
              label={t("payout_preferences.destination_goal")}
              onPress={setDestination}
              disabled={goalDisabled}
              disabledHint={t("payout_preferences.no_goals")}
            />
            <DestinationRadio
              value="split"
              current={destination}
              label={t("payout_preferences.destination_split")}
              onPress={setDestination}
            />

            {destination === "bank" && (
              <BankPicker
                options={bankOptions}
                selectedId={bankId}
                onSelect={setBankId}
                placeholder={t("payout_preferences.bank_placeholder")}
              />
            )}
            {destination === "goal" && (
              <GoalPicker
                options={goalOptions}
                selectedId={goalId}
                onSelect={setGoalId}
                placeholder={t("payout_preferences.goal_placeholder")}
              />
            )}
            {destination === "split" && (
              <SplitEditor
                rows={split}
                onChangeRow={updateSplitRow}
                onAdd={addSplitRow}
                onRemove={removeSplitRow}
                total={splitTotal}
                t={t}
                bankName={
                  bankOptions[0]?.nickname || bankOptions[0]?.bank_name || ""
                }
                goalName={goalOptions[0]?.name || ""}
              />
            )}

            <TouchableOpacity
              style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave || saving}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>
                {t("payout_preferences.save")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

function DestinationRadio({
  value,
  current,
  label,
  onPress,
  disabled,
  disabledHint,
}: {
  value: PayoutDestinationKind;
  current: PayoutDestinationKind;
  label: string;
  onPress: (v: PayoutDestinationKind) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const active = value === current;
  return (
    <TouchableOpacity
      style={[
        styles.radioRow,
        active && styles.radioRowActive,
        disabled && styles.radioRowDisabled,
      ]}
      onPress={() => !disabled && onPress(value)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
    >
      <View style={[styles.radioDot, active && styles.radioDotActive]}>
        {active && <View style={styles.radioDotInner} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.radioLabel, disabled && styles.radioLabelDisabled]}>
          {label}
        </Text>
        {disabled && disabledHint ? (
          <Text style={styles.radioHint}>{disabledHint}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function BankPicker({
  options,
  selectedId,
  onSelect,
  placeholder,
}: {
  options: { id: string; bank_name: string; account_last4: string | null; nickname: string | null }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.pickerCard}>
      {options.length === 0 ? (
        <Text style={styles.pickerPlaceholder}>{placeholder}</Text>
      ) : (
        options.map((b) => {
          const active = b.id === selectedId;
          const label = b.nickname
            ? b.nickname
            : `${b.bank_name}${b.account_last4 ? ` •••• ${b.account_last4}` : ""}`;
          return (
            <TouchableOpacity
              key={b.id}
              style={[styles.pickerRow, active && styles.pickerRowActive]}
              onPress={() => onSelect(b.id)}
            >
              <Ionicons
                name={active ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={active ? colors.accentTeal : colors.textSecondary}
              />
              <Text style={styles.pickerLabel}>{label}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

function GoalPicker({
  options,
  selectedId,
  onSelect,
  placeholder,
}: {
  options: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.pickerCard}>
      {options.length === 0 ? (
        <Text style={styles.pickerPlaceholder}>{placeholder}</Text>
      ) : (
        options.map((g) => {
          const active = g.id === selectedId;
          return (
            <TouchableOpacity
              key={g.id}
              style={[styles.pickerRow, active && styles.pickerRowActive]}
              onPress={() => onSelect(g.id)}
            >
              <Ionicons
                name={active ? "radio-button-on" : "radio-button-off"}
                size={18}
                color={active ? colors.accentTeal : colors.textSecondary}
              />
              <Text style={styles.pickerLabel}>{g.name}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

function SplitEditor({
  rows,
  onChangeRow,
  onAdd,
  onRemove,
  total,
  t,
  bankName,
  goalName,
}: {
  rows: PayoutSplitEntry[];
  onChangeRow: (i: number, patch: Partial<PayoutSplitEntry>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  total: number;
  t: (k: string, opts?: any) => string;
  bankName: string;
  goalName: string;
}) {
  const labelFor = (kind: PayoutSplitEntry["destination"]) => {
    if (kind === "wallet") return t("payout_preferences.split_row_wallet");
    if (kind === "bank") return t("payout_preferences.split_row_bank", { name: bankName });
    return t("payout_preferences.split_row_goal", { name: goalName });
  };
  const cycleDestination = (i: number, current: PayoutSplitEntry["destination"]) => {
    const order: PayoutSplitEntry["destination"][] = ["wallet", "bank", "goal"];
    const next = order[(order.indexOf(current) + 1) % order.length];
    onChangeRow(i, { destination: next });
  };
  return (
    <View style={styles.splitCard}>
      {rows.map((row, idx) => (
        <View key={idx} style={styles.splitRow}>
          <TouchableOpacity
            style={styles.splitDestButton}
            onPress={() => cycleDestination(idx, row.destination)}
          >
            <Text style={styles.splitDestText}>{labelFor(row.destination)}</Text>
            <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.splitInput}
            keyboardType="numeric"
            value={String(row.percentage)}
            onChangeText={(v) => {
              const n = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
              onChangeRow(idx, { percentage: n });
            }}
          />
          <Text style={styles.splitPct}>%</Text>
          <TouchableOpacity
            onPress={() => onRemove(idx)}
            disabled={rows.length <= 2}
            style={styles.splitRemove}
          >
            <Ionicons
              name="close"
              size={16}
              color={rows.length <= 2 ? colors.textSecondary : colors.errorText}
            />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={onAdd} style={styles.splitAdd} disabled={rows.length >= 4}>
        <Ionicons name="add" size={16} color={colors.accentTeal} />
        <Text style={styles.splitAddText}>{t("payout_preferences.split_add")}</Text>
      </TouchableOpacity>
      <Text
        style={[
          styles.splitTotal,
          Math.round(total) !== 100 && styles.splitTotalError,
        ]}
      >
        Total: {total}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: 16, paddingBottom: 40 },
  scopeNote: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  radioRowActive: { borderColor: colors.accentTeal, backgroundColor: "#ECFDF5" },
  radioRowDisabled: { opacity: 0.5 },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotActive: { borderColor: colors.accentTeal },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentTeal,
  },
  radioLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: "500" },
  radioLabelDisabled: { color: colors.textSecondary },
  radioHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pickerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pickerPlaceholder: { fontSize: 13, color: colors.textSecondary, padding: 12 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  pickerRowActive: { backgroundColor: "#ECFDF5", borderRadius: 8 },
  pickerLabel: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  splitCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  splitDestButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  splitDestText: { fontSize: 13, color: colors.textPrimary, flex: 1 },
  splitInput: {
    width: 60,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    textAlign: "center",
    fontSize: 14,
  },
  splitPct: { fontSize: 14, color: colors.textSecondary },
  splitRemove: { padding: 4 },
  splitAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
    marginTop: 4,
  },
  splitAddText: { fontSize: 13, color: colors.accentTeal, fontWeight: "600" },
  splitTotal: {
    marginTop: 8,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  splitTotalError: { color: colors.errorText },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.accentTeal,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#D1D5DB" },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
