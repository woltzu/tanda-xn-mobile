// ══════════════════════════════════════════════════════════════════════════════
// components/ScoreExplainerSheet.tsx — unified explainer for ScoreHub's 4 scores
// ══════════════════════════════════════════════════════════════════════════════
//
// Bucket B of the Explainable AI review. Replaces the four separate
// Alert.alert popups that ScoreHubScreen used to fire (one per metric's
// help icon) with a single bottom sheet that surfaces all four scores
// together. Each section shows:
//
//   • the score name + the user's current value (from props)
//   • a plain-language glossary line (static i18n copy)
//   • the most recent matching `ai_decisions.rendered_explanation`
//     for that metric (data-driven, falls back to a "no recent
//     explanation" line when none exists)
//
// Decision-type mapping mirrors AIInsightsScreen so the two surfaces stay
// in sync. When new score decision types are wired server-side, extend
// SECTIONS[].decisionTypes in one place.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  useDecisionHistory,
  DecisionType,
  AIDecision,
} from "../hooks/useExplainableAI";

type ScoreValues = {
  xnscore?: number | null;
  honor?: number | null;
  stress?: number | null;
  mood?: number | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onViewFullInsights: () => void;
  scores: ScoreValues;
};

type SectionConfig = {
  id: keyof ScoreValues;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: string;
  glossaryKey: string;
  decisionTypes: DecisionType[];
};

const SECTIONS: SectionConfig[] = [
  {
    id: "xnscore",
    icon: "trophy-outline",
    color: "#00C6AE",
    titleKey: "score_explainer.section_xnscore",
    glossaryKey: "score_explainer.glossary_xnscore",
    decisionTypes: ["xnscore_increase", "xnscore_decrease"],
  },
  {
    id: "honor",
    icon: "ribbon-outline",
    color: "#3B82F6",
    titleKey: "score_explainer.section_honor",
    glossaryKey: "score_explainer.glossary_honor",
    decisionTypes: ["honor_score_change" as DecisionType],
  },
  {
    id: "stress",
    icon: "pulse-outline",
    color: "#F97316",
    titleKey: "score_explainer.section_stress",
    glossaryKey: "score_explainer.glossary_stress",
    decisionTypes: ["stress_score_change" as DecisionType],
  },
  {
    id: "mood",
    icon: "happy-outline",
    color: "#EAB308",
    titleKey: "score_explainer.section_mood",
    glossaryKey: "score_explainer.glossary_mood",
    decisionTypes: ["mood_drift_change" as DecisionType],
  },
];

function pickLatest(
  decisions: AIDecision[],
  types: DecisionType[],
): AIDecision | null {
  return decisions.find((d) => types.includes(d.decisionType)) ?? null;
}

export default function ScoreExplainerSheet({
  visible,
  onClose,
  onViewFullInsights,
  scores,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Only fetch when the sheet is actually open — avoids hitting the RPC
  // on every parent render. useDecisionHistory short-circuits cleanly
  // when userId is undefined.
  const { decisions } = useDecisionHistory(visible ? user?.id : undefined, {
    limit: 50,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("score_explainer.close")}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheet}
          onPress={() => {}}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Ionicons name="sparkles-outline" size={18} color="#00C6AE" />
            <Text style={styles.title}>{t("score_explainer.title")}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t("score_explainer.close")}
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {SECTIONS.map((cfg) => {
              const value = scores[cfg.id];
              const decision = pickLatest(decisions, cfg.decisionTypes);
              return (
                <View key={cfg.id} style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: cfg.color + "1A" },
                      ]}
                    >
                      <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                    </View>
                    <Text style={styles.sectionTitle}>{t(cfg.titleKey)}</Text>
                    {value != null ? (
                      <Text style={[styles.valuePill, { color: cfg.color }]}>
                        {value}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.glossary}>{t(cfg.glossaryKey)}</Text>
                  <View
                    style={[
                      styles.recentBox,
                      decision
                        ? { backgroundColor: cfg.color + "12" }
                        : styles.recentBoxEmpty,
                    ]}
                  >
                    <Ionicons
                      name={decision ? "bulb-outline" : "information-circle-outline"}
                      size={13}
                      color={decision ? cfg.color : "#9CA3AF"}
                    />
                    <Text
                      style={[
                        styles.recentText,
                        decision ? { color: "#0A2342" } : styles.recentTextEmpty,
                      ]}
                    >
                      {decision
                        ? decision.renderedExplanation
                        : t("score_explainer.no_recent_explanation")}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>
                {t("score_explainer.close")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onViewFullInsights}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>
                {t("score_explainer.view_full_cta")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2342",
  },
  closeBtn: { padding: 2 },

  scroll: { maxHeight: 460 },
  scrollContent: { paddingBottom: 8 },

  section: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
  },
  valuePill: {
    fontSize: 16,
    fontWeight: "800",
  },
  glossary: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 17,
    marginBottom: 8,
    paddingLeft: 38,
  },
  recentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 38,
  },
  recentBoxEmpty: { backgroundColor: "#F3F4F6" },
  recentText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  recentTextEmpty: { color: "#6B7280", fontStyle: "italic" },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  secondaryText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  primaryBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#00C6AE",
  },
  primaryText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
