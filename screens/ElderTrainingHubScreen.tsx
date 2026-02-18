import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useElder, TrainingCourse, ElderBadge } from "../context/ElderContext";

type RootStackParamList = {
  ElderTrainingHub: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = "courses" | "badges" | "progress";

export default function ElderTrainingHubScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    elderProfile,
    trainingCourses,
    badges,
    startCourse,
    completeModule,
    isLoading,
  } = useElder();

  const [activeTab, setActiveTab] = useState<TabType>("courses");
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const tabs: { key: TabType; label: string }[] = [
    { key: "courses", label: "Courses" },
    { key: "badges", label: "Badges" },
    { key: "progress", label: "Progress" },
  ];

  const requiredCourses = trainingCourses.filter((c) => c.category === "required");
  const electiveCourses = trainingCourses.filter((c) => c.category === "elective");
  const completedCredits = trainingCourses
    .filter((c) => c.completed)
    .reduce((sum, c) => sum + c.credits, 0);
  const earnedBadges = badges.filter((b) => b.earned);

  // Elder tier progression requirements
  const tierRequirements = {
    Junior: { credits: 0, cases: 0 },
    Senior: { credits: 100, cases: 20 },
    Grand: { credits: 250, cases: 50 },
  };

  const getProgressToNextTier = () => {
    if (!elderProfile) return null;

    if (elderProfile.tier === "Junior") {
      return {
        nextTier: "Senior",
        creditsNeeded: tierRequirements.Senior.credits,
        casesNeeded: tierRequirements.Senior.cases,
        creditsProgress: (elderProfile.trainingCredits / tierRequirements.Senior.credits) * 100,
        casesProgress: (elderProfile.totalCasesResolved / tierRequirements.Senior.cases) * 100,
      };
    } else if (elderProfile.tier === "Senior") {
      return {
        nextTier: "Grand",
        creditsNeeded: tierRequirements.Grand.credits,
        casesNeeded: tierRequirements.Grand.cases,
        creditsProgress: (elderProfile.trainingCredits / tierRequirements.Grand.credits) * 100,
        casesProgress: (elderProfile.totalCasesResolved / tierRequirements.Grand.cases) * 100,
      };
    }
    return null;
  };

  const handleStartCourse = (course: TrainingCourse) => {
    Alert.alert(
      "Start Course",
      `Begin "${course.title}"?\n\nDuration: ${course.duration}\nCredits: ${course.credits}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: () => startCourse(course.id),
        },
      ]
    );
  };

  const handleCompleteModule = (courseId: string, moduleId: string, moduleTitle: string) => {
    Alert.alert(
      "Complete Module",
      `Mark "${moduleTitle}" as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: () => completeModule(courseId, moduleId),
        },
      ]
    );
  };

  const renderCourseCard = (course: TrainingCourse) => {
    const isExpanded = expandedCourse === course.id;

    return (
      <View key={course.id} style={styles.courseCard}>
        <TouchableOpacity
          style={styles.courseHeader}
          onPress={() => setExpandedCourse(isExpanded ? null : course.id)}
        >
          <View style={styles.courseInfo}>
            <View style={styles.courseTitleRow}>
              <Text style={styles.courseTitle}>{course.title}</Text>
              {course.completed && (
                <Ionicons name="checkmark-circle" size={18} color="#00C6AE" />
              )}
            </View>
            <Text style={styles.courseDescription}>{course.description}</Text>
            <View style={styles.courseMeta}>
              <View style={styles.courseMetaItem}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.courseMetaText}>{course.duration}</Text>
              </View>
              <View style={styles.courseMetaItem}>
                <Ionicons name="star-outline" size={14} color="#00C6AE" />
                <Text style={[styles.courseMetaText, { color: "#00C6AE" }]}>
                  {course.credits} credits
                </Text>
              </View>
              <View
                style={[
                  styles.categoryBadge,
                  course.category === "required"
                    ? styles.requiredBadge
                    : styles.electiveBadge,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    course.category === "required"
                      ? styles.requiredText
                      : styles.electiveText,
                  ]}
                >
                  {course.category === "required" ? "Required" : "Elective"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.courseProgress}>
            <Text style={styles.progressPercent}>{course.progress}%</Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </View>
        </TouchableOpacity>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${course.progress}%` }]}
            />
          </View>
        </View>

        {/* Expanded module list */}
        {isExpanded && (
          <View style={styles.modulesContainer}>
            {course.modules.map((module, index) => (
              <TouchableOpacity
                key={module.id}
                style={styles.moduleItem}
                onPress={() =>
                  !module.completed &&
                  handleCompleteModule(course.id, module.id, module.title)
                }
                disabled={module.completed}
              >
                <View style={styles.moduleNumber}>
                  {module.completed ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.moduleNumberText}>{index + 1}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.moduleTitle,
                    module.completed && styles.completedModuleTitle,
                  ]}
                >
                  {module.title}
                </Text>
                {!module.completed && (
                  <Ionicons name="play-circle" size={20} color="#00C6AE" />
                )}
              </TouchableOpacity>
            ))}

            {course.progress === 0 && (
              <TouchableOpacity
                style={styles.startCourseButton}
                onPress={() => handleStartCourse(course)}
              >
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={styles.startCourseText}>Start Course</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderBadgeCard = (badge: ElderBadge) => {
    return (
      <View
        key={badge.id}
        style={[styles.badgeCard, !badge.earned && styles.unearnedBadge]}
      >
        <View style={styles.badgeIcon}>
          <Text style={styles.badgeEmoji}>{badge.icon}</Text>
        </View>
        <Text style={[styles.badgeName, !badge.earned && styles.unearnedText]}>
          {badge.name}
        </Text>
        <Text style={styles.badgeDescription}>{badge.description}</Text>
        {badge.earned ? (
          <View style={styles.earnedDate}>
            <Ionicons name="checkmark-circle" size={14} color="#00C6AE" />
            <Text style={styles.earnedDateText}>{badge.earnedDate}</Text>
          </View>
        ) : (
          <Text style={styles.badgeRequirements}>{badge.requirements}</Text>
        )}
      </View>
    );
  };

  const renderProgressTab = () => {
    const tierProgress = getProgressToNextTier();

    return (
      <View style={styles.progressTab}>
        {/* Current Status */}
        <View style={styles.currentStatusCard}>
          <View style={styles.tierDisplay}>
            <Text style={styles.tierIcon}>
              {elderProfile?.tier === "Grand"
                ? "🌳"
                : elderProfile?.tier === "Senior"
                ? "🌿"
                : "🌱"}
            </Text>
            <View>
              <Text style={styles.tierLabel}>Current Tier</Text>
              <Text style={styles.tierValue}>{elderProfile?.tier} Elder</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>
                {elderProfile?.trainingCredits || 0}
              </Text>
              <Text style={styles.statBoxLabel}>Training Credits</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>
                {elderProfile?.totalCasesResolved || 0}
              </Text>
              <Text style={styles.statBoxLabel}>Cases Resolved</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxValue}>{earnedBadges.length}</Text>
              <Text style={styles.statBoxLabel}>Badges Earned</Text>
            </View>
          </View>
        </View>

        {/* Progress to Next Tier */}
        {tierProgress && (
          <View style={styles.nextTierCard}>
            <Text style={styles.nextTierTitle}>
              Progress to {tierProgress.nextTier} Elder
            </Text>

            <View style={styles.tierRequirement}>
              <View style={styles.requirementHeader}>
                <View style={styles.requirementLabel}>
                  <Ionicons name="school" size={16} color="#3B82F6" />
                  <Text style={styles.requirementText}>Training Credits</Text>
                </View>
                <Text style={styles.requirementProgress}>
                  {elderProfile?.trainingCredits || 0}/{tierProgress.creditsNeeded}
                </Text>
              </View>
              <View style={styles.requirementBar}>
                <View
                  style={[
                    styles.requirementFill,
                    {
                      width: `${Math.min(100, tierProgress.creditsProgress)}%`,
                      backgroundColor: "#3B82F6",
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.tierRequirement}>
              <View style={styles.requirementHeader}>
                <View style={styles.requirementLabel}>
                  <Ionicons name="shield-checkmark" size={16} color="#00C6AE" />
                  <Text style={styles.requirementText}>Cases Resolved</Text>
                </View>
                <Text style={styles.requirementProgress}>
                  {elderProfile?.totalCasesResolved || 0}/{tierProgress.casesNeeded}
                </Text>
              </View>
              <View style={styles.requirementBar}>
                <View
                  style={[
                    styles.requirementFill,
                    {
                      width: `${Math.min(100, tierProgress.casesProgress)}%`,
                      backgroundColor: "#00C6AE",
                    },
                  ]}
                />
              </View>
            </View>

            {elderProfile?.tier === "Senior" && (
              <View style={styles.tierRequirement}>
                <View style={styles.requirementHeader}>
                  <View style={styles.requirementLabel}>
                    <Ionicons name="trending-up" size={16} color="#D97706" />
                    <Text style={styles.requirementText}>Success Rate</Text>
                  </View>
                  <Text style={styles.requirementProgress}>
                    {elderProfile.successRate}%/90%
                  </Text>
                </View>
                <View style={styles.requirementBar}>
                  <View
                    style={[
                      styles.requirementFill,
                      {
                        width: `${Math.min(100, (elderProfile.successRate / 90) * 100)}%`,
                        backgroundColor: "#D97706",
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Elder Tier Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>Elder Tier Benefits</Text>

          {[
            {
              tier: "Junior",
              icon: "🌱",
              benefits: ["10 pts vouch strength", "3 max concurrent cases"],
            },
            {
              tier: "Senior",
              icon: "🌿",
              benefits: [
                "25 pts vouch strength",
                "5 max concurrent cases",
                "Priority case assignment",
              ],
            },
            {
              tier: "Grand",
              icon: "🌳",
              benefits: [
                "50 pts vouch strength",
                "10 max concurrent cases",
                "Escalation authority",
                "Mentor new elders",
              ],
            },
          ].map((tierInfo) => (
            <View
              key={tierInfo.tier}
              style={[
                styles.tierBenefitRow,
                elderProfile?.tier === tierInfo.tier && styles.currentTierBenefit,
              ]}
            >
              <Text style={styles.tierBenefitIcon}>{tierInfo.icon}</Text>
              <View style={styles.tierBenefitContent}>
                <Text
                  style={[
                    styles.tierBenefitName,
                    elderProfile?.tier === tierInfo.tier && styles.currentTierText,
                  ]}
                >
                  {tierInfo.tier} Elder
                </Text>
                {tierInfo.benefits.map((benefit, index) => (
                  <Text key={index} style={styles.tierBenefitItem}>
                    • {benefit}
                  </Text>
                ))}
              </View>
              {elderProfile?.tier === tierInfo.tier && (
                <View style={styles.currentTierBadge}>
                  <Text style={styles.currentTierBadgeText}>Current</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "courses":
        return (
          <View style={styles.coursesTab}>
            {/* Credits Summary */}
            <View style={styles.creditsSummary}>
              <View style={styles.creditsInfo}>
                <Text style={styles.creditsValue}>{completedCredits}</Text>
                <Text style={styles.creditsLabel}>Credits Earned</Text>
              </View>
              <View style={styles.coursesCount}>
                <Text style={styles.coursesCountText}>
                  {trainingCourses.filter((c) => c.completed).length}/
                  {trainingCourses.length} courses completed
                </Text>
              </View>
            </View>

            {/* Required Courses */}
            <Text style={styles.sectionTitle}>Required Courses</Text>
            {requiredCourses.map(renderCourseCard)}

            {/* Elective Courses */}
            <Text style={styles.sectionTitle}>Elective Courses</Text>
            {electiveCourses.map(renderCourseCard)}
          </View>
        );

      case "badges":
        return (
          <View style={styles.badgesTab}>
            <View style={styles.badgesSummary}>
              <Text style={styles.badgesCount}>
                {earnedBadges.length}/{badges.length}
              </Text>
              <Text style={styles.badgesLabel}>Badges Earned</Text>
            </View>

            <View style={styles.badgesGrid}>
              {badges.map(renderBadgeCard)}
            </View>
          </View>
        );

      case "progress":
        return renderProgressTab();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Elder Training Hub</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  placeholder: {
    width: 32,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#00C6AE",
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
  },
  activeTabText: {
    color: "#00C6AE",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  // Courses Tab
  coursesTab: {
    padding: 20,
  },
  creditsSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  creditsInfo: {
    alignItems: "center",
  },
  creditsValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#00C6AE",
  },
  creditsLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  coursesCount: {
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  coursesCountText: {
    fontSize: 12,
    color: "#00C6AE",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 12,
    marginTop: 8,
  },
  courseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  courseHeader: {
    flexDirection: "row",
    padding: 16,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginRight: 8,
  },
  courseDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
  },
  courseMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  courseMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  courseMetaText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  requiredBadge: {
    backgroundColor: "#FEE2E2",
  },
  electiveBadge: {
    backgroundColor: "#DBEAFE",
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "600",
  },
  requiredText: {
    color: "#DC2626",
  },
  electiveText: {
    color: "#3B82F6",
  },
  courseProgress: {
    alignItems: "center",
    marginLeft: 12,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
    marginBottom: 4,
  },
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    backgroundColor: "#00C6AE",
    borderRadius: 3,
  },
  modulesContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 16,
  },
  moduleItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  moduleNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  moduleNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  moduleTitle: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a2e",
  },
  completedModuleTitle: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  startCourseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  startCourseText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  // Badges Tab
  badgesTab: {
    padding: 20,
  },
  badgesSummary: {
    alignItems: "center",
    marginBottom: 20,
  },
  badgesCount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#00C6AE",
  },
  badgesLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  badgeCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    margin: "1%",
    alignItems: "center",
  },
  unearnedBadge: {
    opacity: 0.6,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    textAlign: "center",
    marginBottom: 4,
  },
  unearnedText: {
    color: "#9CA3AF",
  },
  badgeDescription: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  earnedDate: {
    flexDirection: "row",
    alignItems: "center",
  },
  earnedDateText: {
    fontSize: 11,
    color: "#00C6AE",
    marginLeft: 4,
  },
  badgeRequirements: {
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
  },
  // Progress Tab
  progressTab: {
    padding: 20,
  },
  currentStatusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  tierDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  tierIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  tierLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  tierValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00C6AE",
  },
  statBoxLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
  nextTierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  nextTierTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 16,
  },
  tierRequirement: {
    marginBottom: 16,
  },
  requirementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  requirementLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  requirementText: {
    fontSize: 14,
    color: "#4B5563",
    marginLeft: 8,
  },
  requirementProgress: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  requirementBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
  },
  requirementFill: {
    height: 8,
    borderRadius: 4,
  },
  benefitsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 16,
  },
  tierBenefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  currentTierBenefit: {
    backgroundColor: "#F0FDFB",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderBottomColor: "transparent",
  },
  tierBenefitIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  tierBenefitContent: {
    flex: 1,
  },
  tierBenefitName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  currentTierText: {
    color: "#00C6AE",
  },
  tierBenefitItem: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  currentTierBadge: {
    backgroundColor: "#00C6AE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentTierBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  bottomPadding: {
    height: 40,
  },
});
