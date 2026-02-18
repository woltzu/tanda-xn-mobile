import React, { ReactNode } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, typography } from "../../theme/tokens";

type CardVariant = "warning" | "success" | "neutral";

interface TintedInfoCardProps {
  variant: CardVariant;
  icon?: string;
  label: string;
  amount: string;
  subtitle: string;
  style?: ViewStyle;
  children?: ReactNode;
}

const variantStyles = {
  warning: {
    bg: colors.warningBg,
    labelColor: colors.warningLabel,
    amountColor: colors.warningAmber,
    subtitleColor: colors.warningLabel,
  },
  success: {
    bg: colors.successBg,
    labelColor: colors.successLabel,
    amountColor: colors.successText,
    subtitleColor: colors.successLabel,
  },
  neutral: {
    bg: colors.screenBg,
    labelColor: colors.textSecondary,
    amountColor: colors.primaryNavy,
    subtitleColor: colors.textSecondary,
  },
};

export default function TintedInfoCard({
  variant,
  icon,
  label,
  amount,
  subtitle,
  style,
  children,
}: TintedInfoCardProps) {
  const styles_v = variantStyles[variant];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: styles_v.bg },
        style,
      ]}
    >
      <View style={styles.header}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <Text style={[styles.label, { color: styles_v.labelColor }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.amount, { color: styles_v.amountColor }]}>
        {amount}
      </Text>
      <Text style={[styles.subtitle, { color: styles_v.subtitleColor }]}>
        {subtitle}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderRadius: radius.medium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 20,
    fontWeight: typography.bold,
  },
  subtitle: {
    fontSize: typography.labelSmall,
    marginTop: 2,
  },
});
