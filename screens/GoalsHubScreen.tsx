import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useSavings, GOAL_TYPES, GoalType, SavingsGoal } from "../context/SavingsContext";

type NavigationProp = StackNavigationProp<RootStackParamList>;

type FilterType = "all" | GoalType;

export default function GoalsHubScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    goals,
    getActiveGoals,
    getTotalSavings,
    getTotalInterestEarned,
    getTotalInterestUnlocked,
    isLoading,
  } = useSavings();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const activeGoals = getActiveGoals();
  const totalSavings = getTotalSavings();
  const totalInterestEarned = getTotalInterestEarned();
  const totalInterestUnlocked = getTotalInterestUnlocked();

  const filteredGoals = useMemo(() => {
    if (activeFilter === "all") return activeGoals;
    return activeGoals.filter(g => g.type === activeFilter);
  }, [activeGoals, activeFilter]);

  const getProgress = (goal: SavingsGoal) => {
    return Math.min((goal.currentBalance / goal.targetAmount) * 100, 100);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTypeConfig = (type: GoalType) => GOAL_TYPES[type];

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "flexible", label: "Flexible" },
    { key: "emergency", label: "Emergency" },
    { key: "locked", label: "Locked" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Goals</Text>
          <TouchableOpacity style={styles.helpButton}>
            <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryLabel}>TOTAL SAVINGS</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSavings)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.statValue}>{formatCurrency(totalInterestEarned)}</Text>
              <Text style={styles.statLabel}>Interest Earned</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.statValue, { color: "#10B981" }]}>
                {formatCurrency(totalInterestUnlocked)}
              </Text>
              <Text style={styles.statLabel}>Unlocked</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.statValue}>{activeGoals.length}</Text>
              <Text style={styles.statLabel}>Active Goals</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterTab,
                  activeFilter === filter.key && styles.filterTabActive,
                ]}
                onPress={() => setActiveFilter(filter.key)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    activeFilter === filter.key && styles.filterTabTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Goal Type Cards */}
        <View style={styles.typeCardsContainer}>
          <Text style={styles.sectionTitle}>Savings Types</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.values(GOAL_TYPES).map((type) => (
              <TouchableOpacity
                key={type.type}
                style={[styles.typeCard, { borderColor: type.color }]}
                onPress={() => navigation.navigate("CreateGoal", { goalType: type.type })}
              >
                <View style={[styles.typeIcon, { backgroundColor: type.bgColor }]}>
                  <Text style={styles.typeEmoji}>{type.emoji}</Text>
                </View>
                <Text style={styles.typeName}>{type.name}</Text>
                <Text style={styles.typeRate}>
                  {(type.interestRate * 100).toFixed(1)}% APY
                </Text>
                <View style={styles.typeFeatures}>
                  {type.features.slice(0, 2).map((feature, idx) => (
                    <Text key={idx} style={styles.typeFeature} numberOfLines={1}>
                      {feature}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Goals List */}
        <View style={styles.goalsSection}>
          <View style={styles.goalsSectionHeader}>
            <Text style={styles.sectionTitle}>Your Goals</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate("CreateGoal", {})}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {filteredGoals.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="flag-outline" size={48} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>No Goals Yet</Text>
              <Text style={styles.emptyText}>
                Create your first savings goal and start building wealth
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate("CreateGoal", {})}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Goal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredGoals.map((goal) => {
              const typeConfig = getTypeConfig(goal.type);
              const progress = getProgress(goal);

              return (
                <TouchableOpacity
                  key={goal.id}
                  style={styles.goalCard}
                  onPress={() => navigation.navigate("GoalDetails", { goalId: goal.id })}
                >
                  <View style={styles.goalHeader}>
                    <View style={[styles.goalIcon, { backgroundColor: typeConfig.bgColor }]}>
                      <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <View style={styles.goalTypeBadge}>
                        <View style={[styles.typeDot, { backgroundColor: typeConfig.color }]} />
                        <Text style={styles.goalTypeText}>{typeConfig.name}</Text>
                      </View>
                    </View>
                    <View style={styles.goalBalance}>
                      <Text style={styles.goalBalanceValue}>
                        {formatCurrency(goal.currentBalance)}
                      </Text>
                      <Text style={styles.goalBalanceLabel}>
                        of {formatCurrency(goal.targetAmount)}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${progress}%`, backgroundColor: typeConfig.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
                  </View>

                  {/* Goal Stats */}
                  <View style={styles.goalStats}>
                    <View style={styles.goalStat}>
                      <Ionicons name="trending-up" size={14} color="#10B981" />
                      <Text style={styles.goalStatText}>
                        +{formatCurrency(goal.interestEarned)} earned
                      </Text>
                    </View>
                    {goal.type === "locked" && goal.maturityDate && (
                      <View style={styles.goalStat}>
                        <Ionicons name="calendar-outline" size={14} color="#6366F1" />
                        <Text style={styles.goalStatText}>
                          Matures {new Date(goal.maturityDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </Text>
                      </View>
                    )}
                    {goal.autoSaveEnabled && (
                      <View style={styles.goalStat}>
                        <Ionicons name="sync" size={14} color="#F59E0B" />
                        <Text style={styles.goalStatText}>
                          Auto-save {goal.autoSavePercent}%
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Milestones */}
                  <View style={styles.milestonesRow}>
                    {goal.milestones.map((milestone, idx) => (
                      <View
                        key={milestone.id}
                        style={[
                          styles.milestoneCircle,
                          milestone.reachedAt && { backgroundColor: typeConfig.color },
                        ]}
                      >
                        {milestone.reachedAt ? (
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.milestoneText}>{milestone.targetPercent}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate("CreateGoal", {})}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="add-circle-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickActionText}>New Goal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              if (activeGoals.length > 0) {
                navigation.navigate("DepositToGoal", { goalId: activeGoals[0].id });
              }
            }}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="arrow-down-circle-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.quickActionText}>Deposit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              const flexibleGoal = activeGoals.find(g => g.type === "flexible");
              if (flexibleGoal) {
                navigation.navigate("WithdrawFromGoal", { goalId: flexibleGoal.id });
              }
            }}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="arrow-up-circle-outline" size={24} color="#EF4444" />
            </View>
            <Text style={styles.quickActionText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: 16,
  },
  summaryMain: {
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 12,
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryStat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterTabActive: {
    backgroundColor: "#0A2342",
    borderColor: "#0A2342",
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  typeCardsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  typeCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginRight: 10,
    borderWidth: 2,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  typeEmoji: {
    fontSize: 20,
  },
  typeName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  typeRate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981",
    marginBottom: 8,
  },
  typeFeatures: {
    gap: 2,
  },
  typeFeature: {
    fontSize: 10,
    color: "#6B7280",
  },
  goalsSection: {
    marginBottom: 20,
  },
  goalsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  goalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  goalEmoji: {
    fontSize: 22,
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  goalTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  goalTypeText: {
    fontSize: 11,
    color: "#6B7280",
  },
  goalBalance: {
    alignItems: "flex-end",
  },
  goalBalanceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  goalBalanceLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    width: 40,
    textAlign: "right",
  },
  goalStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  goalStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  goalStatText: {
    fontSize: 11,
    color: "#6B7280",
  },
  milestonesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  milestoneCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneText: {
    fontSize: 8,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quickAction: {
    alignItems: "center",
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A2342",
  },
  floatingHelp: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
