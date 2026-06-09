// ══════════════════════════════════════════════════════════════════════════════
// screens/UnlockInterestPromptScreen.tsx — Interest-First KYC entry point
// ══════════════════════════════════════════════════════════════════════════════
//
// Built per KYC_FLOW_GUIDE.md section 01 (Phase KYC-2.1).
//
// Route params:
//   {
//     totalInterest: number;                              // dollars
//     goalBreakdown?: { goalName: string; interest: number }[];
//   }
//
// Trigger: user taps the "Unlock" button on the Dashboard interest
// card (or on a GoalDetails interest tile). This is the FIRST entry
// point of the new reward-driven KYC flow — the user already earned
// money and we frame verification as "claim your reward" rather than
// "prove your identity."
//
// Actions:
//   - "Unlock My $XX.XX" → VerificationOptions
//   - "Maybe later"      → Dashboard
//
// Notes:
//   - The "confetti" effect is a static row of emoji rather than an
//     animation. A future polish pass can add react-native-confetti
//     or a Lottie file; the visual placeholder is intentional.
//   - The hero uses a teal gradient (money-accent), not navy, because
//     the screen is about reward not security.
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
const TEAL_DARK = "#00A896";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const GREEN = "#059669";

type GoalLine = { goalName: string; interest: number };

type UnlockInterestPromptParams = {
  totalInterest: number;
  goalBreakdown?: GoalLine[];
};
type UnlockInterestPromptRouteProp = RouteProp<
  { UnlockInterestPrompt: UnlockInterestPromptParams },
  "UnlockInterestPrompt"
>;

const BENEFITS = [
  { icon: "💰", text: "Unlock the interest you've already earned" },
  { icon: "📈", text: "Receive unlimited payouts from your circles" },
  { icon: "🌍", text: "Send money internationally to family" },
  { icon: "🏦", text: "Access TandaXn Credit when you need it" },
];

const CONFETTI = ["✨", "🎊", "🎉", "🎊", "✨"];

function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function UnlockInterestPromptScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<UnlockInterestPromptRouteProp>();
  const totalInterest = route.params?.totalInterest ?? 0;
  const goalBreakdown = route.params?.goalBreakdown ?? [];
  const amountLabel = formatMoney(totalInterest);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — celebration gradient with confetti emoji row */}
        <LinearGradient
          colors={[TEAL_DARK, TEAL]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Static "confetti" — placeholder for future Lottie/animation */}
          <View style={styles.confettiRow}>
            {CONFETTI.map((c, i) => (
              <Text key={i} style={styles.confettiText}>
                {c}
              </Text>
            ))}
          </View>

          <View style={styles.heroIconBox}>
            <Text style={styles.heroIcon}>🎉</Text>
          </View>

          <Text style={styles.heroEyebrow}>You've earned</Text>
          <Text style={styles.heroAmount}>{amountLabel}</Text>
          <Text style={styles.heroSubtitle}>
            Interest earned on your savings
          </Text>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Optional breakdown by goal */}
          {goalBreakdown.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Breakdown by goal</Text>
              <View style={styles.breakdownList}>
                {goalBreakdown.map((line, idx) => (
                  <View
                    key={`${line.goalName}-${idx}`}
                    style={[
                      styles.breakdownRow,
                      idx < goalBreakdown.length - 1 &&
                        styles.breakdownRowBorder,
                    ]}
                  >
                    <Text style={styles.breakdownName}>{line.goalName}</Text>
                    <Text style={styles.breakdownAmount}>
                      {formatMoney(line.interest)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* One simple step explainer */}
          <View style={styles.stepCard}>
            <View style={styles.stepIconBox}>
              <Ionicons name="shield-checkmark" size={22} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>One simple step</Text>
              <Text style={styles.stepBody}>
                Tax law requires us to verify your identity before sending
                interest. It takes about 2 minutes — and we accept SSN, ITIN,
                or international ID.
              </Text>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What you'll unlock</Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((b, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{b.icon}</Text>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Privacy reassurance */}
          <View style={styles.privacyCard}>
            <Ionicons
              name="lock-closed"
              size={18}
              color="#1E40AF"
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>Your privacy is protected</Text>
              <Text style={styles.privacyBody}>
                Your tax ID is encrypted and only used for IRS reporting. The
                IRS is legally prohibited from sharing it with immigration
                agencies (Section 6103).
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate(Routes.VerificationOptions)}
          accessibilityRole="button"
          accessibilityLabel={`Unlock my ${amountLabel}`}
        >
          <Text style={styles.primaryButtonText}>Unlock My {amountLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate(Routes.Dashboard)}
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
        >
          <Text style={styles.secondaryButtonText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  confettiRow: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 16,
  },
  confettiText: {
    fontSize: 22,
  },
  heroIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  heroIcon: { fontSize: 44 },
  heroEyebrow: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
  },

  contentWrap: { padding: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  breakdownList: {},
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  breakdownRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  breakdownName: {
    fontSize: 14,
    color: NAVY,
    flex: 1,
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: GREEN,
  },

  stepCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  stepIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 4,
  },
  stepBody: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 20,
  },

  benefitsList: { gap: 10 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: { fontSize: 18 },
  benefitText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
  },

  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 14,
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E40AF",
  },
  privacyBody: {
    fontSize: 12,
    color: "#3B82F6",
    lineHeight: 18,
    marginTop: 4,
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
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: MUTED,
  },
});
