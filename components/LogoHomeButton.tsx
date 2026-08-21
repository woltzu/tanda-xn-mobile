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
import { StyleSheet, TouchableOpacity, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";

// TEAL kept as the container's backgroundColor so a brief blank state
// (image cache miss / decode) still shows a teal square rather than a
// hole in the layout. The PNG's own teal covers it once loaded.
const TEAL = colors.accentTeal;

export default function LogoHomeButton() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const handlePress = useCallback(() => {
    // Nested navigation — "Home" is a tab inside MainTabs, not a route
    // on the root Stack. Dispatching plain navigate({name:"Home"}) to
    // the root Stack errors ("was not handled by any navigator"). The
    // { screen } form targets the tab explicitly and is a no-op if the
    // user is already on the Home tab.
    navigation.navigate("MainTabs", { screen: "Home" });
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
      <Image
        source={require("../assets/icon.png")}
        style={styles.logoImage}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
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
  logoImage: {
    // Fills the 28x28 badge. resizeMode="contain" preserves the PNG's
    // built-in rounded corners without stretching. Sized in %s so any
    // future tweak to xnMark's width/height flows through.
    width: "100%",
    height: "100%",
  },
});
