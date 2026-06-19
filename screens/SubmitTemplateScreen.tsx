// ══════════════════════════════════════════════════════════════════════════════
// SubmitTemplateScreen — community goal template submission
// ══════════════════════════════════════════════════════════════════════════════
// Phase 5 (templates 2A). Lets a member submit a new goal template to
// the curated catalogue. Lands in template_submissions with status=
// 'pending'; the admin queue triages and approves into goal_templates.
//
// Form is intentionally lean: category, name, optional description,
// target, timeline. Milestones + cost breakdown are entered as
// add/remove rows so the JSONB lands in the same shape the browser
// renders. Country defaults to the user's profile country if present.
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
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Category = "house" | "wedding" | "business" | "school" | "other";
const CATEGORIES: Category[] = ["house", "wedding", "business", "school", "other"];

const PROVIDER_CATEGORIES = [
  "construction",
  "education",
  "healthcare",
  "agriculture",
  "retail",
  "legal_finance",
  "services",
  "other",
] as const;

type MilestoneRow = {
  key: string;
  name: string;
  description: string;
  percentText: string;
};

type CostRow = {
  key: string;
  item: string;
  costText: string;
  note: string;
};

let keyCounter = 0;
const newKey = (prefix: string) => `${prefix}_${++keyCounter}`;

function parseCents(s: string): number {
  const n = parseFloat((s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
function parsePercent(s: string): number {
  const n = parseFloat((s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function SubmitTemplateScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetText, setTargetText] = useState("");
  const [timelineText, setTimelineText] = useState("");
  const [country, setCountry] = useState("");
  const [providers, setProviders] = useState<Set<string>>(new Set());

  const [milestones, setMilestones] = useState<MilestoneRow[]>([
    { key: newKey("m"), name: "", description: "", percentText: "" },
  ]);
  const [costs, setCosts] = useState<CostRow[]>([
    { key: newKey("c"), item: "", costText: "", note: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);

  // Pre-fill the country field from the user's profile if available.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("country")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data?.country) setCountry(data.country as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const target = parseCents(targetText);
  const milestonePercentSum = useMemo(
    () => milestones.reduce((s, m) => s + parsePercent(m.percentText), 0),
    [milestones],
  );

  const canSubmit =
    !submitting &&
    category !== null &&
    name.trim().length >= 3 &&
    (target === 0 || target > 0) &&
    milestones.every((m) => m.name.trim()) &&
    Math.round(milestonePercentSum) === 100;

  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      { key: newKey("m"), name: "", description: "", percentText: "" },
    ]);
  };
  const updateMilestone = (key: string, patch: Partial<MilestoneRow>) => {
    setMilestones((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  };
  const removeMilestone = (key: string) => {
    setMilestones((prev) => (prev.length === 1 ? prev : prev.filter((m) => m.key !== key)));
  };

  const addCost = () => {
    setCosts((prev) => [...prev, { key: newKey("c"), item: "", costText: "", note: "" }]);
  };
  const updateCost = (key: string, patch: Partial<CostRow>) => {
    setCosts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };
  const removeCost = (key: string) => {
    setCosts((prev) => (prev.length === 1 ? prev : prev.filter((c) => c.key !== key)));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !category || !user?.id) return;
    setSubmitting(true);
    try {
      const milestonesPayload = milestones
        .filter((m) => m.name.trim())
        .map((m, i) => ({
          name: m.name.trim(),
          description: m.description.trim() || undefined,
          default_percent: parsePercent(m.percentText),
          order_index: i,
        }));
      const costsPayload = costs
        .filter((c) => c.item.trim() && parseCents(c.costText) > 0)
        .map((c) => ({
          item: c.item.trim(),
          cost_cents: parseCents(c.costText),
          note: c.note.trim() || null,
        }));
      const providerArr = Array.from(providers);

      const { error } = await supabase.from("template_submissions").insert({
        user_id: user.id,
        category,
        name: name.trim(),
        description: description.trim() || null,
        target_cents: target > 0 ? target : null,
        timeline_months: timelineText.trim()
          ? parseInt(timelineText, 10) || null
          : null,
        milestones: milestonesPayload,
        cost_breakdown: costsPayload,
        provider_categories: providerArr.length > 0 ? providerArr : null,
        country: country.trim() ? country.trim().toUpperCase().slice(0, 2) : null,
      });
      if (error) throw error;
      Alert.alert(
        t("submit_template.success_title"),
        t("submit_template.success_body"),
        [{ text: t("submit_template.dismiss"), onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert(
        t("submit_template.error_title"),
        e?.message ?? t("submit_template.error_body"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("submit_template.title")}</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.kickerBody}>{t("submit_template.intro")}</Text>

          {/* Category */}
          <Text style={styles.label}>{t("submit_template.field_category")} *</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                  {t(`submit_template.category_${c}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Name */}
          <Text style={styles.label}>{t("submit_template.field_name")} *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("submit_template.placeholder_name")}
            placeholderTextColor="#9CA3AF"
            maxLength={120}
          />

          {/* Description */}
          <Text style={styles.label}>{t("submit_template.field_description")}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder={t("submit_template.placeholder_description")}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />

          {/* Target + timeline */}
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("submit_template.field_target")}</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={targetText}
                  onChangeText={setTargetText}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("submit_template.field_timeline")}</Text>
              <TextInput
                style={styles.input}
                value={timelineText}
                onChangeText={setTimelineText}
                placeholder="12"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Country */}
          <Text style={styles.label}>{t("submit_template.field_country")}</Text>
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={(s) => setCountry(s.toUpperCase().slice(0, 2))}
            placeholder="CI"
            placeholderTextColor="#9CA3AF"
            maxLength={2}
            autoCapitalize="characters"
          />

          {/* Provider categories */}
          <Text style={styles.label}>
            {t("submit_template.field_providers")}
          </Text>
          <View style={styles.chipRow}>
            {PROVIDER_CATEGORIES.map((pc) => {
              const on = providers.has(pc);
              return (
                <TouchableOpacity
                  key={pc}
                  style={[styles.chip, on && styles.chipActive]}
                  onPress={() => {
                    setProviders((prev) => {
                      const next = new Set(prev);
                      if (next.has(pc)) next.delete(pc);
                      else next.add(pc);
                      return next;
                    });
                  }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>
                    {t(`provider_category.${pc}`, { defaultValue: pc })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Milestones */}
          <Text style={styles.sectionTitle}>
            {t("submit_template.section_milestones")}
          </Text>
          <Text style={styles.sectionBody}>
            {t("submit_template.milestones_hint", {
              percent: Math.round(milestonePercentSum),
            })}
          </Text>
          {milestones.map((m, i) => (
            <View key={m.key} style={styles.rowCard}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowHeaderText}>
                  {t("submit_template.milestone_n", { n: i + 1 })}
                </Text>
                <TouchableOpacity
                  onPress={() => removeMilestone(m.key)}
                  disabled={milestones.length === 1}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={milestones.length === 1 ? "#D1D5DB" : "#EF4444"}
                  />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={m.name}
                onChangeText={(name) => updateMilestone(m.key, { name })}
                placeholder={t("submit_template.placeholder_milestone_name")}
                placeholderTextColor="#9CA3AF"
              />
              <View style={styles.row2}>
                <View style={{ flex: 2 }}>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={m.description}
                    onChangeText={(description) => updateMilestone(m.key, { description })}
                    placeholder={t("submit_template.placeholder_milestone_desc")}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={m.percentText}
                    onChangeText={(percentText) =>
                      updateMilestone(m.key, { percentText })
                    }
                    placeholder="%"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addRowBtn} onPress={addMilestone}>
            <Ionicons name="add-circle-outline" size={18} color="#00C6AE" />
            <Text style={styles.addRowBtnText}>
              {t("submit_template.add_milestone")}
            </Text>
          </TouchableOpacity>

          {/* Cost breakdown */}
          <Text style={styles.sectionTitle}>
            {t("submit_template.section_costs")}
          </Text>
          <Text style={styles.sectionBody}>
            {t("submit_template.costs_hint")}
          </Text>
          {costs.map((c) => (
            <View key={c.key} style={styles.rowCard}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowHeaderText}>
                  {t("submit_template.cost_row")}
                </Text>
                <TouchableOpacity
                  onPress={() => removeCost(c.key)}
                  disabled={costs.length === 1}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={costs.length === 1 ? "#D1D5DB" : "#EF4444"}
                  />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={c.item}
                onChangeText={(item) => updateCost(c.key, { item })}
                placeholder={t("submit_template.placeholder_cost_item")}
                placeholderTextColor="#9CA3AF"
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <View style={[styles.amountRow, { marginTop: 8 }]}>
                    <Text style={styles.amountPrefix}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={c.costText}
                      onChangeText={(costText) => updateCost(c.key, { costText })}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 2 }}>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={c.note}
                    onChangeText={(note) => updateCost(c.key, { note })}
                    placeholder={t("submit_template.placeholder_cost_note")}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addRowBtn} onPress={addCost}>
            <Ionicons name="add-circle-outline" size={18} color="#00C6AE" />
            <Text style={styles.addRowBtnText}>{t("submit_template.add_cost")}</Text>
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
                {t("submit_template.submit_button")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
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
  kickerBody: { fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 18 },

  label: { fontSize: 12, fontWeight: "700", color: "#0A2342", marginTop: 12, marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0A2342", marginTop: 20 },
  sectionBody: { fontSize: 12, color: "#6B7280", marginTop: 4, marginBottom: 10 },

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
  inputMultiline: { minHeight: 64, textAlignVertical: "top" },

  row2: { flexDirection: "row" },

  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  amountPrefix: { fontSize: 16, fontWeight: "700", color: "#0A2342", marginRight: 4 },
  amountInput: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0A2342", paddingVertical: 10 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  chipTextActive: { color: "#FFFFFF" },

  rowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  rowHeaderText: { fontSize: 13, fontWeight: "700", color: "#0A2342" },

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
    backgroundColor: "#FFFFFF",
    marginTop: 2,
  },
  addRowBtnText: { fontSize: 13, fontWeight: "700", color: "#00C6AE" },

  bottomBar: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
});
