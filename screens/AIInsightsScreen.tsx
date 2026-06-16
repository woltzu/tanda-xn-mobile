// ══════════════════════════════════════════════════════════════════════════════
// screens/AIInsightsScreen.tsx — deep-dive for the Score Hub AI Insights card.
// ══════════════════════════════════════════════════════════════════════════════
//
// Plain-language explanations of the four scoring metrics shown on Score Hub:
// XnScore™, Honor Score, Stress Score, Mood Drift Score. Static text for now —
// will be replaced with model-generated explanations when the LLM pipeline
// ships.
//
// NOT a "coming soon" placeholder — this screen shows real (mock) explanations
// today.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { colors } from "../theme/tokens";

type InsightCardConfig = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  titleKey: string;
  statusKey: string;
  explanationKey: string;
};

const INSIGHTS: InsightCardConfig[] = [
  {
    id: "xnscore",
    icon: "trophy-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.xnscore_card_title",
    statusKey: "ai_insights_screen.xnscore_status",
    explanationKey: "ai_insights_screen.xnscore_explanation",
  },
  {
    id: "honor",
    icon: "ribbon-outline",
    iconColor: colors.accentTeal,
    titleKey: "ai_insights_screen.honor_card_title",
    statusKey: "ai_insights_screen.honor_status",
    explanationKey: "ai_insights_screen.honor_explanation",
  },
  {
    id: "stress",
    icon: "pulse-outline",
    iconColor: "#F97316",
    titleKey: "ai_insights_screen.stress_card_title",
    statusKey: "ai_insights_screen.stress_status",
    explanationKey: "ai_insights_screen.stress_explanation",
  },
  {
    id: "mood",
    icon: "happy-outline",
    iconColor: "#EAB308",
    titleKey: "ai_insights_screen.mood_card_title",
    statusKey: "ai_insights_screen.mood_status",
    explanationKey: "ai_insights_screen.mood_explanation",
  },
];

export default function AIInsightsScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
        <LinearGradient
          colors={[colors.primaryNavy, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color={colors.textWhite} />
            </TouchableOpacity>
            <View style={styles.headerTitleRow}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={colors.accentTeal}
              />
              <Text style={styles.headerTitle}>
                {t("ai_insights_screen.header_title")}
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <Text style={styles.headerSubtitle}>
            {t("ai_insights_screen.header_subtitle")}
          </Text>
        </LinearGradient>

        {/* ===== INSIGHT CARDS ===== */}
        <View style={styles.cardsWrap}>
          {INSIGHTS.map((cfg) => (
            <View key={cfg.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: `${cfg.iconColor}1A` },
                  ]}
                >
                  <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t(cfg.titleKey)}</Text>
                  <Text style={[styles.cardStatus, { color: cfg.iconColor }]}>
                    {t(cfg.statusKey)}
                  </Text>
                </View>
              </View>

              <View style={styles.explanationCard}>
                <Ionicons
                  name="bulb-outline"
                  size={14}
                  color={colors.accentTeal}
                />
                <Text style={styles.explanationText}>
                  {t(cfg.explanationKey)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: colors.textWhite,
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.textOnNavy,
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 2,
  },

  cardsWrap: { padding: 16 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  explanationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.tealTintBg,
    padding: 12,
    borderRadius: 10,
  },
  explanationText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
});
