import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
  Share,
  TextInput,
  Switch,
  Platform,
} from "react-native";
import { showToast } from "../components/Toast";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useSavings, GOAL_TYPES, GoalTransaction } from "../context/SavingsContext";

// Menu item interface
interface GoalMenuItem {
  id: string;
  icon: string;
  label: string;
  description?: string;
  iconBgColor: string;
  iconColor: string;
  textColor?: string;
  onPress: () => void;
  disabled?: boolean;
  section?: string;
  sectionTitle?: string;
}

// Milestone alert interface
interface MilestoneAlert {
  percentage: number;
  amount: number;
  notify: boolean;
  celebrate: boolean;
}

type NavigationProp = StackNavigationProp<RootStackParamList>;
type GoalDetailsRouteProp = RouteProp<RootStackParamList, "GoalDetails">;

export default function GoalDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<GoalDetailsRouteProp>();
  const { goalId } = route.params;

  const {
    getGoalById,
    getGoalTransactions,
    getProjectedBalance,
    closeGoal,
    pauseGoal,
    resumeGoal,
  } = useSavings();

  const goal = getGoalById(goalId);
  const transactions = getGoalTransactions(goalId);

  // Menu and modal states
  const [showMenu, setShowMenu] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showExtendLockModal, setShowExtendLockModal] = useState(false);
  const [showTransactionHistoryModal, setShowTransactionHistoryModal] = useState(false);
  const [showGoalTermsModal, setShowGoalTermsModal] = useState(false);
  const [showAutoDepositModal, setShowAutoDepositModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Calculator state
  const [calcMonthlyDeposit, setCalcMonthlyDeposit] = useState("100");
  const [calcMonths, setCalcMonths] = useState("12");

  // Milestone alerts state
  const [milestoneAlerts, setMilestoneAlerts] = useState<MilestoneAlert[]>([
    { percentage: 25, amount: 0, notify: true, celebrate: true },
    { percentage: 50, amount: 0, notify: true, celebrate: true },
    { percentage: 75, amount: 0, notify: true, celebrate: true },
    { percentage: 100, amount: 0, notify: true, celebrate: true },
  ]);

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Goal not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = GOAL_TYPES[goal.type];
  const progress = Math.min((goal.currentBalance / goal.targetAmount) * 100, 100);
  const projectedBalance = getProjectedBalance(goalId, 12);

  const formatCurrency = (amount: number) => {
    return `$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilMaturity = () => {
    if (!goal.maturityDate) return null;
    const diff = new Date(goal.maturityDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysUntilMaturity = getDaysUntilMaturity();

  const getTransactionIcon = (type: GoalTransaction["type"]) => {
    switch (type) {
      case "deposit":
      case "auto_deposit":
        return { name: "arrow-down-circle", color: "#10B981" };
      case "withdrawal":
        return { name: "arrow-up-circle", color: "#EF4444" };
      case "interest_credit":
        return { name: "sparkles", color: "#F59E0B" };
      case "transfer_in":
        return { name: "swap-horizontal", color: "#3B82F6" };
      case "transfer_out":
        return { name: "swap-horizontal", color: "#8B5CF6" };
      default:
        return { name: "ellipse", color: "#6B7280" };
    }
  };

  const handleWithdraw = () => {
    if (goal.type === "locked" && daysUntilMaturity && daysUntilMaturity > 0) {
      Alert.alert(
        "Early Withdrawal",
        `This is a locked savings goal. Withdrawing early will incur a 10% penalty. Your funds mature in ${daysUntilMaturity} days.\n\nDo you want to proceed?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Proceed",
            style: "destructive",
            onPress: () => navigation.navigate("WithdrawFromGoal", { goalId }),
          },
        ]
      );
    } else {
      navigation.navigate("WithdrawFromGoal", { goalId });
    }
  };

  const handlePauseResume = async () => {
    try {
      if (goal.status === "paused") {
        await resumeGoal(goalId);
        showToast("Goal resumed!", "success");
      } else {
        await pauseGoal(goalId);
        showToast("Goal paused", "info");
      }
    } catch (err) {
      showToast("Action failed", "error");
    }
  };

  const handleCloseGoal = () => {
    setShowCloseConfirmModal(true);
  };

  const confirmCloseGoal = async () => {
    try {
      setIsClosing(true);
      await closeGoal(goalId);
      setShowCloseConfirmModal(false);
      showToast("Goal closed successfully", "success");
      // Small delay to let state update propagate before navigating back
      setTimeout(() => {
        navigation.goBack();
      }, 300);
    } catch (err) {
      console.error("Failed to close goal:", err);
      showToast("Failed to close goal", "error");
      setShowCloseConfirmModal(false);
    } finally {
      setIsClosing(false);
    }
  };

  // Share progress handler
  const handleShareProgress = async () => {
    setShowMenu(false);
    if (!goal) return;

    try {
      const message = `🎯 I'm ${progress.toFixed(0)}% of the way to my "${goal.name}" goal!\n\n` +
        `💰 Current: ${formatCurrency(goal.currentBalance)}\n` +
        `🎯 Target: ${formatCurrency(goal.targetAmount)}\n` +
        `📈 Earning ${(goal.interestRate * 100).toFixed(1)}% APY\n\n` +
        `Join me on TandaXn to start your savings journey!`;

      await Share.share({
        message,
        title: `My ${goal.name} Progress`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  // Early withdrawal handler
  const handleEarlyWithdrawal = () => {
    setShowMenu(false);
    if (!goal) return;

    const penalty = goal.currentBalance * 0.10; // 10% penalty
    const lostInterest = goal.interestEarned * 0.5; // Lose 50% of earned interest

    Alert.alert(
      "Early Withdrawal Request",
      `⚠️ This is a locked savings goal.\n\n` +
      `Withdrawing early will result in:\n` +
      `• 10% penalty: -${formatCurrency(penalty)}\n` +
      `• Lost interest: -${formatCurrency(lostInterest)}\n` +
      `• Net amount: ${formatCurrency(goal.currentBalance - penalty - lostInterest)}\n\n` +
      `A 48-hour cooling-off period will apply.\n\n` +
      `Do you want to proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Withdrawal",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Request Submitted",
              "Your early withdrawal request has been submitted. You will be able to complete the withdrawal after the 48-hour cooling-off period.",
              [{ text: "OK" }]
            );
          },
        },
      ]
    );
  };

  // Extend lock period handler
  const handleExtendLock = () => {
    setShowMenu(false);
    setShowExtendLockModal(true);
  };

  // Calculate projected interest
  const calculateProjectedInterest = () => {
    if (!goal) return { balance: 0, interest: 0 };

    const monthly = parseFloat(calcMonthlyDeposit) || 0;
    const months = parseInt(calcMonths) || 12;
    const monthlyRate = goal.interestRate / 12;

    let balance = goal.currentBalance;
    let totalInterest = 0;

    for (let i = 0; i < months; i++) {
      balance += monthly;
      const monthInterest = balance * monthlyRate;
      totalInterest += monthInterest;
      balance += monthInterest;
    }

    return { balance, interest: totalInterest };
  };

  // Export statements handler
  const handleExportStatements = () => {
    setShowMenu(false);
    Alert.alert(
      "Export Statements",
      "Choose your preferred format:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "CSV",
          onPress: () => Alert.alert("Success", "CSV statement will be sent to your email."),
        },
        {
          text: "PDF",
          onPress: () => Alert.alert("Success", "PDF statement will be sent to your email."),
        },
      ]
    );
  };

  // Get menu items based on goal state
  const getMenuItems = (): GoalMenuItem[] => {
    if (!goal) return [];

    const items: GoalMenuItem[] = [
      // General Actions
      {
        id: "edit",
        icon: "create-outline",
        label: "Edit Goal",
        description: "Name, target & preferences",
        iconBgColor: "#FEF3C7",
        iconColor: "#D97706",
        onPress: () => {
          setShowMenu(false);
          navigation.navigate("EditGoal", { goalId });
        },
        section: "general",
        sectionTitle: "GENERAL",
      },
      {
        id: "share",
        icon: "share-social-outline",
        label: "Share Progress",
        description: "Celebrate with friends & family",
        iconBgColor: "#EEF2FF",
        iconColor: "#6366F1",
        onPress: handleShareProgress,
        section: "general",
      },
      {
        id: "history",
        icon: "receipt-outline",
        label: "Transaction History",
        description: "View all deposits & withdrawals",
        iconBgColor: "#F0FDFB",
        iconColor: "#00C6AE",
        onPress: () => {
          setShowMenu(false);
          setShowTransactionHistoryModal(true);
        },
        section: "general",
      },
      {
        id: "auto-deposit",
        icon: "sync-outline",
        label: "Set Up Auto-Deposit",
        description: "Automate your savings",
        iconBgColor: "#D1FAE5",
        iconColor: "#10B981",
        onPress: () => {
          setShowMenu(false);
          setShowAutoDepositModal(true);
        },
        section: "general",
      },
      // Details & Tools
      {
        id: "terms",
        icon: "document-text-outline",
        label: "Goal Details & Terms",
        description: "Interest rates & conditions",
        iconBgColor: "#F0FDFB",
        iconColor: "#00C6AE",
        onPress: () => {
          setShowMenu(false);
          setShowGoalTermsModal(true);
        },
        section: "details",
        sectionTitle: "TOOLS & INFO",
      },
      {
        id: "calculator",
        icon: "calculator-outline",
        label: "Interest Calculator",
        description: "Project your future balance",
        iconBgColor: "#EEF2FF",
        iconColor: "#6366F1",
        onPress: () => {
          setShowMenu(false);
          setShowCalculatorModal(true);
        },
        section: "details",
      },
    ];

    // Locked savings specific items
    if (goal.type === "locked" && daysUntilMaturity && daysUntilMaturity > 0) {
      items.push({
        id: "early-withdrawal",
        icon: "warning-outline",
        label: "Early Withdrawal Request",
        description: "Unlock funds with penalty",
        iconBgColor: "#FEF3C7",
        iconColor: "#F59E0B",
        onPress: handleEarlyWithdrawal,
        section: "locked",
        sectionTitle: "LOCKED SAVINGS",
      });
      items.push({
        id: "extend-lock",
        icon: "time-outline",
        label: "Extend Lock Period",
        description: "Get a higher interest rate",
        iconBgColor: "#EEF2FF",
        iconColor: "#6366F1",
        onPress: handleExtendLock,
        section: "locked",
      });
    }

    // Settings items
    items.push({
      id: "milestones",
      icon: "flag-outline",
      label: "Set Milestone Alerts",
      description: "Get notified on progress",
      iconBgColor: "#FCE7F3",
      iconColor: "#EC4899",
      onPress: () => {
        setShowMenu(false);
        setShowMilestoneModal(true);
      },
      section: "settings",
      sectionTitle: "NOTIFICATIONS",
    });

    // Advanced options
    items.push({
      id: "export",
      icon: "download-outline",
      label: "Export Statements",
      description: "PDF, CSV & reports",
      iconBgColor: "#F0FDFB",
      iconColor: "#00C6AE",
      onPress: handleExportStatements,
      section: "advanced",
      sectionTitle: "MORE OPTIONS",
    });
    items.push({
      id: "help",
      icon: "help-circle-outline",
      label: "Help & Support",
      description: "FAQs, tutorials & contact",
      iconBgColor: "#FEF3C7",
      iconColor: "#D97706",
      onPress: () => {
        setShowMenu(false);
        navigation.navigate("HelpCenter");
      },
      section: "advanced",
    });
    items.push({
      id: "close",
      icon: "close-circle-outline",
      label: "Close Goal",
      description: "End this savings goal",
      iconBgColor: "#FEE2E2",
      iconColor: "#DC2626",
      textColor: "#DC2626",
      onPress: () => {
        setShowMenu(false);
        handleCloseGoal();
      },
      section: "danger",
      sectionTitle: "DANGER ZONE",
    });

    return items;
  };

  const menuItems = getMenuItems();

  // Group menu items by section
  const groupedMenuItems = useMemo(() => {
    const groups: { [key: string]: GoalMenuItem[] } = {};
    menuItems.forEach(item => {
      const section = item.section || "other";
      if (!groups[section]) groups[section] = [];
      groups[section].push(item);
    });
    return groups;
  }, [menuItems]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[typeConfig.color, typeConfig.color + "CC"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Goal Info */}
        <View style={styles.goalInfo}>
          <View style={styles.goalIconLarge}>
            <Text style={styles.goalEmojiLarge}>{goal.emoji}</Text>
          </View>
          <Text style={styles.goalName}>{goal.name}</Text>
          <View style={styles.goalTypeBadge}>
            <Text style={styles.goalTypeText}>{typeConfig.name}</Text>
            <Text style={styles.goalRateText}>{(goal.interestRate * 100).toFixed(1)}% APY</Text>
          </View>
        </View>

        {/* Balance */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(goal.currentBalance)}</Text>
          <Text style={styles.targetText}>of {formatCurrency(goal.targetAmount)} target</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressPercent}>{progress.toFixed(0)}% complete</Text>
            <Text style={styles.progressRemaining}>
              {formatCurrency(goal.targetAmount - goal.currentBalance)} to go
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={20} color="#10B981" />
            <Text style={styles.statValue}>{formatCurrency(goal.interestEarned)}</Text>
            <Text style={styles.statLabel}>Interest Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={20} color="#3B82F6" />
            <Text style={styles.statValue}>{formatCurrency(goal.interestUnlocked)}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
            <Text style={styles.statValue}>{formatCurrency(projectedBalance)}</Text>
            <Text style={styles.statLabel}>In 12 Months</Text>
          </View>
        </View>

        {/* Maturity Info for Locked Goals */}
        {goal.type === "locked" && goal.maturityDate && (
          <View style={styles.maturityCard}>
            <View style={styles.maturityIcon}>
              <Ionicons name="lock-closed" size={24} color="#6366F1" />
            </View>
            <View style={styles.maturityInfo}>
              <Text style={styles.maturityTitle}>Locked Until</Text>
              <Text style={styles.maturityDate}>{formatDate(goal.maturityDate)}</Text>
              {daysUntilMaturity && daysUntilMaturity > 0 && (
                <Text style={styles.maturityDays}>{daysUntilMaturity} days remaining</Text>
              )}
            </View>
            {daysUntilMaturity && daysUntilMaturity <= 0 && (
              <View style={styles.maturedBadge}>
                <Text style={styles.maturedText}>Matured!</Text>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.depositButton]}
            onPress={() => navigation.navigate("DepositToGoal", { goalId })}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.withdrawButton]}
            onPress={handleWithdraw}
          >
            <Ionicons name="arrow-up-circle-outline" size={20} color="#EF4444" />
            <Text style={[styles.actionButtonText, { color: "#EF4444" }]}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Milestones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          <View style={styles.milestonesContainer}>
            {goal.milestones.map((milestone, idx) => (
              <View key={milestone.id} style={styles.milestoneItem}>
                <View
                  style={[
                    styles.milestoneCircle,
                    milestone.reachedAt && { backgroundColor: typeConfig.color },
                  ]}
                >
                  {milestone.reachedAt ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.milestonePercent}>{milestone.targetPercent}%</Text>
                  )}
                </View>
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneLabel}>
                    {formatCurrency((goal.targetAmount * milestone.targetPercent) / 100)}
                  </Text>
                  {milestone.reachedAt && (
                    <Text style={styles.milestoneDate}>
                      Reached {formatDate(milestone.reachedAt)}
                    </Text>
                  )}
                </View>
                {idx < goal.milestones.length - 1 && (
                  <View
                    style={[
                      styles.milestoneLine,
                      milestone.reachedAt && { backgroundColor: typeConfig.color },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Auto-Save Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-Save</Text>
          <TouchableOpacity
            style={styles.autoSaveCard}
            onPress={() => navigation.navigate("EditGoal", { goalId })}
          >
            <View style={[styles.autoSaveIcon, { backgroundColor: goal.autoSaveEnabled ? "#FEF3C7" : "#F3F4F6" }]}>
              <Ionicons name="sync" size={20} color={goal.autoSaveEnabled ? "#F59E0B" : "#9CA3AF"} />
            </View>
            <View style={styles.autoSaveInfo}>
              {goal.autoSaveEnabled ? (
                <>
                  <Text style={styles.autoSaveTitle}>
                    Saving {goal.autoSavePercent}% of payouts
                    {goal.autoReplenish && " (Priority)"}
                  </Text>
                  <Text style={styles.autoSaveSubtitle}>
                    Automatically from circle payouts
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.autoSaveTitle}>Auto-Save is off</Text>
                  <Text style={styles.autoSaveSubtitle}>
                    Tap to enable automatic saving from payouts
                  </Text>
                </>
              )}
            </View>
            <View style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit</Text>
              <Ionicons name="chevron-forward" size={16} color="#00C6AE" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {transactions.length > 5 && (
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Ionicons name="receipt-outline" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.slice(0, 5).map((txn) => {
              const icon = getTransactionIcon(txn.type);
              return (
                <View key={txn.id} style={styles.transactionItem}>
                  <View style={[styles.transactionIcon, { backgroundColor: icon.color + "20" }]}>
                    <Ionicons name={icon.name as any} size={18} color={icon.color} />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>{txn.description}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(txn.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: txn.amount >= 0 ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {txn.amount >= 0 ? "+" : "-"}{formatCurrency(txn.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Goal Management */}
        <View style={styles.managementSection}>
          <TouchableOpacity style={styles.managementButton} onPress={handlePauseResume}>
            <Ionicons
              name={goal.status === "paused" ? "play" : "pause"}
              size={18}
              color="#6B7280"
            />
            <Text style={styles.managementButtonText}>
              {goal.status === "paused" ? "Resume Goal" : "Pause Goal"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.managementButton} onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#6B7280" />
            <Text style={styles.managementButtonText}>More Options</Text>
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

      {/* 3-Dots Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Goal Options</Text>
                <View style={styles.menuGoalBadge}>
                  <Text style={styles.menuGoalEmoji}>{goal?.emoji}</Text>
                  <Text style={styles.menuGoalName}>{goal?.name}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setShowMenu(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
              {/* General Actions */}
              {groupedMenuItems.general && (
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>GENERAL</Text>
                  {groupedMenuItems.general.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
                      onPress={item.onPress}
                      disabled={item.disabled}
                    >
                      <View style={[styles.menuItemIcon, { backgroundColor: item.iconBgColor }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.menuItemContent}>
                        <Text style={[styles.menuItemText, item.textColor && { color: item.textColor }]}>
                          {item.label}
                        </Text>
                        {item.description && (
                          <Text style={styles.menuItemDesc}>{item.description}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Details & Tools */}
              {groupedMenuItems.details && (
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>TOOLS & INFO</Text>
                  {groupedMenuItems.details.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuItem}
                      onPress={item.onPress}
                    >
                      <View style={[styles.menuItemIcon, { backgroundColor: item.iconBgColor }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>{item.label}</Text>
                        {item.description && (
                          <Text style={styles.menuItemDesc}>{item.description}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Locked Savings Options */}
              {groupedMenuItems.locked && (
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>LOCKED SAVINGS</Text>
                  {groupedMenuItems.locked.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuItem}
                      onPress={item.onPress}
                    >
                      <View style={[styles.menuItemIcon, { backgroundColor: item.iconBgColor }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.menuItemContent}>
                        <Text style={[styles.menuItemText, item.textColor && { color: item.textColor }]}>
                          {item.label}
                        </Text>
                        {item.description && (
                          <Text style={styles.menuItemDesc}>{item.description}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Settings */}
              {groupedMenuItems.settings && (
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>NOTIFICATIONS</Text>
                  {groupedMenuItems.settings.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuItem}
                      onPress={item.onPress}
                    >
                      <View style={[styles.menuItemIcon, { backgroundColor: item.iconBgColor }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>{item.label}</Text>
                        {item.description && (
                          <Text style={styles.menuItemDesc}>{item.description}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Advanced Options */}
              {groupedMenuItems.advanced && (
                <View style={styles.menuSection}>
                  <Text style={styles.menuSectionTitle}>MORE OPTIONS</Text>
                  {groupedMenuItems.advanced.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuItem}
                      onPress={item.onPress}
                    >
                      <View style={[styles.menuItemIcon, { backgroundColor: item.iconBgColor }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.menuItemContent}>
                        <Text style={styles.menuItemText}>{item.label}</Text>
                        {item.description && (
                          <Text style={styles.menuItemDesc}>{item.description}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Danger Zone */}
              {groupedMenuItems.danger && (
                <View style={styles.menuSection}>
                  <Text style={[styles.menuSectionTitle, { color: "#DC2626" }]}>DANGER ZONE</Text>
                  {groupedMenuItems.danger.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuItem}
                      onPress={item.onPress}
                    >
                      <View style={[styles.menuItemIcon, { backgroundColor: item.iconBgColor }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.menuItemContent}>
                        <Text style={[styles.menuItemText, { color: item.textColor || "#DC2626" }]}>
                          {item.label}
                        </Text>
                        {item.description && (
                          <Text style={styles.menuItemDesc}>{item.description}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Interest Calculator Modal */}
      <Modal
        visible={showCalculatorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalculatorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Interest Calculator</Text>
              <TouchableOpacity onPress={() => setShowCalculatorModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.calculatorLabel}>Monthly Deposit</Text>
              <View style={styles.calculatorInput}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.calculatorTextInput}
                  value={calcMonthlyDeposit}
                  onChangeText={setCalcMonthlyDeposit}
                  keyboardType="numeric"
                  placeholder="100"
                />
              </View>

              <Text style={styles.calculatorLabel}>Time Period (Months)</Text>
              <View style={styles.calculatorInput}>
                <TextInput
                  style={styles.calculatorTextInput}
                  value={calcMonths}
                  onChangeText={setCalcMonths}
                  keyboardType="numeric"
                  placeholder="12"
                />
              </View>

              <View style={styles.calculatorResults}>
                <View style={styles.calculatorResultRow}>
                  <Text style={styles.calculatorResultLabel}>Current Balance</Text>
                  <Text style={styles.calculatorResultValue}>
                    {formatCurrency(goal?.currentBalance || 0)}
                  </Text>
                </View>
                <View style={styles.calculatorResultRow}>
                  <Text style={styles.calculatorResultLabel}>APY Rate</Text>
                  <Text style={styles.calculatorResultValue}>
                    {((goal?.interestRate || 0) * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.calculatorDivider} />
                <View style={styles.calculatorResultRow}>
                  <Text style={styles.calculatorResultLabel}>Projected Interest</Text>
                  <Text style={[styles.calculatorResultValue, { color: "#10B981" }]}>
                    +{formatCurrency(calculateProjectedInterest().interest)}
                  </Text>
                </View>
                <View style={styles.calculatorResultRow}>
                  <Text style={[styles.calculatorResultLabel, { fontWeight: "600" }]}>
                    Projected Balance
                  </Text>
                  <Text style={[styles.calculatorResultValue, { fontWeight: "700", fontSize: 18 }]}>
                    {formatCurrency(calculateProjectedInterest().balance)}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowCalculatorModal(false)}
            >
              <Text style={styles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Milestone Alerts Modal */}
      <Modal
        visible={showMilestoneModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMilestoneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Milestone Alerts</Text>
              <TouchableOpacity onPress={() => setShowMilestoneModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.milestoneDescription}>
                Get notified when you reach these savings milestones
              </Text>

              {milestoneAlerts.map((alert, index) => (
                <View key={index} style={styles.milestoneAlertItem}>
                  <View style={styles.milestoneAlertHeader}>
                    <View style={styles.milestoneAlertIcon}>
                      <Ionicons name="flag" size={16} color={typeConfig.color} />
                    </View>
                    <Text style={styles.milestoneAlertTitle}>
                      {alert.percentage}% - {formatCurrency((goal?.targetAmount || 0) * alert.percentage / 100)}
                    </Text>
                  </View>
                  <View style={styles.milestoneAlertOptions}>
                    <View style={styles.milestoneAlertOption}>
                      <Text style={styles.milestoneAlertLabel}>Notify me</Text>
                      <Switch
                        value={alert.notify}
                        onValueChange={(value) => {
                          const updated = [...milestoneAlerts];
                          updated[index].notify = value;
                          setMilestoneAlerts(updated);
                        }}
                        trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    <View style={styles.milestoneAlertOption}>
                      <Text style={styles.milestoneAlertLabel}>Celebrate</Text>
                      <Switch
                        value={alert.celebrate}
                        onValueChange={(value) => {
                          const updated = [...milestoneAlerts];
                          updated[index].celebrate = value;
                          setMilestoneAlerts(updated);
                        }}
                        trackColor={{ false: "#E5E7EB", true: "#F59E0B" }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowMilestoneModal(false);
                Alert.alert("Saved", "Your milestone alerts have been updated.");
              }}
            >
              <Text style={styles.modalButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Extend Lock Period Modal */}
      <Modal
        visible={showExtendLockModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExtendLockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Extend Lock Period</Text>
              <TouchableOpacity onPress={() => setShowExtendLockModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.extendDescription}>
                Extend your lock period for a higher APY rate
              </Text>

              <View style={styles.currentRateCard}>
                <Ionicons name="lock-closed" size={20} color="#6366F1" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.currentRateLabel}>Current Rate</Text>
                  <Text style={styles.currentRateValue}>
                    {((goal?.interestRate || 0) * 100).toFixed(1)}% APY
                  </Text>
                </View>
                <Text style={styles.currentMaturity}>
                  Until {goal?.maturityDate ? formatDate(goal.maturityDate) : "N/A"}
                </Text>
              </View>

              <Text style={styles.extendOptionsTitle}>Choose a new lock period:</Text>

              <TouchableOpacity style={styles.extendOption}>
                <View style={styles.extendOptionInfo}>
                  <Text style={styles.extendOptionRate}>7.5% APY</Text>
                  <Text style={styles.extendOptionDuration}>+12 months</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.extendOption}>
                <View style={styles.extendOptionInfo}>
                  <Text style={styles.extendOptionRate}>8.0% APY</Text>
                  <Text style={styles.extendOptionDuration}>+24 months</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.extendOption, styles.extendOptionBest]}>
                <View style={styles.extendOptionInfo}>
                  <View style={styles.extendOptionBestBadge}>
                    <Text style={styles.extendOptionBestText}>BEST VALUE</Text>
                  </View>
                  <Text style={styles.extendOptionRate}>8.5% APY</Text>
                  <Text style={styles.extendOptionDuration}>+36 months</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#6B7280" }]}
              onPress={() => setShowExtendLockModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        visible={showTransactionHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransactionHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction History</Text>
              <TouchableOpacity onPress={() => setShowTransactionHistoryModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {transactions.length === 0 ? (
                <View style={styles.emptyTransactions}>
                  <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No transactions yet</Text>
                </View>
              ) : (
                transactions.map((txn) => {
                  const icon = getTransactionIcon(txn.type);
                  return (
                    <View key={txn.id} style={styles.historyItem}>
                      <View style={[styles.transactionIcon, { backgroundColor: icon.color + "20" }]}>
                        <Ionicons name={icon.name as any} size={18} color={icon.color} />
                      </View>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyDesc}>{txn.description}</Text>
                        <Text style={styles.historyDate}>
                          {new Date(txn.createdAt).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.historyAmount,
                          { color: txn.amount >= 0 ? "#10B981" : "#EF4444" },
                        ]}
                      >
                        {txn.amount >= 0 ? "+" : "-"}{formatCurrency(txn.amount)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowTransactionHistoryModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Goal Terms Modal */}
      <Modal
        visible={showGoalTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalTermsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Goal Details & Terms</Text>
              <TouchableOpacity onPress={() => setShowGoalTermsModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>Goal Information</Text>
                <View style={styles.termsRow}>
                  <Text style={styles.termsLabel}>Goal Name</Text>
                  <Text style={styles.termsValue}>{goal?.name}</Text>
                </View>
                <View style={styles.termsRow}>
                  <Text style={styles.termsLabel}>Goal Type</Text>
                  <Text style={styles.termsValue}>{typeConfig.name}</Text>
                </View>
                <View style={styles.termsRow}>
                  <Text style={styles.termsLabel}>Created</Text>
                  <Text style={styles.termsValue}>
                    {goal?.createdAt ? formatDate(goal.createdAt) : "N/A"}
                  </Text>
                </View>
              </View>

              <View style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>Interest Terms</Text>
                <View style={styles.termsRow}>
                  <Text style={styles.termsLabel}>Annual Rate (APY)</Text>
                  <Text style={styles.termsValue}>
                    {((goal?.interestRate || 0) * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.termsRow}>
                  <Text style={styles.termsLabel}>Interest Compounding</Text>
                  <Text style={styles.termsValue}>Monthly</Text>
                </View>
                <View style={styles.termsRow}>
                  <Text style={styles.termsLabel}>Interest Earned</Text>
                  <Text style={[styles.termsValue, { color: "#10B981" }]}>
                    {formatCurrency(goal?.interestEarned || 0)}
                  </Text>
                </View>
              </View>

              {goal?.type === "locked" && (
                <View style={styles.termsSection}>
                  <Text style={styles.termsSectionTitle}>Lock Terms</Text>
                  <View style={styles.termsRow}>
                    <Text style={styles.termsLabel}>Lock Period</Text>
                    <Text style={styles.termsValue}>
                      {goal.maturityDate ? `Until ${formatDate(goal.maturityDate)}` : "None"}
                    </Text>
                  </View>
                  <View style={styles.termsRow}>
                    <Text style={styles.termsLabel}>Early Withdrawal Penalty</Text>
                    <Text style={[styles.termsValue, { color: "#EF4444" }]}>10%</Text>
                  </View>
                  <View style={styles.termsRow}>
                    <Text style={styles.termsLabel}>Cooling Off Period</Text>
                    <Text style={styles.termsValue}>48 hours</Text>
                  </View>
                </View>
              )}

              <View style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>Withdrawal Rules</Text>
                <Text style={styles.termsText}>
                  • Minimum withdrawal: $10.00{"\n"}
                  • Processing time: 1-3 business days{"\n"}
                  • Funds transferred to linked wallet{"\n"}
                  {goal?.type === "locked"
                    ? "• Early withdrawal subject to penalty"
                    : "• No penalty for flexible withdrawals"}
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowGoalTermsModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Auto-Deposit Setup Modal */}
      <Modal
        visible={showAutoDepositModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAutoDepositModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Up Auto-Deposit</Text>
              <TouchableOpacity onPress={() => setShowAutoDepositModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.autoDepositOption}>
                <View style={styles.autoDepositIcon}>
                  <Ionicons name="repeat" size={24} color="#00C6AE" />
                </View>
                <View style={styles.autoDepositInfo}>
                  <Text style={styles.autoDepositTitle}>Weekly Deposit</Text>
                  <Text style={styles.autoDepositDesc}>
                    Automatically deposit a fixed amount every week
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>

              <View style={styles.autoDepositOption}>
                <View style={[styles.autoDepositIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="calendar" size={24} color="#F59E0B" />
                </View>
                <View style={styles.autoDepositInfo}>
                  <Text style={styles.autoDepositTitle}>Monthly Deposit</Text>
                  <Text style={styles.autoDepositDesc}>
                    Deposit on a specific day each month
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>

              <View style={styles.autoDepositOption}>
                <View style={[styles.autoDepositIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="cash" size={24} color="#6366F1" />
                </View>
                <View style={styles.autoDepositInfo}>
                  <Text style={styles.autoDepositTitle}>From Circle Payouts</Text>
                  <Text style={styles.autoDepositDesc}>
                    Auto-save a percentage of your circle payouts
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>

              <View style={styles.autoDepositOption}>
                <View style={[styles.autoDepositIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="trending-up" size={24} color="#EF4444" />
                </View>
                <View style={styles.autoDepositInfo}>
                  <Text style={styles.autoDepositTitle}>Round-Up Savings</Text>
                  <Text style={styles.autoDepositDesc}>
                    Round up transactions and save the difference
                  </Text>
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: "#6B7280" }]}
              onPress={() => setShowAutoDepositModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Close Goal Confirmation Modal */}
      <Modal
        visible={showCloseConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isClosing && setShowCloseConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 360 }]}>
            <View style={{ alignItems: "center", padding: 24, paddingBottom: 0 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
                marginBottom: 16,
              }}>
                <Ionicons name="warning" size={28} color="#DC2626" />
              </View>
              <Text style={[styles.modalTitle, { textAlign: "center" }]}>Close Goal</Text>
              <Text style={{
                fontSize: 14, color: "#6B7280", textAlign: "center",
                marginTop: 8, lineHeight: 20,
              }}>
                Are you sure you want to close "{goal?.name}"? Any remaining balance will need to be withdrawn first.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12, padding: 20 }}>
              <TouchableOpacity
                style={[styles.modalButton, {
                  flex: 1, backgroundColor: "#F3F4F6", marginHorizontal: 0, marginBottom: 0,
                }]}
                onPress={() => setShowCloseConfirmModal(false)}
                disabled={isClosing}
              >
                <Text style={[styles.modalButtonText, { color: "#6B7280" }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {
                  flex: 1, backgroundColor: "#DC2626", marginHorizontal: 0, marginBottom: 0,
                  opacity: isClosing ? 0.6 : 1,
                }]}
                onPress={confirmCloseGoal}
                disabled={isClosing}
              >
                <Text style={styles.modalButtonText}>
                  {isClosing ? "Closing..." : "Close Goal"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  goalInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  goalIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  goalEmojiLarge: {
    fontSize: 30,
  },
  goalName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  goalTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  goalTypeText: {
    fontSize: 13,
    color: "#FFFFFF",
  },
  goalRateText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  balanceSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  targetText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  progressSection: {},
  progressBar: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressPercent: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
  },
  progressRemaining: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },
  maturityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  maturityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  maturityInfo: {
    flex: 1,
  },
  maturityTitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  maturityDate: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  maturityDays: {
    fontSize: 12,
    color: "#6366F1",
    marginTop: 2,
  },
  maturedBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  maturedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  depositButton: {
    backgroundColor: "#00C6AE",
  },
  withdrawButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: "#00C6AE",
    fontWeight: "600",
  },
  milestonesContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  milestoneItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  milestoneCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  milestonePercent: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  milestoneDate: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  milestoneLine: {
    position: "absolute",
    left: 15,
    top: 36,
    width: 2,
    height: 24,
    backgroundColor: "#E5E7EB",
  },
  autoSaveCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  autoSaveIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  autoSaveInfo: {
    flex: 1,
  },
  autoSaveTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  autoSaveSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  emptyTransactions: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  transactionDate: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  managementSection: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 20,
  },
  managementButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
  },
  managementButtonText: {
    fontSize: 13,
    color: "#6B7280",
  },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 34,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  menuGoalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  menuGoalEmoji: {
    fontSize: 14,
  },
  menuGoalName: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  menuCloseBtn: {
    padding: 4,
  },
  menuScroll: {
    paddingHorizontal: 12,
  },
  menuSection: {
    paddingVertical: 8,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: "#FFFFFF",
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  menuItemDesc: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  modalContent: {
    padding: 20,
  },
  modalButton: {
    backgroundColor: "#00C6AE",
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Calculator styles
  calculatorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
    marginTop: 16,
  },
  calculatorInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    color: "#6B7280",
    marginRight: 4,
  },
  calculatorTextInput: {
    flex: 1,
    fontSize: 18,
    color: "#0A2342",
    paddingVertical: 14,
  },
  calculatorResults: {
    backgroundColor: "#F5F7FA",
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  calculatorResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calculatorResultLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  calculatorResultValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  calculatorDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  // Milestone styles
  milestoneDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },
  milestoneAlertItem: {
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  milestoneAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  milestoneAlertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  milestoneAlertTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  milestoneAlertOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  milestoneAlertOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  milestoneAlertLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  // Extend lock styles
  extendDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },
  currentRateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  currentRateLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  currentRateValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  currentMaturity: {
    fontSize: 12,
    color: "#6366F1",
  },
  extendOptionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  extendOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  extendOptionBest: {
    borderColor: "#10B981",
    backgroundColor: "#ECFDF5",
  },
  extendOptionInfo: {},
  extendOptionBestBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  extendOptionBestText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  extendOptionRate: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  extendOptionDuration: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  // History modal styles
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  historyDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  // Terms modal styles
  termsSection: {
    marginBottom: 24,
  },
  termsSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  termsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  termsLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  termsValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  termsText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
  // Auto-deposit modal styles
  autoDepositOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  autoDepositIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  autoDepositInfo: {
    flex: 1,
  },
  autoDepositTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  autoDepositDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  comingSoonBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#D97706",
  },
  floatingHelp: {
    position: "absolute",
    bottom: 90,
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
