// screens/PayoutPreferencesScreen.tsx
//
// Payout-destination preference form. Same route params + save flow
// as the initial ship (064cdc3); this pass swaps the radios for
// tappable cards and turns the split editor into a live segmented
// bar + auto-balancing sliders so a user can drag one destination
// higher and see the others give ground proportionally.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
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

// Palette used for segments + slider tracks. Kept off-tokens so
// individual destinations stay visually distinct even where the app
// theme tinkers with accentTeal / primaryNavy.
const DEST_COLOR: Record<PayoutSplitEntry["destination"], string> = {
  wallet: "#00C6AE",
  bank: "#3B82F6",
  goal: "#8B5CF6",
};
const DEST_ICON: Record<PayoutSplitEntry["destination"], keyof typeof Ionicons.glyphMap> = {
  wallet: "wallet-outline",
  bank: "business-outline",
  goal: "flag-outline",
};

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
    if (preference.split_config && preference.split_config.length >= 2) {
      setSplit(preference.split_config);
    }
  }, [preference]);

  const bankDisabled = bankOptions.length === 0;
  const goalDisabled = goalOptions.length === 0;

  const splitTotal = split.reduce(
    (sum, r) => sum + (Number(r.percentage) || 0),
    0,
  );
  const splitValid = split.length >= 2 && Math.round(splitTotal) === 100;

  const canSave =
    destination === "wallet" ||
    (destination === "bank" && !!bankId) ||
    (destination === "goal" && !!goalId) ||
    (destination === "split" && splitValid);

  // Auto-balance: when the user drags slider `idx` to `value`, hold
  // its neighbours proportionally so the total stays 100. When the
  // others are collectively at 0 (edge case), spread the remainder
  // equally so the sliders never freeze.
  const handleSliderChange = (idx: number, rawValue: number) => {
    const value = Math.round(rawValue);
    const oldValue = split[idx].percentage;
    if (value === oldValue) return;

    const others = split.filter((_, i) => i !== idx);
    const remaining = 100 - value;
    const otherSum = others.reduce((s, r) => s + r.percentage, 0);

    let scaled: PayoutSplitEntry[];
    if (otherSum <= 0) {
      const share = Math.round(remaining / others.length);
      scaled = others.map((r) => ({ ...r, percentage: share }));
    } else {
      scaled = others.map((r) => ({
        ...r,
        percentage: Math.round((r.percentage * remaining) / otherSum),
      }));
    }
    // Absorb rounding drift onto the last non-target row so
    // sum(all) is exactly 100.
    const scaledSum = scaled.reduce((s, r) => s + r.percentage, 0);
    const drift = remaining - scaledSum;
    if (scaled.length > 0 && drift !== 0) {
      scaled[scaled.length - 1] = {
        ...scaled[scaled.length - 1],
        percentage: Math.max(
          0,
          Math.min(100, scaled[scaled.length - 1].percentage + drift),
        ),
      };
    }

    const rebuilt: PayoutSplitEntry[] = [];
    let scaledIdx = 0;
    for (let i = 0; i < split.length; i++) {
      if (i === idx) rebuilt.push({ ...split[i], percentage: value });
      else rebuilt.push(scaled[scaledIdx++]);
    }
    setSplit(rebuilt);
  };

  const cycleSplitDestination = (idx: number) => {
    const order: PayoutSplitEntry["destination"][] = ["wallet", "bank", "goal"];
    setSplit((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              destination: order[(order.indexOf(r.destination) + 1) % order.length],
            }
          : r,
      ),
    );
  };

  const addSplitRow = () => {
    if (split.length >= 3) return;
    // Insert at 0% so the auto-balance handler can grow it from
    // scratch — safer than shifting existing values around silently.
    const usedTypes = new Set(split.map((r) => r.destination));
    const next: PayoutSplitEntry["destination"] =
      (["wallet", "bank", "goal"] as const).find((d) => !usedTypes.has(d)) ??
      "goal";
    setSplit((prev) => [...prev, { destination: next, percentage: 0 }]);
  };

  const removeSplitRow = (idx: number) => {
    if (split.length <= 2) return;
    const removed = split[idx];
    const remaining = split.filter((_, i) => i !== idx);
    const otherSum = remaining.reduce((s, r) => s + r.percentage, 0);
    if (otherSum > 0) {
      // Distribute the removed row's share proportionally so total
      // stays at 100.
      const factor = 100 / otherSum;
      const rescaled = remaining.map((r) => ({
        ...r,
        percentage: Math.round(r.percentage * factor),
      }));
      const drift = 100 - rescaled.reduce((s, r) => s + r.percentage, 0);
      if (rescaled.length > 0 && drift !== 0) {
        rescaled[0] = { ...rescaled[0], percentage: rescaled[0].percentage + drift };
      }
      setSplit(rescaled);
    } else {
      const share = Math.round(100 / remaining.length);
      setSplit(remaining.map((r) => ({ ...r, percentage: share })));
    }
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    if (destination === "split" && !splitValid) {
      Alert.alert(
        "",
        split.length < 2
          ? t("payout_preferences.split_min_error")
          : t("payout_preferences.split_sum_error"),
      );
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
        estimatedItemSize={900}
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

            <DestCard
              kind="wallet"
              label={t("payout_preferences.destination_wallet")}
              description={t("payout_preferences.destination_wallet_desc")}
              current={destination}
              onPress={() => setDestination("wallet")}
            />
            <DestCard
              kind="bank"
              label={t("payout_preferences.destination_bank")}
              description={
                bankDisabled
                  ? t("payout_preferences.no_banks")
                  : t("payout_preferences.destination_bank_desc")
              }
              current={destination}
              disabled={bankDisabled}
              onPress={() => setDestination("bank")}
            />
            <DestCard
              kind="goal"
              label={t("payout_preferences.destination_goal")}
              description={
                goalDisabled
                  ? t("payout_preferences.no_goals")
                  : t("payout_preferences.destination_goal_desc")
              }
              current={destination}
              disabled={goalDisabled}
              onPress={() => setDestination("goal")}
            />
            <DestCard
              kind="split"
              label={t("payout_preferences.destination_split")}
              description={t("payout_preferences.destination_split_desc")}
              current={destination}
              onPress={() => setDestination("split")}
            />

            {destination === "bank" && (
              <SubPickerCards
                options={bankOptions.map((b) => ({
                  id: b.id,
                  title: b.nickname || b.bank_name,
                  subtitle: b.account_last4 ? `•••• ${b.account_last4}` : "",
                  icon: "business-outline",
                  tint: DEST_COLOR.bank,
                }))}
                selectedId={bankId}
                onSelect={setBankId}
                placeholder={t("payout_preferences.bank_placeholder")}
              />
            )}
            {destination === "goal" && (
              <SubPickerCards
                options={goalOptions.map((g) => ({
                  id: g.id,
                  title: g.name,
                  subtitle: "",
                  icon: "flag-outline",
                  tint: DEST_COLOR.goal,
                }))}
                selectedId={goalId}
                onSelect={setGoalId}
                placeholder={t("payout_preferences.goal_placeholder")}
              />
            )}
            {destination === "split" && (
              <SplitEditor
                rows={split}
                bankDisabled={bankDisabled}
                goalDisabled={goalDisabled}
                onSliderChange={handleSliderChange}
                onCycleDest={cycleSplitDestination}
                onAdd={addSplitRow}
                onRemove={removeSplitRow}
                total={splitTotal}
                t={t}
                bankLabel={
                  bankOptions[0]?.nickname || bankOptions[0]?.bank_name || ""
                }
                goalLabel={goalOptions[0]?.name || ""}
              />
            )}

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!canSave || saving) && styles.saveButtonDisabled,
              ]}
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

// ── DestCard ────────────────────────────────────────────────────────────
// Tappable card with an icon tile + title + short description. Selected
// state uses the accent border + a soft ECFDF5 background to match the
// rest of the design system.

function DestCard({
  kind,
  label,
  description,
  current,
  onPress,
  disabled,
}: {
  kind: PayoutDestinationKind;
  label: string;
  description: string;
  current: PayoutDestinationKind;
  onPress: () => void;
  disabled?: boolean;
}) {
  const active = current === kind;
  const iconName: keyof typeof Ionicons.glyphMap =
    kind === "split" ? "git-branch-outline" : DEST_ICON[kind];
  const tint =
    kind === "split" ? colors.accentTeal : DEST_COLOR[kind as PayoutSplitEntry["destination"]];
  return (
    <TouchableOpacity
      style={[
        styles.destCard,
        active && styles.destCardActive,
        disabled && styles.destCardDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, disabled }}
    >
      <View
        style={[
          styles.destIcon,
          {
            backgroundColor: active ? tint : `${tint}22`,
          },
        ]}
      >
        <Ionicons
          name={iconName}
          size={20}
          color={active ? "#FFFFFF" : tint}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.destTitle,
            disabled && styles.destTitleDisabled,
          ]}
        >
          {label}
        </Text>
        <Text style={styles.destDesc}>{description}</Text>
      </View>
      <View style={[styles.radioDot, active && styles.radioDotActive]}>
        {active && <View style={styles.radioDotInner} />}
      </View>
    </TouchableOpacity>
  );
}

// ── SubPickerCards ──────────────────────────────────────────────────────
// Cards for Bank / Goal sub-selection. Renders a placeholder card when
// the source list is empty so the section doesn't collapse silently.

function SubPickerCards({
  options,
  selectedId,
  onSelect,
  placeholder,
}: {
  options: {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
  }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  if (options.length === 0) {
    return (
      <View style={styles.subEmpty}>
        <Text style={styles.subEmptyText}>{placeholder}</Text>
      </View>
    );
  }
  return (
    <View style={{ marginTop: 8 }}>
      {options.map((o) => {
        const active = o.id === selectedId;
        return (
          <TouchableOpacity
            key={o.id}
            style={[styles.subCard, active && styles.subCardActive]}
            onPress={() => onSelect(o.id)}
          >
            <View style={[styles.subIcon, { backgroundColor: `${o.tint}22` }]}>
              <Ionicons name={o.icon} size={18} color={o.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subTitle}>{o.title}</Text>
              {!!o.subtitle && (
                <Text style={styles.subSubtitle}>{o.subtitle}</Text>
              )}
            </View>
            <Ionicons
              name={active ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={active ? colors.accentTeal : "#9CA3AF"}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── SplitEditor ─────────────────────────────────────────────────────────
// Live segmented bar + one Slider per destination. Add-row grows the
// split up to 3 buckets (wallet + bank + goal); remove-row scales the
// survivors back up to 100 %.

function SplitEditor({
  rows,
  bankDisabled,
  goalDisabled,
  onSliderChange,
  onCycleDest,
  onAdd,
  onRemove,
  total,
  t,
  bankLabel,
  goalLabel,
}: {
  rows: PayoutSplitEntry[];
  bankDisabled: boolean;
  goalDisabled: boolean;
  onSliderChange: (i: number, v: number) => void;
  onCycleDest: (i: number) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  total: number;
  t: (k: string, opts?: any) => string;
  bankLabel: string;
  goalLabel: string;
}) {
  const totalValid = Math.round(total) === 100;
  const nameFor = (kind: PayoutSplitEntry["destination"]) => {
    if (kind === "wallet") return t("payout_preferences.split_row_wallet");
    if (kind === "bank")
      return t("payout_preferences.split_row_bank", { name: bankLabel || "Bank" });
    return t("payout_preferences.split_row_goal", { name: goalLabel || "Goal" });
  };
  return (
    <View style={styles.splitCard}>
      {/* Segmented distribution bar */}
      <View style={styles.segmentBar}>
        {rows.map((r, i) => (
          <View
            key={i}
            style={{
              flex: Math.max(0, r.percentage),
              backgroundColor: DEST_COLOR[r.destination],
            }}
          />
        ))}
        {rows.every((r) => r.percentage === 0) && (
          <View style={{ flex: 1, backgroundColor: "#E5E7EB" }} />
        )}
      </View>
      <View style={styles.legendRow}>
        {rows.map((r, i) => (
          <View key={i} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: DEST_COLOR[r.destination] },
              ]}
            />
            <Text style={styles.legendText}>
              {nameFor(r.destination)} · {r.percentage}%
            </Text>
          </View>
        ))}
      </View>

      {/* One slider per row */}
      {rows.map((r, i) => {
        const disabled =
          (r.destination === "bank" && bankDisabled) ||
          (r.destination === "goal" && goalDisabled);
        return (
          <View key={i} style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <TouchableOpacity
                style={styles.sliderDestButton}
                onPress={() => onCycleDest(i)}
              >
                <Ionicons
                  name={DEST_ICON[r.destination]}
                  size={16}
                  color={DEST_COLOR[r.destination]}
                />
                <Text style={styles.sliderDestText}>
                  {nameFor(r.destination)}
                </Text>
                <Ionicons
                  name="swap-vertical"
                  size={12}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <Text style={styles.sliderPercent}>{r.percentage}%</Text>
              <TouchableOpacity
                onPress={() => onRemove(i)}
                disabled={rows.length <= 2}
                style={styles.sliderRemove}
              >
                <Ionicons
                  name="close"
                  size={14}
                  color={rows.length <= 2 ? "#D1D5DB" : "#DC2626"}
                />
              </TouchableOpacity>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={r.percentage}
              onValueChange={(v) => onSliderChange(i, v)}
              disabled={disabled}
              minimumTrackTintColor={DEST_COLOR[r.destination]}
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor={DEST_COLOR[r.destination]}
              style={styles.slider}
            />
            {disabled && (
              <Text style={styles.sliderHint}>
                {r.destination === "bank"
                  ? t("payout_preferences.no_banks")
                  : t("payout_preferences.no_goals")}
              </Text>
            )}
          </View>
        );
      })}

      {rows.length < 3 && (
        <TouchableOpacity onPress={onAdd} style={styles.splitAdd}>
          <Ionicons name="add-circle-outline" size={16} color={colors.accentTeal} />
          <Text style={styles.splitAddText}>
            {t("payout_preferences.split_add")}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.totalRow}>
        <Text
          style={[
            styles.totalText,
            !totalValid && styles.totalTextError,
          ]}
        >
          {t("payout_preferences.split_total")}: {total}%
        </Text>
        {!totalValid && (
          <Text style={styles.totalError}>
            {t("payout_preferences.split_sum_error")}
          </Text>
        )}
      </View>
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
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },

  // Destination cards
  destCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  destCardActive: {
    borderColor: colors.accentTeal,
    backgroundColor: "#ECFDF5",
    shadowColor: colors.accentTeal,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  destCardDisabled: { opacity: 0.5 },
  destIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  destTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  destTitleDisabled: { color: colors.textSecondary },
  destDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
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

  // Sub-picker cards (bank / goal single-select)
  subEmpty: {
    padding: 14,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    marginTop: 8,
  },
  subEmptyText: { fontSize: 13, color: "#92400E" },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  subCardActive: { borderColor: colors.accentTeal, backgroundColor: "#ECFDF5" },
  subIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  subTitle: { fontSize: 14, color: colors.textPrimary, fontWeight: "500" },
  subSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Split editor
  splitCard: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  segmentBar: {
    height: 16,
    borderRadius: 8,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    marginBottom: 12,
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.textSecondary },

  sliderBlock: { marginTop: 12 },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sliderDestButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
  },
  sliderDestText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
  },
  sliderPercent: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "700",
    width: 44,
    textAlign: "right",
  },
  sliderRemove: { padding: 4 },
  slider: { width: "100%", height: 32 },
  sliderHint: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  splitAdd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    marginTop: 8,
  },
  splitAddText: { fontSize: 13, color: colors.accentTeal, fontWeight: "600" },
  totalRow: { marginTop: 12, alignItems: "flex-end" },
  totalText: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  totalTextError: { color: colors.errorText },
  totalError: { fontSize: 11, color: colors.errorText, marginTop: 4 },

  // Save button
  saveButton: {
    marginTop: 28,
    backgroundColor: colors.accentTeal,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: colors.accentTeal,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
