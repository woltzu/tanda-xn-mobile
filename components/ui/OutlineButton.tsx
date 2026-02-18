import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, typography } from "../../theme/tokens";

type ButtonVariant = "teal" | "neutral";

interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export default function OutlineButton({
  label,
  onPress,
  icon,
  variant = "neutral",
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}: OutlineButtonProps) {
  const isTeal = variant === "teal";
  const borderColor = isTeal ? colors.accentTeal : colors.border;
  const textColor = isTeal ? colors.accentTeal : colors.primaryNavy;
  const iconColor = isTeal ? colors.accentTeal : colors.textSecondary;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { borderColor },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={iconColor}
              style={styles.icon}
            />
          )}
          <Text style={[styles.label, { color: textColor }, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.button,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
});
