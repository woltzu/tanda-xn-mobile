import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FeedVisibility } from "../context/FeedContext";
import { colors, radius, typography, spacing } from "../theme/tokens";

type VisibilityPickerProps = {
  selected: FeedVisibility;
  onChange: (visibility: FeedVisibility) => void;
};

const VISIBILITY_OPTIONS: {
  value: FeedVisibility;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Visible to everyone",
    icon: "globe-outline",
  },
  {
    value: "community",
    label: "Community",
    description: "Only your communities",
    icon: "people-outline",
  },
  {
    value: "anonymous",
    label: "Anonymous",
    description: "Hidden name & amounts",
    icon: "eye-off-outline",
  },
];

export default function VisibilityPicker({ selected, onChange }: VisibilityPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Who can see this?</Text>
      <View style={styles.options}>
        {VISIBILITY_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onChange(option.value)}
            >
              <Ionicons
                name={option.icon}
                size={20}
                color={isSelected ? colors.accentTeal : colors.textSecondary}
              />
              <Text
                style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}
              >
                {option.label}
              </Text>
              <Text style={styles.optionDesc}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  options: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.small,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  optionSelected: {
    borderColor: colors.accentTeal,
    backgroundColor: colors.tealTintBg,
  },
  optionLabel: {
    fontSize: typography.labelSmall,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  optionLabelSelected: {
    color: colors.accentTeal,
  },
  optionDesc: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
});
