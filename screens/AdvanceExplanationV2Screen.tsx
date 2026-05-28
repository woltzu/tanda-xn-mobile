// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceExplanationV2Screen.tsx — ADVANCE-002 explainer (V2 redesign)
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 104-ADVANCE-002-AdvanceExplanation.jsx.
//
// V2 NAMING NOTE — companion to AdvanceHubV2Screen. The existing
// AdvanceExplanationScreen.tsx (668 lines) is NOT replaced; both
// coexist pending a future decision.
//
// 4-step carousel teaching users "this is not a loan — you're
// borrowing from your own future winnings":
//   1. You Have a Payout Coming (🎯)
//   2. Get It Early When You Need It (⚡)
//   3. Auto-Repay From Your Payout (🔄)
//   4. You Keep What's Left (✅)
//
// Each step has a "visual" mini-illustration rendered inline (no
// animation in this commit — Lottie can be added later).
//
// Route params:
//   user?: { name; nextPayout: { amount; date; circleName } }
//
// Navigation:
//   - back chevron → goBack
//   - "Why this rate? See breakdown" → RateBreakdown (forward ref)
//   - bottom CTA "I Understand — Get Started" → SmartCalculator
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
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
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";
const AMBER_BG = "#FEF3C7";

type VisualKind = "payout" | "advance" | "repay" | "keep";

type ExplainStep = {
  icon: string;
  title: string;
  description: string;
  visual: VisualKind;
};

const STEPS: ExplainStep[] = [
  {
    icon: "🎯",
    title: "You Have a Payout Coming",
    description:
      "Every circle member receives a payout when it's their turn. You're expecting $500 on Feb 15 from Family Circle.",
    visual: "payout",
  },
  {
    icon: "⚡",
    title: "Get It Early When You Need It",
    description:
      "Need money before your payout date? Request an advance of up to 80% ($400) of your upcoming payout right now.",
    visual: "advance",
  },
  {
    icon: "🔄",
    title: "Auto-Repay From Your Payout",
    description:
      "When your payout arrives, we automatically withhold the advance + a small fee. No bills, no collectors, no stress.",
    visual: "repay",
  },
  {
    icon: "✅",
    title: "You Keep What's Left",
    description:
      "After repayment, the remaining payout is yours. If you advanced $400 + $20 fee, you'd keep $80 from your $500 payout.",
    visual: "keep",
  },
];

const KEY_DIFFERENCES = [
  { icon: "🔒", text: "No external collection agencies — we just withhold from your payout" },
  { icon: "📊", text: "Your XnScore (Trust Score) determines your rates — not traditional credit" },
  { icon: "⏱️", text: "Automatic repayment — no bills, no remembering due dates" },
  { icon: "💰", text: "Way cheaper than payday lenders (9.5% vs 400%+)" },
];

type AdvanceExplanationV2Params = {
  user?: { name?: string; nextPayout?: { amount: number; date: string; circleName: string } };
};
type AdvanceExplanationV2RouteProp = RouteProp<
  { AdvanceExplanationV2: AdvanceExplanationV2Params },
  "AdvanceExplanationV2"
>;

export default function AdvanceExplanationV2Screen() {
  const navigation = useTypedNavigation();
  useRoute<AdvanceExplanationV2RouteProp>(); // reserve for future param reads

  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];

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
            <Text style={styles.headerTitle}>How Advance Payouts Work</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero */}
          <View style={styles.heroBlock}>
            <View style={styles.heroIconBox}>
              <Text style={styles.heroIcon}>💡</Text>
            </View>
            <Text style={styles.heroTitle}>Not a Loan — An Advance</Text>
            <Text style={styles.heroBody}>
              You're borrowing from{" "}
              <Text style={styles.heroBodyStrong}>your own future winnings</Text>
              , not from a bank or lender.
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Carousel card */}
          <View style={styles.carouselCard}>
            {/* Step indicator pills */}
            <View style={styles.pillsRow}>
              {STEPS.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setCurrentStep(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to step ${idx + 1}`}
                  style={[
                    styles.pill,
                    idx === currentStep && styles.pillActive,
                    idx < currentStep && styles.pillCompleted,
                  ]}
                />
              ))}
            </View>

            {/* Current step */}
            <View style={styles.stepBlock}>
              <View style={styles.stepIconBox}>
                <Text style={styles.stepIcon}>{step.icon}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>

              {/* Visual */}
              <View style={styles.visualBlock}>
                <StepVisual kind={step.visual} />
              </View>
            </View>

            {/* Carousel nav */}
            <View style={styles.navRow}>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.navButtonOutline,
                  currentStep === 0 && styles.navButtonDisabled,
                ]}
                onPress={() =>
                  setCurrentStep(Math.max(0, currentStep - 1))
                }
                disabled={currentStep === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous step"
                accessibilityState={{ disabled: currentStep === 0 }}
              >
                <Text
                  style={[
                    styles.navButtonOutlineText,
                    currentStep === 0 && styles.navButtonTextDisabled,
                  ]}
                >
                  ← Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.navButtonPrimary,
                  currentStep === STEPS.length - 1 && styles.navButtonPrimaryDisabled,
                ]}
                onPress={() =>
                  setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))
                }
                disabled={currentStep === STEPS.length - 1}
                accessibilityRole="button"
                accessibilityLabel="Next step"
                accessibilityState={{ disabled: currentStep === STEPS.length - 1 }}
              >
                <Text
                  style={[
                    styles.navButtonPrimaryText,
                    currentStep === STEPS.length - 1 && styles.navButtonTextDisabled,
                  ]}
                >
                  Next →
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Key Differences */}
          <View style={styles.diffCard}>
            <Text style={styles.diffTitle}>Why This Is Different</Text>
            <View style={styles.diffList}>
              {KEY_DIFFERENCES.map((item, idx) => (
                <View key={idx} style={styles.diffRow}>
                  <Text style={styles.diffIcon}>{item.icon}</Text>
                  <Text style={styles.diffText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Risk Disclaimer */}
          <View style={styles.disclaimerCard}>
            <Ionicons
              name="alert-circle"
              size={20}
              color={AMBER}
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.disclaimerTitle}>What if I default?</Text>
              <Text style={styles.disclaimerBody}>
                If your payout doesn't cover your advance, your XnScore drops
                20 points and you may be restricted from future circles until
                you repay. No external collectors — but it affects your
                ability to participate in TandaXn.
              </Text>
            </View>
          </View>

          {/* See Rates */}
          <TouchableOpacity
            style={styles.ratesButton}
            onPress={() => navigation.navigate(Routes.RateBreakdown)}
            accessibilityRole="button"
            accessibilityLabel="See rate breakdown"
          >
            <Ionicons name="cash-outline" size={16} color={MUTED} />
            <Text style={styles.ratesButtonText}>
              Why this rate? See breakdown
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate(Routes.SmartCalculator)}
          accessibilityRole="button"
          accessibilityLabel="I understand, get started"
        >
          <Text style={styles.primaryButtonText}>I Understand — Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Step visual sub-component ────────────────────────────────────────────

function StepVisual({ kind }: { kind: VisualKind }) {
  switch (kind) {
    case "payout":
      return (
        <View style={visualStyles.row}>
          <View style={visualStyles.tealChip}>
            <Text style={visualStyles.chipLabel}>Family Circle</Text>
            <Text style={visualStyles.chipBigTeal}>$500</Text>
            <Text style={visualStyles.chipSubLabel}>Feb 15, 2025</Text>
          </View>
        </View>
      );
    case "advance":
      return (
        <View style={visualStyles.row}>
          <View style={visualStyles.greyChip}>
            <Text style={visualStyles.chipBigNavy}>$500</Text>
            <Text style={visualStyles.chipMicroLabel}>Your Payout</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={TEAL} />
          <View style={visualStyles.tealOutlineChip}>
            <Text style={visualStyles.chipBigTeal}>$400</Text>
            <Text style={visualStyles.chipMicroTeal}>Get Now!</Text>
          </View>
        </View>
      );
    case "repay":
      return (
        <View style={visualStyles.row}>
          <View style={visualStyles.tealLightChip}>
            <Text style={visualStyles.chipMidTeal}>$500</Text>
            <Text style={visualStyles.chipMicroLabel}>Payout Arrives</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={AMBER} />
          <View style={visualStyles.amberChip}>
            <Text style={visualStyles.chipMidAmber}>-$420</Text>
            <Text style={visualStyles.chipMicroAmber}>Auto-Withheld</Text>
          </View>
        </View>
      );
    case "keep":
      return (
        <View style={visualStyles.row}>
          <View style={visualStyles.greyChip}>
            <Text style={visualStyles.chipStrike}>$500</Text>
          </View>
          <Text style={visualStyles.opSymbol}>−</Text>
          <View style={visualStyles.amberLightChip}>
            <Text style={visualStyles.chipMidAmber}>$420</Text>
          </View>
          <Text style={visualStyles.opSymbol}>=</Text>
          <View style={visualStyles.tealOutlineChip}>
            <Text style={visualStyles.chipBigTeal}>$80</Text>
            <Text style={visualStyles.chipMicroTeal}>Yours! ✓</Text>
          </View>
        </View>
      );
  }
}

const visualStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  tealChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: "center",
  },
  tealOutlineChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: TEAL,
    alignItems: "center",
  },
  tealLightChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
    alignItems: "center",
  },
  greyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    alignItems: "center",
  },
  amberChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: AMBER_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AMBER,
    alignItems: "center",
  },
  amberLightChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: AMBER_BG,
    borderRadius: 8,
    alignItems: "center",
  },
  chipLabel: { fontSize: 12, color: MUTED },
  chipSubLabel: { fontSize: 11, color: MUTED, marginTop: 2 },
  chipBigTeal: { fontSize: 20, fontWeight: "700", color: TEAL, marginTop: 4 },
  chipBigNavy: { fontSize: 18, fontWeight: "700", color: NAVY },
  chipMidTeal: { fontSize: 14, fontWeight: "700", color: TEAL },
  chipMidAmber: { fontSize: 14, fontWeight: "700", color: AMBER },
  chipMicroLabel: { fontSize: 10, color: MUTED, marginTop: 2 },
  chipMicroTeal: { fontSize: 10, color: "#00897B", marginTop: 2 },
  chipMicroAmber: { fontSize: 10, color: "#92400E", marginTop: 2 },
  chipStrike: {
    fontSize: 14,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  opSymbol: { fontSize: 16, color: MUTED },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 100, paddingHorizontal: 20 },
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
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  heroBlock: { alignItems: "center" },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroIcon: { fontSize: 40 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 300,
    textAlign: "center",
    lineHeight: 22,
  },
  heroBodyStrong: { fontWeight: "700" },

  contentWrap: { marginTop: -60, paddingHorizontal: 20 },

  carouselCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pillsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BORDER,
  },
  pillActive: { width: 24, backgroundColor: TEAL },
  pillCompleted: { backgroundColor: TEAL },

  stepBlock: { alignItems: "center", minHeight: 200 },
  stepIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stepIcon: { fontSize: 36 },
  stepTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 12,
    textAlign: "center",
  },
  stepDescription: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 22,
    textAlign: "center",
  },
  visualBlock: { marginTop: 20 },

  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  navButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  navButtonOutlineText: { fontSize: 13, fontWeight: "600", color: NAVY },
  navButtonPrimary: { backgroundColor: TEAL },
  navButtonPrimaryText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  navButtonPrimaryDisabled: { backgroundColor: BORDER },
  navButtonDisabled: { backgroundColor: "#F5F7FA" },
  navButtonTextDisabled: { color: "#9CA3AF" },

  diffCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  diffTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },
  diffList: { gap: 10 },
  diffRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  diffIcon: { fontSize: 18 },
  diffText: { flex: 1, fontSize: 13, color: NAVY, lineHeight: 18 },

  disclaimerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: AMBER_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AMBER,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
  disclaimerBody: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 18,
    marginTop: 6,
  },

  ratesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  ratesButtonText: {
    fontSize: 13,
    color: NAVY,
    fontWeight: "500",
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
