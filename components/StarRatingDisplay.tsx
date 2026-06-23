// ═══════════════════════════════════════════════════════════════════════════
// components/StarRatingDisplay.tsx — Leave-review Bucket A.2
// ═══════════════════════════════════════════════════════════════════════════
//
// Read-only rating badge. Renders 5 stars filled to the rating value (whole-
// star only — half stars would need a custom mask; not needed for v1) plus
// an optional "★ 4.6 · 23 reviews" text format when showCount is true.
//
// Used by Bucket B to surface trip + organizer aggregate ratings on
// TripPublicPageScreen, MyTripsScreen cards, and the upcoming
// TripReviewsScreen. Sized down to 14px for inline use.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { typography } from "../theme/tokens";

const GOLD = "#F59E0B";
const MUTED = "#6B7280";

interface StarRatingDisplayProps {
  rating: number;                  // 0–5; rendered as filled stars
  count?: number;                  // optional review count
  size?: number;                   // default 14
  showCount?: boolean;             // when true, render text format
  textOnly?: boolean;              // hide stars, "★ 4.6 · 23" only
  style?: ViewStyle;
  color?: string;
}

const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
  rating,
  count,
  size = 14,
  showCount = false,
  textOnly = false,
  style,
  color = GOLD,
}) => {
  const { t } = useTranslation();
  const rounded = Math.round(rating);
  const formattedRating = rating.toFixed(1);

  if (textOnly) {
    return (
      <View style={[styles.row, style]}>
        <Ionicons name="star" size={size} color={color} />
        <Text style={[styles.text, { fontSize: size, color }]}>
          {formattedRating}
        </Text>
        {showCount && typeof count === "number" && count > 0 && (
          <Text style={[styles.count, { fontSize: size - 1 }]}>
            {" · "}
            {t("trip.reviews_rating", { count })}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.row, style]}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rounded ? "star" : "star-outline"}
          size={size}
          color={color}
        />
      ))}
      {showCount && typeof count === "number" && count > 0 && (
        <Text style={[styles.count, { fontSize: size, marginLeft: 6 }]}>
          {t("trip.reviews_rating", { count })}
        </Text>
      )}
    </View>
  );
};

export default StarRatingDisplay;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  text: {
    fontWeight: typography.bold,
  },
  count: {
    color: MUTED,
    fontWeight: typography.medium,
  },
});
