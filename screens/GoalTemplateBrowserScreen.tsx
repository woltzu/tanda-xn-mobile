// ══════════════════════════════════════════════════════════════════════════════
// GoalTemplateBrowserScreen — diaspora-dream template browser
// ══════════════════════════════════════════════════════════════════════════════
// Phase 4. Lists the active goal_templates rows seeded in migration 202.
// Each card carries icon + name + description + cost range (derived from
// the cost_breakdown sum) + timeline. Tapping a card routes to
// GoalCreateExpress with the template attached so the form pre-fills.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";

export type GoalTemplate = {
  id: string;
  category: "house" | "wedding" | "business" | "school";
  name: string;
  description: string | null;
  icon: string | null;
  default_target_cents: number | null;
  default_timeline_months: number | null;
  milestones: Array<{
    name: string;
    description?: string;
    default_percent: number;
    verification_method?: string;
  }>;
  cost_breakdown: Array<{ item: string; cost_cents: number; note?: string | null }>;
  provider_categories: string[] | null;
};

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function GoalTemplateBrowserScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("goal_templates")
      .select(
        "id, category, name, description, icon, default_target_cents, default_timeline_months, milestones, cost_breakdown, provider_categories",
      )
      .eq("is_active", true)
      .order("default_target_cents", { ascending: false });
    if (!error && data) {
      setTemplates(data as GoalTemplate[]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchTemplates();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("goal_template_browser.title")}</Text>
          <Text style={styles.headerSubtitle}>
            {t("goal_template_browser.subtitle")}
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C6AE" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />}
        >
          {templates.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="albums-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyText}>{t("goal_template_browser.empty")}</Text>
            </View>
          ) : (
            templates.map((tpl) => <TemplateCard key={tpl.id} template={tpl} />)
          )}

          {/* Phase 5 — community submission entry. Always visible so the
              footer reads like an invitation; the queue triages before
              anything lands in the public list. */}
          <TouchableOpacity
            style={styles.submitTile}
            onPress={() => navigation.navigate("SubmitTemplate")}
            accessibilityRole="button"
          >
            <View style={styles.submitTileIcon}>
              <Ionicons name="add" size={20} color="#5B21B6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.submitTileTitle}>
                {t("goal_template_browser.submit_title")}
              </Text>
              <Text style={styles.submitTileBody}>
                {t("goal_template_browser.submit_body")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function TemplateCard({ template }: { template: GoalTemplate }) {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  // Derived cost range = min + max of the line items, with the default
  // target also shown as the "starting point". This pulls the spec's
  // table-style $X – $Y from the same JSONB we already render.
  const costSum = template.cost_breakdown.reduce(
    (acc, item) => acc + (item.cost_cents ?? 0),
    0,
  );
  const target = template.default_target_cents ?? costSum;

  const handleUse = () => {
    // Pass the full template object so GoalCreateExpressScreen can pre-fill
    // every supported field (name, target, category, providers) without a
    // follow-up fetch. The full milestones array also rides along for the
    // disbursement wizard's later consumption.
    navigation.navigate("GoalCreateExpress", { template });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{template.icon ?? "🎯"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{template.name}</Text>
          <Text style={styles.cardCategory}>
            {t(`provider_category.${template.category}`, {
              defaultValue: template.category,
            })}
          </Text>
        </View>
      </View>
      {template.description ? (
        <Text style={styles.cardDescription}>{template.description}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="cash-outline" size={14} color="#0A2342" />
          <Text style={styles.metaLabel}>{t("goal_template_browser.target")}</Text>
          <Text style={styles.metaValue}>{fmt(target)}</Text>
        </View>
        {template.default_timeline_months ? (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color="#0A2342" />
            <Text style={styles.metaLabel}>{t("goal_template_browser.timeline")}</Text>
            <Text style={styles.metaValue}>
              {t("goal_template_browser.months", {
                count: template.default_timeline_months,
              })}
            </Text>
          </View>
        ) : null}
      </View>

      {template.cost_breakdown.length > 0 ? (
        <View style={styles.breakdownBlock}>
          <Text style={styles.breakdownTitle}>
            {t("goal_template_browser.breakdown")}
          </Text>
          {template.cost_breakdown.map((item, i) => (
            <View key={i} style={styles.breakdownRow}>
              <Text style={styles.breakdownItem} numberOfLines={1}>
                {item.item}
              </Text>
              <Text style={styles.breakdownCost}>{fmt(item.cost_cents)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {template.milestones.length > 0 ? (
        <View style={styles.milestoneBlock}>
          <Text style={styles.breakdownTitle}>
            {t("goal_template_browser.milestones")}
          </Text>
          {template.milestones.map((m, i) => (
            <View key={i} style={styles.milestoneRow}>
              <View style={styles.milestoneOrder}>
                <Text style={styles.milestoneOrderText}>{i + 1}</Text>
              </View>
              <Text style={styles.milestoneName} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={styles.milestonePercent}>
                {m.default_percent}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.useBtn}
        onPress={handleUse}
        accessibilityRole="button"
      >
        <Text style={styles.useBtnText}>{t("goal_template_browser.use_template")}</Text>
        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  scrollContent: { padding: 16, paddingBottom: 32 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: { fontSize: 28 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0A2342" },
  cardCategory: { fontSize: 12, color: "#6B7280", marginTop: 2, textTransform: "capitalize" },
  cardDescription: { fontSize: 13, color: "#374151", marginTop: 8, lineHeight: 18 },

  metaRow: { flexDirection: "row", gap: 14, marginTop: 12 },
  metaItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  metaLabel: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  metaValue: { fontSize: 13, fontWeight: "800", color: "#0A2342", marginLeft: 2 },

  breakdownBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  breakdownItem: { flex: 1, fontSize: 13, color: "#374151", marginRight: 8 },
  breakdownCost: { fontSize: 13, fontWeight: "700", color: "#0A2342" },

  milestoneBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  milestoneOrder: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneOrderText: { fontSize: 11, fontWeight: "800", color: "#0A2342" },
  milestoneName: { flex: 1, fontSize: 13, color: "#374151" },
  milestonePercent: { fontSize: 12, fontWeight: "700", color: "#00C6AE" },

  useBtn: {
    marginTop: 14,
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  useBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  submitTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 4,
  },
  submitTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  submitTileTitle: { fontSize: 14, fontWeight: "800", color: "#0A2342" },
  submitTileBody: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
