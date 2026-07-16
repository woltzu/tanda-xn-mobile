// ═══════════════════════════════════════════════════════════════════════════
// components/ScreenHeader.tsx
// ═══════════════════════════════════════════════════════════════════════════
//
// Standard inline navy-gradient header. Drop-in replacement for the
// copy-pasted `<LinearGradient>` block that lives at the top of most
// screens. NOT wired via React Navigation's `screenOptions.header` —
// that would produce duplicate headers on ~150 unmigrated screens that
// already render their own inline gradient.
//
// The header renders as a positioned block inside the screen's body
// (typically inside a ScrollView above `contentContainerStyle`), so
// existing scroll semantics + insets behavior are preserved. The
// caller is responsible for `flex: 1` on the outer container.
//
// The design tokens declare "no gradients" as a rule but every screen
// in the app violates it, so this component matches reality. When the
// design team reconciles the rule this is the ONE place to update
// instead of chasing 150 screens.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "../theme/tokens";

// The gradient bottom color lives here as a literal because there's
// no design token for the navy-secondary shade. Kept here so if the
// team ever adds one, this is the one edit that migrates every screen.
const NAVY_SECONDARY = "#143654";

export type ScreenHeaderProps = {
  // Main text; renders in bold white. Optional so callers can build a
  // logo-only header if they need to.
  title?: string;
  // Second row of text under the title. Small + slightly transparent.
  subtitle?: string;
  // Show the back arrow. Default true. Set false on root/tab screens
  // that were reached without a push.
  showBack?: boolean;
  // Render anything the caller wants on the right — help button,
  // filter chip, admin toggle, etc. The component adds appropriate
  // spacing so callers don't need to.
  rightElement?: React.ReactNode;
  // Escape hatch when the default `navigation.goBack()` isn't what
  // the screen wants (e.g., a modal that needs to reset instead).
  onBackPress?: () => void;
};

export default function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  rightElement,
  onBackPress,
}: ScreenHeaderProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onBackPress]);

  return (
    <LinearGradient
      colors={[colors.primaryNavy, NAVY_SECONDARY]}
      style={[styles.wrap, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.iconBtn}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.cardBg} />
          </TouchableOpacity>
        ) : (
          // Spacer keeps the title area horizontally centered when the
          // back arrow is hidden.
          <View style={styles.iconBtnSpacer} />
        )}

        <View style={styles.textCol}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {/* Right-side slot. When rightElement is absent we render a
            fixed-width spacer so the title stays centered. When
            present, the wrapper only enforces a minimum width — a
            two- or three-icon row fits without clipping. */}
        <View
          style={
            rightElement
              ? styles.rightElementWrap
              : styles.iconBtnSpacer
          }
        >
          {rightElement}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.small + 2,
    backgroundColor: colors.whiteTransparent10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnSpacer: {
    // Same footprint as the back button so a missing back or right
    // element doesn't shift the title.
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  rightElementWrap: {
    // Used when a rightElement is supplied — fits 1–3 icons without
    // clipping. minHeight preserves the row height; alignItems keeps
    // the content vertically centered.
    minWidth: 40,
    height: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.cardBg,
  },
  subtitle: {
    fontSize: typography.bodySmall,
    color: colors.whiteTransparent70,
    marginTop: 2,
  },
});
