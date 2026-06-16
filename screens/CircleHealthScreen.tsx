// ══════════════════════════════════════════════════════════════════════════════
// screens/CircleHealthScreen.tsx — deep-dive for the CirclesV2 Health card.
// ══════════════════════════════════════════════════════════════════════════════
//
// Shows the same three circles as CirclesV2's Circle Health summary, expanded
// with the three real health metrics: default rate, payout speed (days from
// cycle close to payout), and active-member ratio.
//
// Mock data only — replace with the real circle-health query when available.
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

type CircleHealthRow = {
  id: string;
  name: string;
  score: number;
  default_rate_pct: number;
  payout_speed_days: number;
  active_ratio_pct: number;
};

const mockHealth: CircleHealthRow[] = [
  {
    id: "fam",
    name: "Family Circle",
    score: 92,
    default_rate_pct: 0,
    payout_speed_days: 1,
    active_ratio_pct: 100,
  },
  {
    id: "biz",
    name: "Business Builders",
    score: 78,
    default_rate_pct: 4,
    payout_speed_days: 3,
    active_ratio_pct: 80,
  },
  {
    id: "fri",
    name: "Friends 2025",
    score: 55,
    default_rate_pct: 12,
    payout_speed_days: 7,
    active_ratio_pct: 50,
  },
];

function scoreColor(score: number): string {
  if (score >= 80) return colors.accentTeal;
  if (score >= 60) return colors.warningAmber;
  return colors.errorText;
}

function statusTagKey(score: number): string {
  if (score >= 80) return "circle_health_screen.tag_healthy";
  if (score >= 60) return "circle_health_screen.tag_watch";
  return "circle_health_screen.tag_at_risk";
}

export default function CircleHealthScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();

  // Average of the 3 circles for the "OVERALL HEALTH" tile.
  const overall = Math.round(
    mockHealth.reduce((a, r) => a + r.score, 0) / mockHealth.length,
  );
  const overallColor = scoreColor(overall);

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
            <Text style={styles.headerTitle}>
              {t("circle_health_screen.header_title")}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <Text style={styles.headerSubtitle}>
            {t("circle_health_screen.header_subtitle")}
          </Text>

          {/* Overall health gauge */}
          <View style={styles.overallCard}>
            <Text style={styles.overallLabel}>
              {t("circle_health_screen.overall_label")}
            </Text>
            <View style={styles.overallScoreRow}>
              <Text style={[styles.overallScore, { color: overallColor }]}>
                {overall}
              </Text>
              <Text style={styles.overallOutOf}> / 100</Text>
            </View>
            <View style={styles.gaugeBg}>
              <View
                style={[
                  styles.gaugeFill,
                  { width: `${overall}%`, backgroundColor: overallColor },
                ]}
              />
            </View>
          </View>
        </LinearGradient>

        {/* ===== PER-CIRCLE BREAKDOWN ===== */}
        <Text style={styles.sectionHeader}>
          {t("circle_health_screen.section_per_circle")}
        </Text>

        {mockHealth.map((row) => {
          const color = scoreColor(row.score);
          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{row.name}</Text>
                <View
                  style={[
                    styles.statusTag,
                    { backgroundColor: `${color}1A` },
                  ]}
                >
                  <Text style={[styles.statusTagText, { color }]}>
                    {t(statusTagKey(row.score))}
                  </Text>
                </View>
              </View>

              {/* Per-circle health gauge */}
              <View style={styles.cardGaugeRow}>
                <Text style={styles.cardMetricLabel}>
                  {t("circle_health_screen.metric_health_score")}
                </Text>
                <Text style={[styles.cardMetricScore, { color }]}>
                  {row.score}
                  <Text style={styles.cardMetricOutOf}> / 100</Text>
                </Text>
              </View>
              <View style={styles.gaugeBg}>
                <View
                  style={[
                    styles.gaugeFill,
                    { width: `${row.score}%`, backgroundColor: color },
                  ]}
                />
              </View>

              {/* Three real metrics */}
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>
                  {t("circle_health_screen.metric_default_rate")}
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color:
                        row.default_rate_pct === 0
                          ? colors.successText
                          : row.default_rate_pct < 5
                            ? colors.warningAmber
                            : colors.errorText,
                    },
                  ]}
                >
                  {row.default_rate_pct}%
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>
                  {t("circle_health_screen.metric_payout_speed")}
                </Text>
                <Text style={styles.metricValue}>{row.payout_speed_days}d</Text>
              </View>
              <View style={[styles.metricRow, styles.metricRowLast]}>
                <Text style={styles.metricLabel}>
                  {t("circle_health_screen.metric_active_ratio")}
                </Text>
                <Text style={styles.metricValue}>{row.active_ratio_pct}%</Text>
              </View>
            </View>
          );
        })}
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
  headerTitle: {
    color: colors.textWhite,
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.textOnNavy,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
  },

  overallCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
  },
  overallLabel: {
    color: colors.textOnNavy,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  overallScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  overallScore: { fontSize: 32, fontWeight: "700" },
  overallOutOf: {
    color: colors.textOnNavy,
    fontSize: 14,
    marginLeft: 4,
  },

  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },

  card: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "700",
  },

  cardGaugeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  cardMetricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  cardMetricScore: {
    fontSize: 18,
    fontWeight: "700",
  },
  cardMetricOutOf: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  gaugeBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  gaugeFill: { height: "100%", borderRadius: 3 },

  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metricRowLast: { borderBottomWidth: 0 },
  metricLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  metricValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "700",
  },
});
