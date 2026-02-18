import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography } from "../../theme/tokens";

interface SectionHeaderProps {
  title: string;
  badgeText?: string;
  badgeColor?: string;
  actionText?: string;
  onActionPress?: () => void;
}

export default function SectionHeader({
  title,
  badgeText,
  badgeColor = colors.primaryNavy,
  actionText,
  onActionPress,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {badgeText && (
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
      </View>
      {actionText && onActionPress && (
        <TouchableOpacity
          onPress={onActionPress}
          accessibilityLabel={`${actionText} ${title}`}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },
  actionText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
});
