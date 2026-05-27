// ══════════════════════════════════════════════════════════════════════════════
// screens/OnboardingWelcomeScreen.tsx — KYC-000 inclusive welcome
// ══════════════════════════════════════════════════════════════════════════════
//
// First screen in the native KYC flow. Translated from the original
// web-React design (KYC screens/00_OnboardingWelcome.jsx). The web
// version used <div>, <button>, CSS strings, and prop callbacks; this
// version uses React Native primitives, StyleSheet, LinearGradient,
// and useTypedNavigation.
//
// Visual design preserved: navy → #143654 gradient hero, decorative
// teal circles, "Tx" logo block, hero copy, flag row, white card with
// 4 highlights, trust badges, two-button footer.
//
// Navigation:
//   - Get Started → VerificationOptions (start KYC flow)
//   - I already have an account → Login (existing auth screen)
//
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
import { LinearGradient } from "expo-linear-gradient";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

const HIGHLIGHTS = [
  { icon: "🌍", title: "Built for diaspora", desc: "By the community, for the community" },
  { icon: "🤝", title: "No SSN required", desc: "Use any valid ID to get started" },
  { icon: "🔒", title: "Safe & secure", desc: "Bank-level security, your data protected" },
  { icon: "💚", title: "We don't judge", desc: "Everyone's welcome here" },
];

const FLAGS = ["🇸🇳", "🇳🇬", "🇬🇭", "🇨🇲", "🇰🇪", "🇪🇹", "🇿🇦", "🇲🇦"];

const TRUST_BADGES = [
  { icon: "🔐", text: "256-bit encryption" },
  { icon: "🏦", text: "FDIC partner banks" },
];

export default function OnboardingWelcomeScreen() {
  const navigation = useTypedNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero gradient */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles */}
          <View style={styles.decorCircleTopRight} />
          <View style={styles.decorCircleBottomLeft} />

          {/* Logo block */}
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>Tx</Text>
          </View>

          <Text style={styles.heroTitle}>Welcome Home</Text>
          <Text style={styles.heroSubtitle}>
            Join millions saving together through trusted community circles
          </Text>

          {/* Flag row */}
          <View style={styles.flagRow}>
            {FLAGS.map((flag, idx) => (
              <Text key={idx} style={styles.flag}>
                {flag}
              </Text>
            ))}
          </View>
        </LinearGradient>

        {/* Highlights card */}
        <View style={styles.contentWrap}>
          <View style={styles.highlightsCard}>
            {HIGHLIGHTS.map((item, idx) => (
              <View
                key={idx}
                style={[styles.highlightRow, idx > 0 && styles.highlightRowGap]}
              >
                <View style={styles.highlightIconBox}>
                  <Text style={styles.highlightIconText}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.highlightTitle}>{item.title}</Text>
                  <Text style={styles.highlightDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Trust badges */}
          <View style={styles.trustBadges}>
            {TRUST_BADGES.map((badge, idx) => (
              <View key={idx} style={styles.trustBadge}>
                <Text style={styles.trustBadgeIcon}>{badge.icon}</Text>
                <Text style={styles.trustBadgeText}>{badge.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar — pinned outside scroll */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate(Routes.VerificationOptions)}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate(Routes.Login)}
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
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
    paddingBottom: 80,
    paddingHorizontal: 20,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  decorCircleTopRight: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(0, 198, 174, 0.1)",
  },
  decorCircleBottomLeft: {
    position: "absolute",
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0, 198, 174, 0.05)",
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 280,
    lineHeight: 24,
    textAlign: "center",
  },
  flagRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  flag: { fontSize: 24, opacity: 0.9 },

  contentWrap: { paddingHorizontal: 20, marginTop: -40 },

  highlightsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  highlightRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  highlightRowGap: { marginTop: 16 },
  highlightIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  highlightIconText: { fontSize: 24 },
  highlightTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  highlightDesc: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },

  trustBadges: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 24,
  },
  trustBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  trustBadgeIcon: { fontSize: 14 },
  trustBadgeText: { fontSize: 11, color: MUTED },

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
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: MUTED,
  },
});
