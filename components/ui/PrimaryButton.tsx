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

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export default function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textWhite} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={colors.textWhite}
              style={styles.icon}
            />
          )}
          <Text style={[styles.label, textStyle]}>{label}</Text>
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
    backgroundColor: colors.accentTeal,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.button,
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: {
    backgroundColor: colors.textSecondary,
    shadowOpacity: 0,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
});
