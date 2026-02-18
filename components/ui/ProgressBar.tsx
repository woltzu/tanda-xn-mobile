import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../../theme/tokens";

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  fillColor?: string;
  trackColor?: string;
  style?: ViewStyle;
}

export default function ProgressBar({
  progress,
  height = 4,
  fillColor = colors.accentTeal,
  trackColor = colors.border,
  style,
}: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress}%`,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
});
