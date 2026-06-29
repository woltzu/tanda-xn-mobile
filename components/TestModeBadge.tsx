// ═══════════════════════════════════════════════════════════════════════════
// components/TestModeBadge.tsx — Stage 2 wrap-up
//
// Small pill rendered on financial screens whenever the app is running
// against Stripe test keys (or in a __DEV__ build). Mounted on the
// member-facing contribution screen so testers can tell at a glance
// that they're touching fake money — and so a real user who somehow
// ends up on a test build won't think a card decline is permanent.
//
// Detection — two signals, OR'd:
//   1. React Native's __DEV__ flag (true in `npx expo` dev runs).
//   2. EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY starts with 'pk_test_'.
//      This catches the case where a production build is configured
//      with test keys (e.g. internal QA distribution).
//
// In a real prod build with prod keys, the badge renders null and adds
// zero pixels to the layout.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet } from "react-native";

const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const isTestKey = STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_");

// Note: __DEV__ is a global injected by the React Native bundler. It's
// true for `expo start` runs and false for production exports.
const showBadge = (typeof __DEV__ !== "undefined" && __DEV__) || isTestKey;

export default function TestModeBadge() {
  if (!showBadge) return null;
  return (
    <View style={styles.badge} accessibilityRole="text">
      <Text style={styles.text}>TEST MODE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    marginTop: 8,
    marginBottom: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
    letterSpacing: 0.5,
  },
});
