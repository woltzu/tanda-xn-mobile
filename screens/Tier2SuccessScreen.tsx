// ══════════════════════════════════════════════════════════════════════════════
// screens/Tier2SuccessScreen.tsx — KYC-009 verification success
// ══════════════════════════════════════════════════════════════════════════════
//
// Celebration screen shown after both ID sides have been captured. The
// user is now Tier 2 (Verified) — they can receive payouts up to $600
// a year, create circles, and become an Elder. Tier 3 is gated behind
// optional tax-ID submission.
//
// Translated from KYC screens/09_Tier2Success.jsx.
//
// User name is sourced from useAuth().user.name with a "there" fallback.
//
// Navigation:
//   - "Start Using TandaXn" → Dashboard
//   - "Go to Dashboard"     → Dashboard
//   - "Add Tax ID Later"    → TaxIDEntry
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
import { useAuth } from "../context/AuthContext";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const GREEN = "#059669";

const UNLOCKED_FEATURES = [
  { icon: "💰", title: "Receive payouts", desc: "Up to $600/year" },
  { icon: "🔄", title: "Create circles", desc: "Start your own savings groups" },
  { icon: "👥", title: "Become an Elder", desc: "Help your community" },
  { icon: "⭐", title: "Build your reputation", desc: "Earn trust in the community" },
];

const TIER3_FEATURES = [
  { icon: "💵", title: "Unlimited payouts", desc: "No yearly limit" },
  { icon: "📈", title: "Earn interest", desc: "On your savings" },
  { icon: "🌍", title: "Send internationally", desc: "To family abroad" },
];

export default function Tier2SuccessScreen() {
  const navigation = useTypedNavigation();
  const { user } = useAuth();
  const userName = user?.name ?? "there";

  const goToDashboard = () => navigation.navigate(Routes.Dashboard);
  const goToTaxIdEntry = () => navigation.navigate(Routes.TaxIDEntry);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Animated-style success circle (no animation for now; just static rings) */}
          <View style={styles.successOuterRing}>
            <View style={styles.successInnerRing}>
              <Ionicons name="checkmark" size={36} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.heroTitle}>You're Verified! 🎉</Text>
          <Text style={styles.heroSubtitle}>
            Welcome to TandaXn, {userName}
          </Text>

          {/* Tier 2 badge */}
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeEmoji}>✨</Text>
            <Text style={styles.tierBadgeText}>Tier 2: Verified</Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* What you can do now */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What you can do now</Text>
            <View style={styles.unlockedList}>
              {UNLOCKED_FEATURES.map((feature, idx) => (
                <View key={idx} style={styles.unlockedRow}>
                  <Text style={styles.unlockedIcon}>{feature.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unlockedTitle}>{feature.title}</Text>
                    <Text style={styles.unlockedDesc}>{feature.desc}</Text>
                  </View>
                  <Ionicons name="checkmark" size={18} color={GREEN} />
                </View>
              ))}
            </View>
          </View>

          {/* Tier 3 teaser */}
          <View style={styles.sectionCard}>
            <View style={styles.tier3Header}>
              <Text style={styles.sectionTitle}>Want full access?</Text>
              <View style={styles.optionalTag}>
                <Text style={styles.optionalTagText}>OPTIONAL</Text>
              </View>
            </View>
            <Text style={styles.tier3Subtitle}>
              Add your tax ID (SSN or ITIN) to unlock:
            </Text>
            <View style={styles.tier3List}>
              {TIER3_FEATURES.map((feature, idx) => (
                <View key={idx} style={styles.tier3Row}>
                  <Text style={styles.tier3Icon}>{feature.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tier3Title}>{feature.title}</Text>
                    <Text style={styles.tier3Desc}>{feature.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.addTaxIdButton}
              onPress={goToTaxIdEntry}
              accessibilityRole="button"
              accessibilityLabel="Add tax ID later"
            >
              <Text style={styles.addTaxIdButtonText}>Add Tax ID Later</Text>
            </TouchableOpacity>
          </View>

          {/* ITIN note */}
          <View style={styles.itinNote}>
            <Text style={styles.itinNoteEmoji}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itinNoteTitle}>No SSN? No problem!</Text>
              <Text style={styles.itinNoteBody}>
                You can use an ITIN instead. Anyone can get one, regardless of
                immigration status. We can help you apply when you're ready.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={goToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Start using TandaXn"
        >
          <Text style={styles.primaryButtonText}>Start Using TandaXn</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={goToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Go to dashboard"
        >
          <Text style={styles.secondaryButtonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: "center",
  },

  successOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successInnerRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },

  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  tierBadgeEmoji: { fontSize: 16 },
  tierBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
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
    marginBottom: 14,
  },

  unlockedList: { gap: 12 },
  unlockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
  },
  unlockedIcon: { fontSize: 22 },
  unlockedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  unlockedDesc: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },

  tier3Header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  optionalTag: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionalTagText: {
    color: "#92400E",
    fontSize: 10,
    fontWeight: "600",
  },
  tier3Subtitle: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 12,
    marginTop: -8,
  },
  tier3List: { gap: 10 },
  tier3Row: { flexDirection: "row", alignItems: "center", gap: 10 },
  tier3Icon: { fontSize: 18 },
  tier3Title: {
    fontSize: 13,
    fontWeight: "500",
    color: NAVY,
  },
  tier3Desc: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 1,
  },
  addTaxIdButton: {
    paddingVertical: 12,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  addTaxIdButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },

  itinNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
  },
  itinNoteEmoji: { fontSize: 16 },
  itinNoteTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
  },
  itinNoteBody: {
    fontSize: 11,
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
    fontWeight: "600",
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
