import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "../../theme/tokens";

interface StatTileProps {
  icon?: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  style?: ViewStyle;
}

/**
 * StatTile - For breakdown row items
 * MUST use neutral colors only (gray icons, navy numbers, gray labels)
 * NO teal/amber here per design hierarchy rules
 */
export default function StatTile({
  icon,
  value,
  label,
  style,
}: StatTileProps) {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={colors.textSecondary}
          style={styles.icon}
        />
      )}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
  },
  icon: {
    marginBottom: 4,
  },
  value: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  label: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
