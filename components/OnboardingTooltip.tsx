import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TooltipData, useOnboarding } from "../context/OnboardingContext";
import { colors, radius, typography } from "../theme/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingTooltipProps {
  tooltip: TooltipData;
  targetPosition?: { x: number; y: number; width: number; height: number };
  onDismiss: () => void;
  onNext?: () => void;
  isLastTooltip?: boolean;
  currentIndex?: number;
  totalCount?: number;
}

export function OnboardingTooltip({
  tooltip,
  targetPosition,
  onDismiss,
  onNext,
  isLastTooltip = false,
  currentIndex = 0,
  totalCount = 1,
}: OnboardingTooltipProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for the spotlight
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const handleNext = () => {
    if (onNext) {
      handleDismiss();
      setTimeout(onNext, 250);
    }
  };

  // Calculate tooltip position based on target
  const getTooltipStyle = () => {
    if (!targetPosition) {
      return {
        top: "40%",
        left: 20,
        right: 20,
      };
    }

    const padding = 16;
    const tooltipHeight = 160;

    switch (tooltip.position) {
      case "bottom":
        return {
          top: targetPosition.y + targetPosition.height + 12,
          left: padding,
          right: padding,
        };
      case "top":
        return {
          bottom: SCREEN_WIDTH - targetPosition.y + 12,
          left: padding,
          right: padding,
        };
      default:
        return {
          top: targetPosition.y + targetPosition.height + 12,
          left: padding,
          right: padding,
        };
    }
  };

  // Calculate arrow position
  const getArrowStyle = () => {
    if (!targetPosition) return {};

    const arrowLeft = targetPosition.x + targetPosition.width / 2 - 10;
    return {
      left: Math.max(20, Math.min(arrowLeft, SCREEN_WIDTH - 40)),
    };
  };

  return (
    <Modal transparent visible animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Semi-transparent backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        {/* Spotlight effect on target */}
        {targetPosition && (
          <Animated.View
            style={[
              styles.spotlight,
              {
                top: targetPosition.y - 8,
                left: targetPosition.x - 8,
                width: targetPosition.width + 16,
                height: targetPosition.height + 16,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}

        {/* Tooltip bubble */}
        <Animated.View
          style={[
            styles.tooltipContainer,
            getTooltipStyle(),
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Arrow pointing to target */}
          {targetPosition && tooltip.position === "bottom" && (
            <View style={[styles.arrowUp, getArrowStyle()]} />
          )}
          {targetPosition && tooltip.position === "top" && (
            <View style={[styles.arrowDown, getArrowStyle()]} />
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Header with icon */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="bulb" size={20} color={colors.accentTeal} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>{tooltip.title}</Text>
                <Text style={styles.stepIndicator}>
                  {currentIndex + 1} of {totalCount}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Message */}
            <Text style={styles.message}>{tooltip.message}</Text>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleDismiss}
              >
                <Text style={styles.skipText}>
                  {isLastTooltip ? "Done" : "Skip all"}
                </Text>
              </TouchableOpacity>

              {!isLastTooltip && (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNext}
                >
                  <Text style={styles.nextText}>Next</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textWhite} />
                </TouchableOpacity>
              )}

              {isLastTooltip && (
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleDismiss}
                >
                  <Text style={styles.nextText}>Got it!</Text>
                  <Ionicons name="checkmark" size={16} color={colors.textWhite} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Progress dots */}
          <View style={styles.progressDots}>
            {Array.from({ length: totalCount }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.dotActive,
                  index < currentIndex && styles.dotCompleted,
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Wrapper component that uses the onboarding context
export function OnboardingTooltipManager({ screen }: { screen: string }) {
  const { activeTooltip, tooltips, dismissTooltip, showNextTooltip } = useOnboarding();

  // Filter tooltips for current screen
  const screenTooltips = tooltips.filter(t => t.screen === screen && !t.shown);
  const currentTooltip = screenTooltips.sort((a, b) => a.order - b.order)[0];

  if (!currentTooltip) return null;

  const currentIndex = screenTooltips.findIndex(t => t.id === currentTooltip.id);
  const isLast = currentIndex === screenTooltips.length - 1;

  return (
    <OnboardingTooltip
      tooltip={currentTooltip}
      onDismiss={() => dismissTooltip(currentTooltip.id)}
      onNext={showNextTooltip}
      isLastTooltip={isLast}
      currentIndex={currentIndex}
      totalCount={screenTooltips.length}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 35, 66, 0.75)",
  },
  spotlight: {
    position: "absolute",
    backgroundColor: "transparent",
    borderRadius: radius.medium,
    borderWidth: 3,
    borderColor: colors.accentTeal,
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  tooltipContainer: {
    position: "absolute",
    backgroundColor: colors.cardBg,
    borderRadius: radius.large,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  arrowUp: {
    position: "absolute",
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.cardBg,
  },
  arrowDown: {
    position: "absolute",
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.cardBg,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  stepIndicator: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentTeal,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    gap: 6,
  },
  nextText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },
  progressDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accentTeal,
    width: 20,
  },
  dotCompleted: {
    backgroundColor: colors.accentTeal,
  },
});
