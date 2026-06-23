// ═══════════════════════════════════════════════════════════════════════════
// components/StarRatingInput.tsx — Leave-review Bucket A.2
// ═══════════════════════════════════════════════════════════════════════════
//
// Reusable tappable 1–5 star input. Pattern extracted from
// GoalProviderPaymentScreen.ReviewSheet so LeaveReviewScreen + any future
// rating surface (vouching, mentor sessions) can drop it in instead of
// re-implementing the same row of TouchableOpacity stars.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const GOLD = "#F59E0B";

interface StarRatingInputProps {
  value: number;                       // 0–5; 0 means unset
  onChange: (rating: number) => void;
  size?: number;                       // default 32
  disabled?: boolean;
  color?: string;                      // default gold
  style?: ViewStyle;
}

const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  size = 32,
  disabled = false,
  color = GOLD,
  style,
}) => {
  return (
    <View style={[styles.row, style]}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => !disabled && onChange(n)}
          disabled={disabled}
          hitSlop={{ top: 8, right: 4, bottom: 8, left: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
          accessibilityState={{ selected: n <= value }}
        >
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={size}
            color={disabled ? "#D1D5DB" : color}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default StarRatingInput;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
});
