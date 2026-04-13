import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, typography, spacing } from "../theme/tokens";

const ORANGE = "#F97316";
const ORANGE_TINT = "rgba(249,115,22,0.08)";
const KENTE = ["#C4622D", "#E8A842", "#2A5240"];

const steps = [
  { num: 1, label: "Business profile", status: "Now →", active: true },
  { num: 2, label: "Verification documents", status: "Pending", active: false },
  { num: 3, label: "First trip listing", status: "After approval", active: false },
];

const earnings = [
  { emoji: "\u{1F4B0}", label: "Full trip payment", detail: "Released at booking", value: "100%", color: colors.successText },
  { emoji: "\u{1F4E3}", label: "Community reach", detail: "", value: "500+", color: colors.accentTeal },
  { emoji: "\u{1F6E1}", label: "TandaXn fee", detail: "", value: "3.5%", color: colors.warningAmber },
];

export default function ProviderDiscoveryScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.primaryNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Provider</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.eyebrow}>{"\u2726"} For Trip Organizers</Text>
          <Text style={styles.welcomeTitle}>
            Reach 500+ diaspora members who save to travel
          </Text>
          <Text style={styles.welcomeSubtitle}>
            List your group trips on TandaXn and connect with a community that
            saves together through tontine circles. Get paid upfront, grow your
            bookings.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("ProviderProfileSetup")}
          >
            <Text style={styles.startLink}>Start your application {"\u2192"}</Text>
          </TouchableOpacity>
        </View>

        {/* Onboarding Steps */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Onboarding steps</Text>
          {steps.map((step, i) => (
            <View key={step.num} style={styles.stepRow}>
              <View
                style={[
                  styles.stepCircle,
                  step.active ? styles.stepCircleActive : styles.stepCircleInactive,
                ]}
              >
                <Text
                  style={[
                    styles.stepNum,
                    { color: step.active ? "#FFFFFF" : colors.textSecondary },
                  ]}
                >
                  {step.num}
                </Text>
              </View>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <Text
                style={[
                  styles.stepStatus,
                  { color: step.active ? ORANGE : colors.textSecondary },
                ]}
              >
                {step.status}
              </Text>
            </View>
          ))}
        </View>

        {/* Kente Divider */}
        <View style={styles.kenteDivider}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.kenteBar,
                { backgroundColor: KENTE[i % KENTE.length] },
              ]}
            />
          ))}
        </View>

        {/* What You Earn */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What you earn</Text>
          {earnings.map((item, i) => (
            <View
              key={i}
              style={[
                styles.earnRow,
                i < earnings.length - 1 && styles.earnRowBorder,
              ]}
            >
              <Text style={styles.earnEmoji}>{item.emoji}</Text>
              <View style={styles.earnInfo}>
                <Text style={styles.earnLabel}>{item.label}</Text>
                {item.detail ? (
                  <Text style={styles.earnDetail}>{item.detail}</Text>
                ) : null}
              </View>
              <Text style={[styles.earnValue, { color: item.color }]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ProviderProfileSetup")}
        >
          <Text style={styles.ctaText}>Start My Provider Application</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },

  /* Welcome Card */
  welcomeCard: {
    backgroundColor: ORANGE_TINT,
    borderRadius: radius.card,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: ORANGE,
    marginBottom: spacing.sm,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: spacing.sm,
    lineHeight: 28,
  },
  welcomeSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  startLink: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: ORANGE,
  },

  /* Card */
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginBottom: spacing.md,
  },

  /* Steps */
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  stepCircleActive: {
    backgroundColor: ORANGE,
  },
  stepCircleInactive: {
    backgroundColor: colors.border,
  },
  stepNum: {
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
  stepLabel: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
  },
  stepStatus: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
  },

  /* Kente Divider */
  kenteDivider: {
    flexDirection: "row",
    marginBottom: spacing.lg,
    gap: 3,
  },
  kenteBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    opacity: 0.35,
  },

  /* Earnings */
  earnRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  earnRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  earnEmoji: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  earnInfo: {
    flex: 1,
  },
  earnLabel: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  earnDetail: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  earnValue: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
  },

  /* CTA */
  ctaButton: {
    backgroundColor: ORANGE,
    borderRadius: radius.button,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFFFFF",
  },
});
