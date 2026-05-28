// ══════════════════════════════════════════════════════════════════════════════
// screens/LimitedModeScreen.tsx — KYC-011 limited-features acknowledgment
// ══════════════════════════════════════════════════════════════════════════════
//
// Reached when the user opts to skip verification (or while their ITIN
// is being processed). The screen reassures them they can still use
// TandaXn's core features and shows what's gated until they verify.
//
// Route params:
//   {
//     currentTier?: 1 | 2 | 3;   // defaults to 1
//     reason?: 'skipped' | 'itin_pending';  // defaults to 'skipped'
//   }
//
// Hero icon and copy swap based on reason:
//   - 'skipped'      → 👋 + "No Problem!"
//   - 'itin_pending' → ⏳ + "We'll Notify You!"
//
// Buttons:
//   - "Start Using TandaXn" / "Continue to TandaXn" → Dashboard
//   - "Actually, I'll verify now" (only when reason !== 'itin_pending')
//     → VerificationOptions (Interest-First flow re-entry — KYC-2.2)
//
// Translated from KYC screens/11_LimitedMode.jsx.
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
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type Reason = "skipped" | "itin_pending";

type LimitedModeParams = {
  currentTier?: 1 | 2 | 3;
  reason?: Reason;
};
type LimitedModeRouteProp = RouteProp<
  { LimitedMode: LimitedModeParams },
  "LimitedMode"
>;

// Six things the user CAN still do without verifying. The last item
// ("Interest keeps growing") is the bridge that motivates them to
// come back and verify — it's there whether they verify or not.
const AVAILABLE_FEATURES = [
  "Join savings circles",
  "Contribute monthly payments",
  "Track your savings progress",
  "Chat with circle members",
  "View your dashboard",
  "Interest keeps growing",
];

type LimitedFeature = { text: string; tier: 2 | 3 };

// Three rewards behind verification. All gated at Tier 3 because the
// new Interest-First flow's headline reward (claiming earned
// interest, unlimited payouts, international transfers) requires
// tax-ID submission. The earlier per-currentTier split is gone —
// every limited-mode user, regardless of partial progress, sees the
// same unlock-targets list.
const LIMITED_FEATURES: LimitedFeature[] = [
  { text: "Receive payouts over $600/year", tier: 3 },
  { text: "Earn interest on savings", tier: 3 },
  { text: "Send money internationally", tier: 3 },
];

export default function LimitedModeScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<LimitedModeRouteProp>();
  // currentTier param is still accepted for future use (badge swap,
  // analytics tagging) but no longer branches the feature lists —
  // the Interest-First flow shows the same single list to all
  // limited-mode users.
  const reason: Reason = route.params?.reason ?? "skipped";

  const limitedFeatures = LIMITED_FEATURES;

  const isPending = reason === "itin_pending";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.heroIconBox}>
            <Text style={styles.heroIcon}>{isPending ? "⏳" : "👋"}</Text>
          </View>
          <Text style={styles.heroTitle}>
            {isPending ? "We'll Notify You!" : "No Problem!"}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isPending
              ? "Your ITIN application is being processed"
              : "You can still start using TandaXn"}
          </Text>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* ITIN Pending note */}
          {isPending && (
            <View style={styles.itinPendingAlert}>
              <View style={styles.itinPendingIcon}>
                <Ionicons name="time-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itinPendingTitle}>ITIN Processing Time</Text>
                <Text style={styles.itinPendingBody}>
                  ITINs usually take 7-11 weeks to process. We'll automatically
                  upgrade your account when it's approved.
                </Text>
              </View>
            </View>
          )}

          {/* What you CAN do */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What you can do now</Text>
            <View style={styles.availableList}>
              {AVAILABLE_FEATURES.map((text, idx) => (
                <View key={idx} style={styles.availableRow}>
                  <Ionicons name="checkmark" size={16} color="#059669" />
                  <Text style={styles.availableText}>{text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* What's Limited */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Unlock later by verifying</Text>
            <View style={styles.limitedList}>
              {limitedFeatures.map((feature, idx) => (
                <View key={idx} style={styles.limitedRow}>
                  <Ionicons name="lock-closed" size={14} color={MUTED} />
                  <Text style={styles.limitedText}>{feature.text}</Text>
                  <View style={styles.tierChip}>
                    <Text style={styles.tierChipText}>
                      Tier {feature.tier}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Reassurance */}
          <View style={styles.reassuranceCard}>
            <Text style={styles.reassuranceEmoji}>💚</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.reassuranceTitle}>Take your time</Text>
              <Text style={styles.reassuranceBody}>
                You can complete verification whenever you're ready. We'll
                remind you when you need it (like when you're about to receive
                a payout).
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate(Routes.Dashboard)}
          accessibilityRole="button"
          accessibilityLabel={
            isPending ? "Continue to TandaXn" : "Start using TandaXn"
          }
        >
          <Text style={styles.primaryButtonText}>
            {isPending ? "Continue to TandaXn" : "Start Using TandaXn"}
          </Text>
        </TouchableOpacity>
        {!isPending && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate(Routes.VerificationOptions)}
            accessibilityRole="button"
            accessibilityLabel="Actually, I'll verify now"
          >
            <Text style={styles.secondaryButtonText}>
              Actually, I'll verify now
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heroIcon: { fontSize: 40 },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },

  contentWrap: { padding: 20 },

  itinPendingAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  itinPendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  itinPendingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
  itinPendingBody: {
    fontSize: 12,
    color: "#3B82F6",
    lineHeight: 18,
    marginTop: 4,
  },

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

  availableList: { gap: 10 },
  availableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
  },
  availableText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#065F46",
    flex: 1,
  },

  limitedList: { gap: 10 },
  limitedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  limitedText: {
    fontSize: 13,
    color: MUTED,
    flex: 1,
  },
  tierChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
  },
  tierChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  reassuranceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
  },
  reassuranceEmoji: { fontSize: 18 },
  reassuranceTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
  },
  reassuranceBody: {
    fontSize: 12,
    color: "#047857",
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
