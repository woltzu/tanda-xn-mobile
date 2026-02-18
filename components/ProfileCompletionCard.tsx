import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useOnboarding, ProfileField } from "../context/OnboardingContext";
import { RootStackParamList } from "../App";
import { colors, radius, typography } from "../theme/tokens";

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface ProfileCompletionCardProps {
  compact?: boolean;
  showDismiss?: boolean;
}

export function ProfileCompletionCard({
  compact = false,
  showDismiss = false,
}: ProfileCompletionCardProps) {
  const navigation = useNavigation<NavigationProp>();
  const { profileCompletion, profileFields, incompleteFields } = useOnboarding();

  // Don't show if profile is complete
  if (profileCompletion >= 100) {
    return null;
  }

  const nextIncompleteField = incompleteFields[0];
  const requiredIncomplete = incompleteFields.filter(f => f.required);

  const handleContinue = () => {
    if (nextIncompleteField) {
      navigation.navigate(nextIncompleteField.screen as any);
    }
  };

  const getFieldIcon = (fieldId: string): string => {
    const icons: Record<string, string> = {
      full_name: "person",
      email: "mail",
      phone: "call",
      profile_photo: "camera",
      country_origin: "globe",
      country_residence: "location",
      language: "language",
      notification_prefs: "notifications",
    };
    return icons[fieldId] || "ellipse";
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <View style={styles.compactLeft}>
          <View style={styles.compactProgressRing}>
            <Text style={styles.compactProgressText}>{profileCompletion}%</Text>
          </View>
          <View>
            <Text style={styles.compactTitle}>Complete your profile</Text>
            <Text style={styles.compactSubtitle}>
              {requiredIncomplete.length > 0
                ? `${requiredIncomplete.length} required fields left`
                : `${incompleteFields.length} optional fields left`}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.accentTeal} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="person-circle" size={22} color={colors.accentTeal} />
          </View>
          <View>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>Unlock all features</Text>
          </View>
        </View>
        {showDismiss && (
          <TouchableOpacity style={styles.dismissBtn}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[styles.progressFill, { width: `${profileCompletion}%` }]}
          />
        </View>
        <Text style={styles.progressText}>{profileCompletion}% complete</Text>
      </View>

      {/* Field Checklist */}
      <View style={styles.checklist}>
        {profileFields.slice(0, 5).map((field) => (
          <View key={field.id} style={styles.checklistItem}>
            <View
              style={[
                styles.checkIcon,
                field.completed && styles.checkIconCompleted,
              ]}
            >
              {field.completed ? (
                <Ionicons name="checkmark" size={12} color={colors.textWhite} />
              ) : (
                <Ionicons
                  name={getFieldIcon(field.id) as any}
                  size={10}
                  color={colors.textSecondary}
                />
              )}
            </View>
            <Text
              style={[
                styles.checklistText,
                field.completed && styles.checklistTextCompleted,
              ]}
            >
              {field.label}
            </Text>
            {field.required && !field.completed && (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>Required</Text>
              </View>
            )}
          </View>
        ))}

        {profileFields.length > 5 && (
          <Text style={styles.moreText}>
            +{profileFields.length - 5} more fields
          </Text>
        )}
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={styles.continueButton}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.continueText}>
          {nextIncompleteField
            ? `Add ${nextIncompleteField.label}`
            : "Complete Profile"}
        </Text>
        <Ionicons name="arrow-forward" size={16} color={colors.textWhite} />
      </TouchableOpacity>

      {/* Benefits */}
      <View style={styles.benefits}>
        <View style={styles.benefit}>
          <Ionicons name="shield-checkmark" size={14} color={colors.accentTeal} />
          <Text style={styles.benefitText}>Build trust with others</Text>
        </View>
        <View style={styles.benefit}>
          <Ionicons name="star" size={14} color={colors.accentTeal} />
          <Text style={styles.benefitText}>Boost your Xn Score</Text>
        </View>
      </View>
    </View>
  );
}

// Onboarding Progress Steps Component
export function OnboardingProgressSteps() {
  const navigation = useNavigation<NavigationProp>();
  const {
    onboardingSteps,
    completedStepsCount,
    currentStepIndex,
    completeStep,
  } = useOnboarding();

  // Don't show if all steps completed
  if (completedStepsCount === onboardingSteps.length) {
    return null;
  }

  const currentStep = onboardingSteps[currentStepIndex];
  const progress = (completedStepsCount / onboardingSteps.length) * 100;

  const handleStepPress = (step: typeof currentStep) => {
    navigation.navigate(step.action as any);
  };

  return (
    <View style={styles.stepsContainer}>
      <View style={styles.stepsHeader}>
        <Text style={styles.stepsTitle}>Getting Started</Text>
        <Text style={styles.stepsProgress}>
          {completedStepsCount} of {onboardingSteps.length} complete
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.stepsProgressBar}>
        <View style={[styles.stepsProgressFill, { width: `${progress}%` }]} />
      </View>

      {/* Current step highlight */}
      {currentStep && (
        <TouchableOpacity
          style={styles.currentStepCard}
          onPress={() => handleStepPress(currentStep)}
          activeOpacity={0.8}
        >
          <View style={styles.currentStepIcon}>
            <Ionicons
              name={currentStep.icon as any}
              size={24}
              color={colors.accentTeal}
            />
          </View>
          <View style={styles.currentStepInfo}>
            <Text style={styles.currentStepLabel}>NEXT STEP</Text>
            <Text style={styles.currentStepTitle}>{currentStep.title}</Text>
            <Text style={styles.currentStepDesc}>{currentStep.description}</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={28} color={colors.accentTeal} />
        </TouchableOpacity>
      )}

      {/* Steps list */}
      <View style={styles.stepsList}>
        {onboardingSteps.map((step, index) => (
          <TouchableOpacity
            key={step.id}
            style={[
              styles.stepItem,
              step.completed && styles.stepItemCompleted,
              index === currentStepIndex && styles.stepItemCurrent,
            ]}
            onPress={() => !step.completed && handleStepPress(step)}
            disabled={step.completed}
          >
            <View
              style={[
                styles.stepNumber,
                step.completed && styles.stepNumberCompleted,
                index === currentStepIndex && styles.stepNumberCurrent,
              ]}
            >
              {step.completed ? (
                <Ionicons name="checkmark" size={12} color={colors.textWhite} />
              ) : (
                <Text
                  style={[
                    styles.stepNumberText,
                    index === currentStepIndex && styles.stepNumberTextCurrent,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepText,
                step.completed && styles.stepTextCompleted,
              ]}
            >
              {step.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  subtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accentTeal,
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
    minWidth: 70,
    textAlign: "right",
  },
  checklist: {
    marginBottom: 14,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkIconCompleted: {
    backgroundColor: colors.accentTeal,
  },
  checklistText: {
    flex: 1,
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  checklistTextCompleted: {
    color: colors.primaryNavy,
    textDecorationLine: "line-through",
  },
  requiredBadge: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    color: colors.warningLabel,
    fontWeight: typography.semibold,
  },
  moreText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    paddingVertical: 12,
    borderRadius: radius.button,
    gap: 8,
    marginBottom: 12,
  },
  continueText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },
  benefits: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  benefitText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },

  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardBg,
    borderRadius: radius.medium,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compactProgressRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.accentTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  compactProgressText: {
    fontSize: 11,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  compactTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  compactSubtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },

  // Steps styles
  stepsContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 8,
  },
  stepsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stepsTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  stepsProgress: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  stepsProgressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  stepsProgressFill: {
    height: "100%",
    backgroundColor: colors.accentTeal,
    borderRadius: 2,
  },
  currentStepCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    borderRadius: radius.medium,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  currentStepIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  currentStepInfo: {
    flex: 1,
  },
  currentStepLabel: {
    fontSize: 10,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
    letterSpacing: 0.5,
  },
  currentStepTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    marginTop: 2,
  },
  currentStepDesc: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.screenBg,
    borderRadius: radius.pill,
  },
  stepItemCompleted: {
    opacity: 0.6,
  },
  stepItemCurrent: {
    backgroundColor: colors.tealTintBg,
  },
  stepNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberCompleted: {
    backgroundColor: colors.accentTeal,
  },
  stepNumberCurrent: {
    backgroundColor: colors.accentTeal,
  },
  stepNumberText: {
    fontSize: 10,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  stepNumberTextCurrent: {
    color: colors.textWhite,
  },
  stepText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  stepTextCompleted: {
    textDecorationLine: "line-through",
  },
});
