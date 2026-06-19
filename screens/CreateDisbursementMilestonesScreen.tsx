// ══════════════════════════════════════════════════════════════════════════════
// CreateDisbursementMilestonesScreen — the goal-owner wizard
// ══════════════════════════════════════════════════════════════════════════════
// Phase 2B. Goal owner attaches the previously-linked provider to a set of
// staged-disbursement milestones whose amounts sum to the goal target.
//
// State machine (client-side):
//   1. Inputs: goalId (required), providerId (required). Both come in via
//      route params — populated when the user taps "Create milestones" from
//      GoalDetailV2.
//   2. The user adds rows, each with name / description / amount /
//      verification_method. The sum is shown live against the goal
//      target; submit is disabled until the sum matches exactly.
//   3. Reorder via up/down arrows so order_index reflects the rendered
//      sequence on submit.
//   4. Submit calls create_goal_disbursement_milestones; on success
//      navigation.replace to GoalDisbursementMilestones for the goalId.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import {
  CreateMilestoneInput,
  DisbursementVerificationMethod,
  useDisbursementActions,
} from "../hooks/useGoalDisbursementMilestones";

type RouteParams = { goalId: string; providerId: string };

type GoalRow = {
  id: string;
  name: string | null;
  target_amount_cents: number;
  project_latitude: number | null;
  project_longitude: number | null;
};

type ProviderRow = {
  id: string;
  business_name: string;
  verification_level: number;
  max_project_value_cents: number | null;
};

type Draft = {
  key: string;
  name: string;
  description: string;
  amountText: string;
  verification_method: DisbursementVerificationMethod;
};

const METHODS: DisbursementVerificationMethod[] = ["owner", "elder", "admin"];

let keyCounter = 0;
const newKey = () => `m_${++keyCounter}`;

function parseCents(s: string): number {
  const clean = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(clean);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CreateDisbursementMilestonesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const { goalId, providerId } = route.params ?? ({} as RouteParams);

  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([
    {
      key: newKey(),
      name: "",
      description: "",
      amountText: "",
      verification_method: "owner",
    },
  ]);
  // Project location — Phase 2D. Pre-filled from the goal if a pin
  // already exists; otherwise the owner can use their current GPS or
  // type lat/lng. NULL is allowed: the geo-gate degrades gracefully on
  // the verification screen when no pin is set.
  const [projectLatText, setProjectLatText] = useState("");
  const [projectLngText, setProjectLngText] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);

  const { submitting, createMilestones } = useDisbursementActions();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCtxLoading(true);
      const [g, p] = await Promise.all([
        supabase
          .from("user_savings_goals")
          .select(
            "id, name, target_amount_cents, project_latitude, project_longitude",
          )
          .eq("id", goalId)
          .maybeSingle(),
        supabase
          .from("providers")
          .select("id, business_name, verification_level, max_project_value_cents")
          .eq("id", providerId)
          .maybeSingle(),
      ]);
      if (!cancelled) {
        const goalRow = (g.data as GoalRow) ?? null;
        setGoal(goalRow);
        setProvider((p.data as ProviderRow) ?? null);
        // Pre-fill the project-pin inputs if the goal already carries one.
        if (goalRow?.project_latitude != null && goalRow?.project_longitude != null) {
          setProjectLatText(String(goalRow.project_latitude));
          setProjectLngText(String(goalRow.project_longitude));
        }
        setCtxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId, providerId]);

  const sumCents = useMemo(
    () => drafts.reduce((acc, d) => acc + parseCents(d.amountText), 0),
    [drafts],
  );
  const targetCents = goal?.target_amount_cents ?? 0;
  const diffCents = targetCents - sumCents;

  const canSubmit =
    !submitting &&
    goal !== null &&
    provider !== null &&
    drafts.length > 0 &&
    drafts.every((d) => d.name.trim() && parseCents(d.amountText) > 0) &&
    sumCents === targetCents;

  const addRow = () => {
    setDrafts((prev) => [
      ...prev,
      {
        key: newKey(),
        name: "",
        description: "",
        amountText: "",
        verification_method: "owner",
      },
    ]);
  };

  const removeRow = (key: string) => {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((d) => d.key !== key)));
  };

  const move = (key: string, dir: -1 | 1) => {
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.key === key);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const update = (key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const parsedLat = (() => {
    const n = parseFloat(projectLatText);
    return Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
  })();
  const parsedLng = (() => {
    const n = parseFloat(projectLngText);
    return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
  })();
  const hasProjectPin = parsedLat !== null && parsedLng !== null;
  const pinPartialError =
    (projectLatText.trim() !== "" || projectLngText.trim() !== "") && !hasProjectPin;

  const handleCaptureGps = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        t("create_milestones.gps_unavailable_title"),
        t("create_milestones.gps_unavailable_body"),
      );
      return;
    }
    try {
      setGpsBusy(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          t("create_milestones.gps_denied_title"),
          t("create_milestones.gps_denied_body"),
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setProjectLatText(pos.coords.latitude.toFixed(6));
      setProjectLngText(pos.coords.longitude.toFixed(6));
    } catch (e: any) {
      Alert.alert(
        t("create_milestones.gps_error_title"),
        e?.message ?? t("create_milestones.gps_error_body"),
      );
    } finally {
      setGpsBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !goal || !provider) return;
    if (pinPartialError) {
      Alert.alert(
        t("create_milestones.pin_invalid_title"),
        t("create_milestones.pin_invalid_body"),
      );
      return;
    }
    // Persist the project pin (or clear it) BEFORE creating milestones.
    // Best-effort — if the update fails (RLS shouldn't block the owner)
    // we still continue with milestone creation so the wizard isn't
    // blocked by a transient write error.
    try {
      await supabase
        .from("user_savings_goals")
        .update({
          project_latitude: parsedLat,
          project_longitude: parsedLng,
        })
        .eq("id", goal.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[CreateDisbursementMilestones] pin save failed:", e);
    }

    // Auto-fill amount distribution if the user gets confused: this
    // helper is opt-in via the "Even split" button, NOT applied silently.
    const payload: CreateMilestoneInput[] = drafts.map((d, i) => ({
      name: d.name.trim(),
      description: d.description.trim() || undefined,
      order_index: i,
      amount_cents: parseCents(d.amountText),
      verification_method: d.verification_method,
      retention_percent: 10,
    }));
    const res = await createMilestones(goal.id, provider.id, payload);
    if (!res.ok) {
      Alert.alert(t("create_milestones.error_title"), res.message ?? "");
      return;
    }
    navigation.replace("GoalDisbursementMilestones", { goalId: goal.id });
  };

  const handleEvenSplit = () => {
    if (drafts.length === 0 || targetCents === 0) return;
    const per = Math.floor(targetCents / drafts.length);
    const remainder = targetCents - per * drafts.length;
    setDrafts((prev) =>
      prev.map((d, i) => ({
        ...d,
        amountText: ((per + (i === prev.length - 1 ? remainder : 0)) / 100).toFixed(2),
      })),
    );
  };

  if (ctxLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (!goal || !provider) {
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} title={t("create_milestones.title")} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("create_milestones.not_found")}</Text>
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
        <Header onBack={() => navigation.goBack()} title={t("create_milestones.title")} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>{t("create_milestones.goal_label")}</Text>
            <Text style={styles.contextValue} numberOfLines={1}>
              {goal.name ?? "—"}
            </Text>
            <Text style={styles.contextSub}>
              {t("create_milestones.target", { amount: fmt(targetCents) })}
            </Text>

            <View style={{ height: 8 }} />
            <Text style={styles.contextLabel}>{t("create_milestones.provider_label")}</Text>
            <Text style={styles.contextValue} numberOfLines={1}>
              {provider.business_name}
            </Text>
            <Text style={styles.contextSub}>
              {provider.max_project_value_cents == null
                ? t("create_milestones.cap_unlimited")
                : t("create_milestones.cap_amount", {
                    amount: fmt(provider.max_project_value_cents),
                  })}
            </Text>
          </View>

          {/* Project location pin (Phase 2D). Optional — verification
              geo-gate degrades gracefully when no pin is set, but elders
              will be able to drift without a check. The owner can fill
              this from the device's GPS or by typing lat/lng directly. */}
          <View style={styles.pinCard}>
            <View style={styles.pinHeader}>
              <Ionicons name="location-outline" size={16} color="#0A2342" />
              <Text style={styles.pinTitle}>
                {t("create_milestones.pin_title")}
              </Text>
              {hasProjectPin ? (
                <View style={styles.pinChipOk}>
                  <Ionicons name="checkmark-circle" size={12} color="#065F46" />
                  <Text style={styles.pinChipOkText}>
                    {t("create_milestones.pin_set")}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.pinBody}>{t("create_milestones.pin_body")}</Text>
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleCaptureGps}
              disabled={gpsBusy}
              accessibilityRole="button"
            >
              {gpsBusy ? (
                <ActivityIndicator size="small" color="#0A2342" />
              ) : (
                <>
                  <Ionicons name="locate-outline" size={16} color="#0A2342" />
                  <Text style={styles.gpsBtnText}>
                    {t("create_milestones.pin_use_current")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  {t("create_milestones.pin_lat_label")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={projectLatText}
                  onChangeText={setProjectLatText}
                  placeholder="e.g. 12.6392"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  {t("create_milestones.pin_lng_label")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={projectLngText}
                  onChangeText={setProjectLngText}
                  placeholder="e.g. -8.0029"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {pinPartialError ? (
              <Text style={styles.pinError}>
                {t("create_milestones.pin_invalid_body")}
              </Text>
            ) : null}
          </View>

          {/* Running sum + reconciliation */}
          <View style={styles.sumCard}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t("create_milestones.sum_so_far")}</Text>
              <Text style={styles.sumValue}>{fmt(sumCents)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t("create_milestones.target_label")}</Text>
              <Text style={styles.sumValue}>{fmt(targetCents)}</Text>
            </View>
            <View style={[styles.sumRow, { marginTop: 6 }]}>
              <Text style={styles.sumLabel}>{t("create_milestones.diff_label")}</Text>
              <Text
                style={[
                  styles.sumValueStrong,
                  { color: diffCents === 0 ? "#059669" : "#B45309" },
                ]}
              >
                {diffCents === 0
                  ? t("create_milestones.diff_zero")
                  : (diffCents > 0 ? "+" : "") + fmt(diffCents)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.evenSplitBtn}
              onPress={handleEvenSplit}
              accessibilityRole="button"
            >
              <Ionicons name="git-network-outline" size={14} color="#00C6AE" />
              <Text style={styles.evenSplitBtnText}>
                {t("create_milestones.even_split")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Draft rows */}
          {drafts.map((d, i) => (
            <DraftRow
              key={d.key}
              draft={d}
              index={i}
              total={drafts.length}
              onChange={(patch) => update(d.key, patch)}
              onRemove={() => removeRow(d.key)}
              onMoveUp={() => move(d.key, -1)}
              onMoveDown={() => move(d.key, 1)}
            />
          ))}

          <TouchableOpacity
            style={styles.addRowBtn}
            onPress={addRow}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={18} color="#00C6AE" />
            <Text style={styles.addRowBtnText}>
              {t("create_milestones.add_milestone_button")}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {t("create_milestones.submit_button")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function DraftRow({
  draft,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  draft: Draft;
  index: number;
  total: number;
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.draftCard}>
      <View style={styles.draftHeaderRow}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>{index + 1}</Text>
        </View>
        <Text style={styles.draftHeaderTitle}>
          {t("create_milestones.row_title", { n: index + 1 })}
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onMoveUp} disabled={index === 0} hitSlop={6}>
          <Ionicons
            name="arrow-up"
            size={18}
            color={index === 0 ? "#D1D5DB" : "#0A2342"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMoveDown}
          disabled={index === total - 1}
          hitSlop={6}
        >
          <Ionicons
            name="arrow-down"
            size={18}
            color={index === total - 1 ? "#D1D5DB" : "#0A2342"}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove} disabled={total === 1} hitSlop={6}>
          <Ionicons
            name="trash-outline"
            size={18}
            color={total === 1 ? "#D1D5DB" : "#EF4444"}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>{t("create_milestones.field_name")}</Text>
      <TextInput
        style={styles.input}
        value={draft.name}
        onChangeText={(name) => onChange({ name })}
        placeholder={t("create_milestones.placeholder_name")}
        placeholderTextColor="#9CA3AF"
        maxLength={120}
      />

      <Text style={styles.fieldLabel}>{t("create_milestones.field_description")}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={draft.description}
        onChangeText={(description) => onChange({ description })}
        placeholder={t("create_milestones.placeholder_description")}
        placeholderTextColor="#9CA3AF"
        multiline
        maxLength={300}
      />

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>{t("create_milestones.field_amount")}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={draft.amountText}
              onChangeText={(amountText) => onChange({ amountText })}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </View>

      <Text style={styles.fieldLabel}>{t("create_milestones.field_method")}</Text>
      <View style={styles.chipRow}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[
              styles.chip,
              draft.verification_method === m && styles.chipActive,
            ]}
            onPress={() => onChange({ verification_method: m })}
          >
            <Text
              style={[
                styles.chipText,
                draft.verification_method === m && styles.chipTextActive,
              ]}
            >
              {t(`create_milestones.method_${m}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
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
  scrollContent: { padding: 16, paddingBottom: 120 },

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
  contextValue: { fontSize: 15, fontWeight: "800", color: "#0A2342", marginTop: 2 },
  contextSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  sumCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between" },
  sumLabel: { fontSize: 13, color: "#6B7280" },
  sumValue: { fontSize: 13, fontWeight: "600", color: "#0A2342" },
  sumValueStrong: { fontSize: 14, fontWeight: "800" },
  evenSplitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  evenSplitBtnText: { fontSize: 13, fontWeight: "700", color: "#00C6AE" },

  draftCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  draftHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeText: { fontSize: 12, fontWeight: "800", color: "#0A2342" },
  draftHeaderTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342" },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#0A2342", marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0A2342",
    backgroundColor: "#FFFFFF",
  },
  inputMultiline: { minHeight: 56, textAlignVertical: "top" },

  row2: { flexDirection: "row", gap: 10 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  amountPrefix: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginRight: 4 },
  amountInput: { flex: 1, fontSize: 18, fontWeight: "700", color: "#0A2342", paddingVertical: 8 },

  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  chipTextActive: { color: "#FFFFFF" },

  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    marginTop: 6,
    backgroundColor: "#FFFFFF",
  },
  addRowBtnText: { fontSize: 13, fontWeight: "700", color: "#00C6AE" },

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
  btnDisabled: { opacity: 0.5 },

  pinCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pinHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  pinTitle: { fontSize: 14, fontWeight: "800", color: "#0A2342" },
  pinBody: { fontSize: 12, color: "#6B7280", marginTop: 4, marginBottom: 10 },
  pinChipOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pinChipOkText: { fontSize: 11, fontWeight: "700", color: "#065F46" },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  gpsBtnText: { fontSize: 13, fontWeight: "700", color: "#0A2342" },
  pinError: { fontSize: 12, color: "#B91C1C", marginTop: 6 },
});
