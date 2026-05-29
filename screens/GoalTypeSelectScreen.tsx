// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalTypeSelectScreen.tsx — GOALS-004
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 155-GOALS-004-GoalTypeSelect.jsx.
//
// Second step of goal creation: pick a specific goal type within the chosen
// category, with typical cost / timeline / achievement shown per option.
//
// Route params (optional):
//   category?: { id; name; emoji; color; bgColor }  (defaults to Financial Freedom)
//
// NAVIGATION — onBack → goBack(); selecting a goal type (or the custom
// option) navigates to GoalCreate with { goalType }.
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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";
const MUTED = "#6B7280";

type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
};

type GoalTypeOption = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  typicalCost: string;
  timeline: string;
  achievement: string;
};

type GoalTypeSelectParams = { category?: Category };
type GoalTypeSelectRouteProp = RouteProp<
  { GoalTypeSelect: GoalTypeSelectParams },
  "GoalTypeSelect"
>;

const DEFAULT_CATEGORY: Category = {
  id: "financial_freedom",
  name: "Financial Freedom",
  emoji: "💰",
  color: "#059669",
  bgColor: "#F0FDFB",
};

const GOAL_TYPES_BY_CATEGORY: Record<string, GoalTypeOption[]> = {
  family: [
    {
      id: "start_family",
      emoji: "👶",
      name: "Start a Family",
      description: "IVF, adoption, or surrogacy costs",
      typicalCost: "$15,000 - $100,000",
      timeline: "1-3 years",
      achievement: "Become a parent",
    },
    {
      id: "education_fund",
      emoji: "🎓",
      name: "Education Fund",
      description: "Give your kids better opportunities",
      typicalCost: "$50,000 - $200,000",
      timeline: "18+ years",
      achievement: "Fund your child's future",
    },
    {
      id: "wedding",
      emoji: "💒",
      name: "Wedding",
      description: "Celebrate love and unite families",
      typicalCost: "$15,000 - $50,000",
      timeline: "1-2 years",
      achievement: "The celebration you deserve",
    },
    {
      id: "support_parents",
      emoji: "👴",
      name: "Support Aging Parents",
      description: "Honor and care for your elders",
      typicalCost: "$5,000 - $50,000/year",
      timeline: "Ongoing",
      achievement: "Give back to those who gave",
    },
    {
      id: "family_immigration",
      emoji: "✈️",
      name: "Bring Family to US",
      description: "Immigration costs and support",
      typicalCost: "$10,000 - $30,000",
      timeline: "2-5 years",
      achievement: "Reunite your family",
    },
  ],
  financial_freedom: [
    {
      id: "first_home",
      emoji: "🏠",
      name: "First Home",
      description: "Down payment and closing costs",
      typicalCost: "$20,000 - $80,000",
      timeline: "3-7 years",
      achievement: "Become a homeowner",
    },
    {
      id: "start_business",
      emoji: "💼",
      name: "Start My Business",
      description: "Launch capital and initial costs",
      typicalCost: "$10,000 - $50,000",
      timeline: "1-3 years",
      achievement: "Become an entrepreneur",
    },
    {
      id: "emergency_fund",
      emoji: "🆘",
      name: "Emergency Fund",
      description: "6-12 months of expenses",
      typicalCost: "$5,000 - $30,000",
      timeline: "1-2 years",
      achievement: "Financial peace of mind",
    },
    {
      id: "debt_freedom",
      emoji: "⛓️",
      name: "Pay Off Debt",
      description: "Eliminate financial burden",
      typicalCost: "Varies",
      timeline: "2-5 years",
      achievement: "Total debt freedom",
    },
    {
      id: "retirement",
      emoji: "🏖️",
      name: "Retire Comfortably",
      description: "Long-term security",
      typicalCost: "$500,000+",
      timeline: "20-40 years",
      achievement: "Golden years secured",
    },
  ],
  personal_transformation: [
    {
      id: "us_citizenship",
      emoji: "🗽",
      name: "US Citizenship",
      description: "Immigration lawyers and fees",
      typicalCost: "$5,000 - $20,000",
      timeline: "2-5 years",
      achievement: "Full belonging and security",
    },
    {
      id: "professional_cert",
      emoji: "📜",
      name: "Professional Certification",
      description: "MBA, CFA, medical, or other",
      typicalCost: "$2,000 - $100,000",
      timeline: "1-4 years",
      achievement: "Career advancement",
    },
    {
      id: "health_wellness",
      emoji: "💪",
      name: "Health & Wellness",
      description: "Medical, dental, or fitness goals",
      typicalCost: "$5,000 - $50,000",
      timeline: "1-2 years",
      achievement: "Live pain-free and healthy",
    },
    {
      id: "new_skill",
      emoji: "🧠",
      name: "Master New Skill",
      description: "Courses, training, equipment",
      typicalCost: "$1,000 - $20,000",
      timeline: "6-24 months",
      achievement: "Unlock new potential",
    },
    {
      id: "return_home",
      emoji: "🌍",
      name: "Return Home Permanently",
      description: "Property and transition costs",
      typicalCost: "$50,000 - $200,000",
      timeline: "5-15 years",
      achievement: "Come full circle",
    },
  ],
  legacy: [
    {
      id: "generational_wealth",
      emoji: "💎",
      name: "Generational Wealth",
      description: "Life insurance, trusts, education",
      typicalCost: "$100,000+",
      timeline: "Lifetime",
      achievement: "Secure your children's future",
    },
    {
      id: "property_home_country",
      emoji: "🏡",
      name: "Property Back Home",
      description: "Land, construction, or purchase",
      typicalCost: "$20,000 - $100,000",
      timeline: "3-10 years",
      achievement: "Roots in your homeland",
    },
    {
      id: "family_trust",
      emoji: "📋",
      name: "Family Trust",
      description: "Estate planning and legal",
      typicalCost: "$10,000 - $50,000",
      timeline: "2-5 years",
      achievement: "Protected legacy",
    },
    {
      id: "community_project",
      emoji: "🤝",
      name: "Community Project",
      description: "Give back to hometown",
      typicalCost: "$5,000 - $50,000",
      timeline: "1-5 years",
      achievement: "Make a lasting impact",
    },
    {
      id: "hometown_development",
      emoji: "🏗️",
      name: "Hometown Development",
      description: "Infrastructure, schools, clinics",
      typicalCost: "$10,000 - $100,000",
      timeline: "3-10 years",
      achievement: "Transform your village",
    },
  ],
};

export default function GoalTypeSelectScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalTypeSelectRouteProp>();

  const category = route.params?.category ?? DEFAULT_CATEGORY;
  const goalTypes =
    GOAL_TYPES_BY_CATEGORY[category.id] ||
    GOAL_TYPES_BY_CATEGORY.financial_freedom;

  const handleSelectGoalType = (goalType: GoalTypeOption) => {
    navigation.navigate(Routes.GoalCreate, { goalType });
  };

  const handleCustomGoal = () => {
    navigation.navigate(Routes.GoalCreate, {
      goalType: {
        id: "custom",
        emoji: "⭐",
        name: "Custom Goal",
        description: "Your personal goal",
        suggestedTarget: 10000,
        suggestedMonthly: 500,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
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
            <View>
              <Text style={styles.headerKicker}>
                {category.name.toUpperCase()}
              </Text>
              <Text style={styles.headerTitle}>Choose Your Goal</Text>
            </View>
          </View>

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeEmoji}>{category.emoji}</Text>
            <Text style={styles.categoryBadgeText}>{category.name}</Text>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          <View style={{ gap: 12 }}>
            {goalTypes.map((goalType) => (
              <TouchableOpacity
                key={goalType.id}
                onPress={() => handleSelectGoalType(goalType)}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={styles.typeCard}
              >
                <View style={styles.typeRow}>
                  <View
                    style={[
                      styles.typeIconBox,
                      { backgroundColor: category.bgColor },
                    ]}
                  >
                    <Text style={styles.typeIcon}>{goalType.emoji}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.typeTitleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.typeName}>{goalType.name}</Text>
                        <Text style={styles.typeDesc}>
                          {goalType.description}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#9CA3AF"
                      />
                    </View>

                    {/* Meta */}
                    <View style={styles.metaRow}>
                      <View>
                        <Text style={styles.metaLabel}>TYPICAL COST</Text>
                        <Text style={styles.metaValue}>
                          {goalType.typicalCost}
                        </Text>
                      </View>
                      <View style={styles.metaDivider} />
                      <View>
                        <Text style={styles.metaLabel}>TIMELINE</Text>
                        <Text style={styles.metaValue}>{goalType.timeline}</Text>
                      </View>
                    </View>

                    {/* Achievement */}
                    <View style={styles.achievementRow}>
                      <Text style={styles.achievementEmoji}>🎯</Text>
                      <Text style={styles.achievementText}>
                        Achievement: {goalType.achievement}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom goal */}
          <TouchableOpacity
            onPress={handleCustomGoal}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={styles.customButton}
          >
            <Text style={styles.customEmoji}>✨</Text>
            <Text style={styles.customText}>
              Something else in {category.name}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 60, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerKicker: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  categoryBadgeEmoji: { fontSize: 18 },
  categoryBadgeText: { fontSize: 13, fontWeight: "500", color: "#FFFFFF" },

  contentWrap: { marginTop: -30, paddingHorizontal: 16 },

  typeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  typeRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  typeIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: { fontSize: 24 },
  typeTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  typeName: { fontSize: 16, fontWeight: "600", color: NAVY },
  typeDesc: { fontSize: 12, color: MUTED, marginTop: 3 },

  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  metaLabel: { fontSize: 10, color: "#9CA3AF" },
  metaValue: { fontSize: 12, fontWeight: "600", color: NAVY, marginTop: 2 },
  metaDivider: { width: 1, backgroundColor: "#E5E7EB" },

  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
  },
  achievementEmoji: { fontSize: 12 },
  achievementText: { fontSize: 11, fontWeight: "500", color: GREEN, flex: 1 },

  customButton: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: TEAL,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  customEmoji: { fontSize: 16 },
  customText: { fontSize: 13, fontWeight: "600", color: TEAL },
});
