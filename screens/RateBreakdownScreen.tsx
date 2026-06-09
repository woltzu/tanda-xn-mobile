// ══════════════════════════════════════════════════════════════════════════════
// screens/RateBreakdownScreen.tsx — ADVANCE-019 personalized rate explainer
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 121-ADVANCE-019-RateBreakdown.jsx.
//
// Reached from AdvanceExplanationV2 / SmartCalculator "Why this rate?"
// links. Shows the line-item rate build-up (base + country + score +
// tier + early-repay bonuses), an alternatives comparison, a
// "how to get a better rate" checklist (with achieved milestones
// struck through), and the XnScore→rate tier table.
//
// Route params (all optional, defaults match canonical mock):
//   user?: { name; xnScore; country; tier; circlesCompleted; onTimePayments }
//   rateCalculation?: { baseRate; countryRisk; xnScoreAdjust;
//                       tierBonus; earlyRepayBonus; finalRate }
//   comparison?: { paydayLender; localMoneyLender; bankPersonalLoan;
//                  tandaxn }
//
// Navigation:
//   - back → goBack
//   - "See All Ways to Improve Rate" → XnScoreDashboard
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";
const RED = "#DC2626";

type RateUser = {
  name: string;
  xnScore: number;
  country: string;
  tier: string;
  circlesCompleted: number;
  onTimePayments: number;
};

type RateCalculation = {
  baseRate: number;
  countryRisk: number;
  xnScoreAdjust: number;
  tierBonus: number;
  earlyRepayBonus: number;
  finalRate: number;
};

type Comparison = {
  paydayLender: number;
  localMoneyLender: number;
  bankPersonalLoan: number;
  tandaxn: number;
};

type RateBreakdownParams = {
  user?: RateUser;
  rateCalculation?: RateCalculation;
  comparison?: Comparison;
};
type RateBreakdownRouteProp = RouteProp<
  { RateBreakdown: RateBreakdownParams },
  "RateBreakdown"
>;

const DEFAULT_USER: RateUser = {
  name: "Franck",
  xnScore: 78,
  country: "USA",
  tier: "Gold",
  circlesCompleted: 5,
  onTimePayments: 24,
};

const DEFAULT_CALC: RateCalculation = {
  baseRate: 8.0,
  countryRisk: 1.0,
  xnScoreAdjust: -0.5,
  tierBonus: -0.5,
  earlyRepayBonus: -0.5,
  finalRate: 7.5,
};

const DEFAULT_COMPARISON: Comparison = {
  paydayLender: 400,
  localMoneyLender: 15,
  bankPersonalLoan: 12,
  tandaxn: 7.5,
};

type ComponentType = "base" | "add" | "discount";

export default function RateBreakdownScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<RateBreakdownRouteProp>();
  const { t } = useTranslation();

  const user = route.params?.user ?? DEFAULT_USER;
  const calc = route.params?.rateCalculation ?? DEFAULT_CALC;
  const comparison = route.params?.comparison ?? DEFAULT_COMPARISON;

  const rateComponents: {
    label: string;
    value: number;
    type: ComponentType;
    description: string;
  }[] = [
    {
      label: "Base Platform Rate",
      value: calc.baseRate,
      type: "base",
      description: "Our standard rate for all advances",
    },
    {
      label: `Country Risk (${user.country})`,
      value: calc.countryRisk,
      type: "add",
      description: "Adjusted for regional economic factors",
    },
    {
      label: `XnScore Tier (${user.xnScore})`,
      value: calc.xnScoreAdjust,
      type: calc.xnScoreAdjust < 0 ? "discount" : "add",
      description:
        user.xnScore >= 75
          ? "You earn a discount for high trust!"
          : "Improve XnScore for better rates",
    },
    {
      label: `${user.tier} Member Bonus`,
      value: calc.tierBonus,
      type: "discount",
      description: "Loyalty reward for completing circles",
    },
  ];

  if (calc.earlyRepayBonus) {
    rateComponents.push({
      label: "Early Repayment History",
      value: calc.earlyRepayBonus,
      type: "discount",
      description: "Reward for paying advances early",
    });
  }

  const improvements = [
    { icon: "⭐", text: "Reach XnScore 80+", reward: "-0.5%", achieved: user.xnScore >= 80 },
    { icon: "🏆", text: "Complete 10 circles", reward: "-0.3%", achieved: user.circlesCompleted >= 10 },
    { icon: "💨", text: "Pay advances early", reward: "-0.5%", achieved: calc.earlyRepayBonus !== 0 },
    { icon: "👥", text: "Refer 3 friends", reward: "-0.2%", achieved: false },
  ];

  const tiers = [
    { range: "85+", rate: "6.0%", label: "Premium", current: user.xnScore >= 85 },
    { range: "75-84", rate: "7.5%", label: "Gold", current: user.xnScore >= 75 && user.xnScore < 85 },
    { range: "65-74", rate: "9.5%", label: "Silver", current: user.xnScore >= 65 && user.xnScore < 75 },
    { range: "50-64", rate: "12%", label: "Bronze", current: user.xnScore >= 50 && user.xnScore < 65 },
  ];

  const savingsVsLocal = comparison.localMoneyLender - comparison.tandaxn;

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
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t("rate_breakdown.header_title")}</Text>
              <Text style={styles.headerSubtitle}>
                Your personalized rate breakdown
              </Text>
            </View>
          </View>

          <View style={styles.rateBlock}>
            <Text style={styles.rateLabel}>{t("rate_breakdown.label_your_rate")}</Text>
            <Text style={styles.rateValue}>{calc.finalRate}%</Text>
            <Text style={styles.rateSub}>
              Based on XnScore {user.xnScore} • {user.tier} Member
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Rate calculation */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("rate_breakdown.section_calculated")}</Text>
            <View style={styles.componentsList}>
              {rateComponents.map((component, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.componentRow,
                    idx < rateComponents.length - 1 && styles.componentRowBorder,
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.componentLabel}>{component.label}</Text>
                    <Text style={styles.componentDescription}>
                      {component.description}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.componentValue,
                      {
                        color:
                          component.type === "discount"
                            ? TEAL
                            : component.type === "add"
                              ? AMBER
                              : NAVY,
                      },
                    ]}
                  >
                    {component.value > 0 ? "+" : ""}
                    {component.value}%
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("rate_breakdown.label_final_rate")}</Text>
              <Text style={styles.totalValue}>{calc.finalRate}%</Text>
            </View>
          </View>

          {/* Comparison */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("rate_breakdown.section_compare")}</Text>
            <View style={styles.comparisonList}>
              <ComparisonRow
                label="Payday lender"
                value={`${comparison.paydayLender}%+`}
                bg="#FEE2E2"
                labelColor="#991B1B"
                valueColor={RED}
              />
              <ComparisonRow
                label="Local money lender"
                value={`${comparison.localMoneyLender}%`}
                bg="#FEF3C7"
                labelColor="#92400E"
                valueColor={AMBER}
              />
              <ComparisonRow
                label="Bank personal loan"
                value={`${comparison.bankPersonalLoan}%`}
                bg="#F5F7FA"
                labelColor={MUTED}
                valueColor={MUTED}
              />
              <ComparisonRow
                label="TandaXn (You!) ✓"
                value={`${comparison.tandaxn}%`}
                bg="#F0FDFB"
                labelColor="#065F46"
                valueColor={TEAL}
                win
              />
            </View>
            {savingsVsLocal > 0 && (
              <View style={styles.savingsBanner}>
                <Text style={styles.savingsText}>
                  💰 You save {savingsVsLocal}% vs local lenders!
                </Text>
              </View>
            )}
          </View>

          {/* How to improve */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              How to get an even better rate
            </Text>
            <View style={styles.improvementsList}>
              {improvements.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.improvementRow,
                    { backgroundColor: item.achieved ? "#F0FDFB" : "#F5F7FA" },
                  ]}
                >
                  <View style={styles.improvementLeft}>
                    <Text
                      style={[
                        styles.improvementIcon,
                        !item.achieved && styles.improvementIconMuted,
                      ]}
                    >
                      {item.icon}
                    </Text>
                    <Text
                      style={[
                        styles.improvementText,
                        item.achieved && styles.improvementTextAchieved,
                      ]}
                    >
                      {item.text}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.improvementReward,
                      { color: item.achieved ? TEAL : "#9CA3AF" },
                    ]}
                  >
                    {item.achieved ? "✓ Applied" : item.reward}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.improveButton}
              onPress={() => navigation.navigate(Routes.XnScoreDashboard)}
              accessibilityRole="button"
              accessibilityLabel="See all ways to improve rate"
            >
              <Text style={styles.improveButtonText}>
                See All Ways to Improve Rate
              </Text>
            </TouchableOpacity>
          </View>

          {/* XnScore rate tiers — navy */}
          <View style={styles.tiersCard}>
            <Text style={styles.tiersTitle}>{t("rate_breakdown.tiers_title")}</Text>
            <View style={styles.tiersList}>
              {tiers.map((tier, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tierRow,
                    tier.current && styles.tierRowCurrent,
                  ]}
                >
                  <View style={styles.tierLeft}>
                    <Text style={styles.tierRange}>{tier.range}</Text>
                    <Text
                      style={[
                        styles.tierLabel,
                        { color: tier.current ? TEAL : "rgba(255,255,255,0.5)" },
                      ]}
                    >
                      {tier.label}
                      {tier.current ? " ← You" : ""}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.tierRate,
                      { color: tier.current ? TEAL : "rgba(255,255,255,0.7)" },
                    ]}
                  >
                    {tier.rate}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ComparisonRow({
  label,
  value,
  bg,
  labelColor,
  valueColor,
  win,
}: {
  label: string;
  value: string;
  bg: string;
  labelColor: string;
  valueColor: string;
  win?: boolean;
}) {
  return (
    <View
      style={[
        styles.comparisonRow,
        { backgroundColor: bg },
        win && styles.comparisonRowWin,
      ]}
    >
      <Text
        style={[
          styles.comparisonLabel,
          { color: labelColor, fontWeight: win ? "600" : "400" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.comparisonValue,
          { color: valueColor, fontSize: win ? 18 : 16 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: { paddingTop: 20, paddingBottom: 80, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
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

  rateBlock: { alignItems: "center" },
  rateLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  rateValue: { fontSize: 52, fontWeight: "700", color: TEAL },
  rateSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
  },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 16,
  },

  componentsList: {},
  componentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  componentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  componentLabel: { fontSize: 13, fontWeight: "600", color: NAVY },
  componentDescription: { fontSize: 11, color: MUTED, marginTop: 2 },
  componentValue: { fontSize: 15, fontWeight: "700" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: NAVY,
  },
  totalLabel: { fontSize: 16, fontWeight: "700", color: NAVY },
  totalValue: { fontSize: 24, fontWeight: "700", color: TEAL },

  comparisonList: { gap: 8 },
  comparisonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
  },
  comparisonRowWin: { borderWidth: 2, borderColor: TEAL },
  comparisonLabel: { fontSize: 13 },
  comparisonValue: { fontWeight: "700" },
  savingsBanner: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
    alignItems: "center",
  },
  savingsText: { fontSize: 13, fontWeight: "600", color: "#065F46" },

  improvementsList: { gap: 10 },
  improvementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
  },
  improvementLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  improvementIcon: { fontSize: 18 },
  improvementIconMuted: { opacity: 0.4 },
  improvementText: { fontSize: 13, color: MUTED },
  improvementTextAchieved: {
    color: "#065F46",
    textDecorationLine: "line-through",
  },
  improvementReward: { fontSize: 13, fontWeight: "700" },
  improveButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  improveButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  tiersCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
  },
  tiersTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  tiersList: { gap: 6 },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tierRowCurrent: {
    backgroundColor: "rgba(0,198,174,0.2)",
    borderWidth: 2,
    borderColor: TEAL,
  },
  tierLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  tierRange: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  tierLabel: { fontSize: 11 },
  tierRate: { fontSize: 14, fontWeight: "700" },
});
