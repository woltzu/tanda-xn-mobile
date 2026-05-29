// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalCategorySelectScreen.tsx — GOALS-003
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 154-GOALS-003-GoalCategorySelect.jsx.
//
// First step of goal creation: pick a life-achievement category
// (Family / Financial Freedom / Personal Transformation / Legacy) or a
// custom goal.
//
// NAVIGATION — onBack → goBack(); category selection (incl. the custom
// option) navigates to GoalTypeSelect { category }. "Skip for now" →
// Dashboard.
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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const MUTED = "#6B7280";

type Category = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  examples: string[];
  color: string;
  bgColor: string;
};

const CATEGORIES: Category[] = [
  {
    id: "family",
    emoji: "👨‍👩‍👧‍👦",
    name: "Family Milestones",
    description: "Start a family, support parents, bring loved ones together",
    examples: ["IVF/Adoption", "Wedding", "Education Fund", "Parent Care"],
    color: "#EC4899",
    bgColor: "#FDF2F8",
  },
  {
    id: "financial_freedom",
    emoji: "💰",
    name: "Financial Freedom",
    description: "Build wealth, own assets, achieve independence",
    examples: ["First Home", "Start Business", "Emergency Fund", "Debt Free"],
    color: "#059669",
    bgColor: "#F0FDFB",
  },
  {
    id: "personal_transformation",
    emoji: "🌟",
    name: "Personal Transformation",
    description: "Become who you're meant to be",
    examples: ["US Citizenship", "Professional Cert", "Health & Wellness"],
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
  },
  {
    id: "legacy",
    emoji: "🌍",
    name: "Legacy Goals",
    description: "Build for future generations and give back",
    examples: ["Generational Wealth", "Property Back Home", "Community Project"],
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
];

export default function GoalCategorySelectScreen() {
  const navigation = useTypedNavigation();

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
            <TouchableOpacity
              onPress={() => navigation.navigate(Routes.Dashboard)}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: "center" }}>
            <Text style={styles.titleEmoji}>🎯</Text>
            <Text style={styles.title}>What Are You Achieving?</Text>
            <Text style={styles.subtitle}>
              Choose the life milestone that matters most to you right now
            </Text>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          <View style={{ gap: 12 }}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() =>
                  navigation.navigate(Routes.GoalTypeSelect, { category })
                }
                activeOpacity={0.85}
                accessibilityRole="button"
                style={styles.categoryCard}
              >
                <View style={styles.categoryRow}>
                  <View
                    style={[
                      styles.categoryIconBox,
                      { backgroundColor: category.bgColor },
                    ]}
                  >
                    <Text style={styles.categoryIcon}>{category.emoji}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryDesc}>
                      {category.description}
                    </Text>

                    <View style={styles.exampleRow}>
                      {category.examples.map((example, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.exampleTag,
                            { backgroundColor: category.bgColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.exampleText,
                              { color: category.color },
                            ]}
                          >
                            {example}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#9CA3AF"
                    style={{ marginTop: 4 }}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom goal */}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate(Routes.GoalTypeSelect, {
                category: {
                  id: "custom",
                  name: "Custom Goal",
                  emoji: "✨",
                  color: "#00C6AE",
                  bgColor: "#F0FDFB",
                },
              })
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            style={styles.customButton}
          >
            <Text style={styles.customEmoji}>✨</Text>
            <Text style={styles.customText}>Create a Custom Goal</Text>
          </TouchableOpacity>

          {/* Inspiration quote */}
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>
              "People don't save for things — they save for transformations. The
              purchase is just a step. The goal is the life change."
            </Text>
          </View>
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
    justifyContent: "space-between",
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
  skipText: { fontSize: 14, color: "rgba(255,255,255,0.7)" },
  titleEmoji: { fontSize: 40 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 21,
    textAlign: "center",
  },

  contentWrap: { marginTop: -30, paddingHorizontal: 16 },

  categoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  categoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIcon: { fontSize: 28 },
  categoryName: { fontSize: 17, fontWeight: "600", color: NAVY },
  categoryDesc: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10,
  },
  exampleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  exampleTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  exampleText: { fontSize: 11, fontWeight: "500" },

  customButton: {
    marginTop: 16,
    padding: 16,
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
  customEmoji: { fontSize: 18 },
  customText: { fontSize: 14, fontWeight: "600", color: TEAL },

  quoteCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: NAVY,
    borderRadius: 12,
  },
  quoteText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontStyle: "italic",
    lineHeight: 22,
    textAlign: "center",
  },
});
