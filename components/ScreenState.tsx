// ═══════════════════════════════════════════════════════════════════════════
// components/ScreenState.tsx
// ═══════════════════════════════════════════════════════════════════════════
//
// One component for the three non-happy-path renders every data-heavy
// screen needs — loading, empty, error. Callers pick the variant via
// a discriminated union so unused props stay off the API and TS enforces
// the correct shape per variant.
//
// Not a modal or overlay — renders inline where you'd otherwise stick
// an ActivityIndicator or an inline empty-state block. Wrap it in the
// same padded container the rest of your screen uses.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { colors, radius, spacing, typography } from "../theme/tokens";

// ── Public API ───────────────────────────────────────────────────────────

type LoadingProps = {
  type: "loading";
  // Optional message under the spinner. Defaults to "Loading…".
  message?: string;
};

type EmptyProps = {
  type: "empty";
  // Ionicons name. Defaults to "folder-open-outline".
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  // Optional CTA. Both must be provided for the button to render.
  actionLabel?: string;
  onAction?: () => void;
};

type ErrorProps = {
  type: "error";
  // Ionicons name. Defaults to "alert-circle-outline".
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  description?: string;
  onRetry: () => void;
  // Overrides the default "Try again" label.
  retryLabel?: string;
};

export type ScreenStateProps = LoadingProps | EmptyProps | ErrorProps;

// ── Component ────────────────────────────────────────────────────────────

export default function ScreenState(props: ScreenStateProps) {
  const { t } = useTranslation();

  if (props.type === "loading") {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator color={colors.accentTeal} size="large" />
        <Text style={styles.loadingText}>
          {props.message ?? t("common.loading")}
        </Text>
      </View>
    );
  }

  if (props.type === "empty") {
    const {
      icon = "folder-open-outline",
      title,
      description,
      actionLabel,
      onAction,
    } = props;
    return (
      <View style={styles.centerWrap}>
        <View style={styles.iconRing}>
          <Ionicons name={icon} size={36} color={colors.textSecondary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
        {actionLabel && onAction ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.actionBtn}
            onPress={onAction}
          >
            <Text style={styles.actionBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  // error
  const {
    icon = "alert-circle-outline",
    title = t("common.error"),
    description,
    onRetry,
    retryLabel,
  } = props;
  return (
    <View style={styles.centerWrap}>
      <View style={[styles.iconRing, styles.iconRingError]}>
        <Ionicons name={icon} size={36} color={colors.errorText} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.retryBtn}
        onPress={onRetry}
      >
        <Ionicons name="refresh" size={16} color={colors.cardBg} />
        <Text style={styles.retryBtnText}>
          {retryLabel ?? t("common.retry")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 220,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navyTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconRingError: {
    backgroundColor: colors.errorBg,
  },
  title: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.accentTeal,
    borderRadius: radius.button,
  },
  actionBtnText: {
    color: colors.cardBg,
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryNavy,
    borderRadius: radius.button,
  },
  retryBtnText: {
    color: colors.cardBg,
    fontSize: typography.body,
    fontWeight: typography.bold,
  },
});
