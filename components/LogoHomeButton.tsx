// ═══════════════════════════════════════════════════════════════════════════
// components/LogoHomeButton.tsx — floating brand mark → Home
// ═══════════════════════════════════════════════════════════════════════════
//
// Global floating brand mark. Sits as a sibling to PayoutListener /
// BugReportButton in App.tsx so it renders on top of every screen.
// Tap → navigates to the Home tab (dispatches a CommonActions.navigate
// scoped to the tab navigator so it works from any nested stack).
//
// The button is just the icon — a small teal rounded square with "Xn"
// in navy — matching the onboarding-module brand mark. There is no
// image asset; the logo is CSS-styled everywhere it appears, so we
// reproduce the same look inline with a TouchableOpacity containing a
// single Text glyph. Self-hides when there is no authenticated user
// (same pattern as BugReportButton). Positioning: top-left, tucked
// under the status bar via useSafeAreaInsets.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity, Text } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;

export default function LogoHomeButton() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const handlePress = useCallback(() => {
    // CommonActions.navigate walks up to the nearest navigator that
    // owns a "Home" route — the tab navigator in our tree — so this
    // works from any nested stack. If the user is already on the Home
    // tab, React Navigation is a no-op instead of pushing.
    navigation.dispatch(CommonActions.navigate({ name: "Home" }));
  }, [navigation]);

  // Only render for signed-in users. The unauthenticated tree
  // (Splash / Login / Welcome) already carries its own branding.
  if (!user?.id) return null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Home"
      style={[styles.xnMark, { top: Math.max(insets.top, 8) + 4 }]}
      onPress={handlePress}
      activeOpacity={0.85}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.xnMarkText}>Xn</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  xnMark: {
    position: "absolute",
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    // Above navigator content but below modal/toast layers. Matches
    // the BugReportButton FAB's stacking.
    zIndex: 9998,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  xnMarkText: {
    fontSize: 13,
    fontWeight: typography.bold,
    color: NAVY,
    // Tighten the "Xn" glyph pair a touch so it centers optically
    // inside the small rounded square without extra padding tricks.
    letterSpacing: -0.3,
  },
});
