// ═══════════════════════════════════════════════════════════════════════════
// components/LogoHomeButton.tsx — floating flame+wordmark → Home
// ═══════════════════════════════════════════════════════════════════════════
//
// Global floating brand mark. Sits as a sibling to PayoutListener /
// BugReportButton in App.tsx so it renders on top of every screen.
// Tap → navigates to the Home tab (dispatches a CommonActions.navigate
// scoped to the tab navigator so it works from any nested stack).
//
// Self-hides when there is no authenticated user (same pattern as
// BugReportButton). Positioning: top-left, tucked under the status bar
// via useSafeAreaInsets. It's an overlay, so it sits above whatever
// header the current screen paints — accepted trade-off for "logo on
// every screen" without touching each screen's chrome individually.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";

const NAVY = colors.primaryNavy;

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
      style={[styles.pill, { top: Math.max(insets.top, 8) + 4 }]}
      onPress={handlePress}
      activeOpacity={0.85}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="flame" size={14} color="#E8A842" />
      </View>
      <Text style={styles.wordmark}>TandaXn</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    // Above navigator content but below modal/toast layers. Matches the
    // BugReportButton FAB's stacking.
    zIndex: 9998,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(232,168,66,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 12,
    fontWeight: typography.bold,
    color: NAVY,
    letterSpacing: 0.2,
  },
});
