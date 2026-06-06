// =============================================================================
// Tooltip -- a navy bubble with a caret pointing at a target.
//
// Purely presentational. The parent positions the tooltip (absolute / flex /
// whatever) and tells it which side the caret should sit on via `position`.
// Anchoring to a measured target element is left to v2 -- the
// WalkthroughOverlay that wraps this just centers it inside a modal-style
// backdrop and picks the caret direction based on the step config.
//
// Props:
//   title         short bold headline
//   description   one-sentence body
//   position      which edge the caret sits on -- 'top' means caret is on
//                 the tooltip's TOP edge pointing UP at a target above it
//   onClose       optional close (X) handler
//   onNext        optional primary CTA (renders a "Next" button)
//   onSkip        optional secondary CTA (renders a "Skip" button)
//   stepLabel     optional "Step 2 of 5" hint shown above the title
//   style         pass-through container style override
// =============================================================================

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  title: string;
  description: string;
  position?: TooltipPosition;
  onClose?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  skipLabel?: string;
  stepLabel?: string;
  style?: ViewStyle;
}

export default function Tooltip({
  title,
  description,
  position = "top",
  onClose,
  onNext,
  onSkip,
  nextLabel = "Next",
  skipLabel = "Skip",
  stepLabel,
  style,
}: TooltipProps) {
  // The caret is rendered as a rotated square poking out of the bubble's
  // edge. Each position needs a different offset + corner for the caret
  // origin so the diamond lines up flush with the bubble edge.
  const caretStyle = (() => {
    switch (position) {
      case "top":    return styles.caretTop;
      case "bottom": return styles.caretBottom;
      case "left":   return styles.caretLeft;
      case "right":  return styles.caretRight;
    }
  })();

  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <View style={[styles.caret, caretStyle]} />

      <View style={styles.body}>
        {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}

        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {onClose ? (
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Dismiss tooltip"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.description}>{description}</Text>

        {(onNext || onSkip) ? (
          <View style={styles.actionsRow}>
            {onSkip ? (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={onSkip}
                accessibilityRole="button"
                accessibilityLabel={skipLabel}
              >
                <Text style={styles.skipText}>{skipLabel}</Text>
              </TouchableOpacity>
            ) : <View />}
            {onNext ? (
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={onNext}
                accessibilityRole="button"
                accessibilityLabel={nextLabel}
              >
                <Text style={styles.nextText}>{nextLabel}</Text>
                <Ionicons name="arrow-forward" size={14} color={NAVY} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const CARET = 12;

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    maxWidth: 340,
    // Shadow / elevation comes from the body wrapper so the caret can
    // poke past the rounded edge cleanly.
  },
  body: {
    backgroundColor: NAVY,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  caret: {
    position: "absolute",
    width: CARET,
    height: CARET,
    backgroundColor: NAVY,
    transform: [{ rotate: "45deg" }],
  },
  caretTop:    { top: -CARET / 2, alignSelf: "center" },
  caretBottom: { bottom: -CARET / 2, alignSelf: "center" },
  caretLeft:   { left: -CARET / 2, top: "50%", marginTop: -CARET / 2 },
  caretRight:  { right: -CARET / 2, top: "50%", marginTop: -CARET / 2 },

  stepLabel: {
    color: TEAL,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  description: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 19,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  skipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nextText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "700",
  },
});
