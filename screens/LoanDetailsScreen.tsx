import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useLoan, LoanStatus, RepaymentScheduleItem } from "../context/AdvanceContext";
import { useCurrency } from "../context/CurrencyContext";

type LoanDetailsNavigationProp = StackNavigationProp<RootStackParamList>;
type LoanDetailsRouteProp = RouteProp<RootStackParamList, "LoanDetails">;

const STATUS_CONFIG: Record<LoanStatus, { color: string; bgColor: string; icon: string; label: string }> = {
  draft: { color: "#6B7280", bgColor: "#F3F4F6", icon: "document-text-outline", label: "Draft" },
  submitted: { color: "#3B82F6", bgColor: "#DBEAFE", icon: "paper-plane-outline", label: "Submitted" },
  under_review: { color: "#F59E0B", bgColor: "#FEF3C7", icon: "eye-outline", label: "Under Review" },
  approved: { color: "#10B981", bgColor: "#D1FAE5", icon: "checkmark-circle-outline", label: "Approved" },
  disbursed: { color: "#8B5CF6", bgColor: "#EDE9FE", icon: "cash-outline", label: "Disbursed" },
  active: { color: "#3B82F6", bgColor: "#DBEAFE", icon: "refresh-outline", label: "Active" },
  completed: { color: "#10B981", bgColor: "#D1FAE5", icon: "checkmark-done-circle", label: "Completed" },
  cancelled: { color: "#6B7280", bgColor: "#F3F4F6", icon: "close-circle-outline", label: "Cancelled" },
  rejected: { color: "#DC2626", bgColor: "#FEE2E2", icon: "alert-circle-outline", label: "Rejected" },
  defaulted: { color: "#DC2626", bgColor: "#FEE2E2", icon: "warning-outline", label: "Defaulted" },
  in_recovery: { color: "#DC2626", bgColor: "#FEE2E2", icon: "hand-left-outline", label: "In Recovery" },
};

export default function LoanDetailsScreen() {
  const navigation = useNavigation<LoanDetailsNavigationProp>();
  const route = useRoute<LoanDetailsRouteProp>();
  const { loanId } = route.params;

  const { getLoanById, makePayment, cancelLoan, getProductById } = useLoan();
  const { formatCurrency } = useCurrency();

  const loan = getLoanById(loanId);
  const product = loan ? getProductById(loan.productId) : null;

  if (!loan) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Loan Not Found</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyStateText}>This loan could not be found</Text>
        </View>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[loan.status];
  const progressPercent = loan.totalToRepay > 0
    ? (loan.amountPaid / loan.totalToRepay) * 100
    : 0;

  const handleMakePayment = () => {
    if (!["disbursed", "active"].includes(loan.status)) return;

    Alert.prompt(
      "Make Payment",
      `Enter amount to pay (max: $${loan.amountRemaining.toLocaleString()})`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay",
          onPress: async (value) => {
            const amount = parseFloat(value || "0");
            if (amount > 0 && amount <= loan.amountRemaining) {
              try {
                await makePayment(loan.id, amount, "wallet");
                Alert.alert("Success", "Payment processed successfully!");
              } catch {
                Alert.alert("Error", "Failed to process payment");
              }
            } else {
              Alert.alert("Invalid Amount", "Please enter a valid amount");
            }
          },
        },
      ],
      "plain-text",
      "",
      "decimal-pad"
    );
  };

  const handleCancelLoan = () => {
    if (!["draft", "submitted", "under_review"].includes(loan.status)) return;

    Alert.alert(
      "Cancel Application",
      "Are you sure you want to cancel this loan application?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelLoan(loan.id);
              navigation.goBack();
            } catch {
              Alert.alert("Error", "Failed to cancel loan application");
            }
          },
        },
      ]
    );
  };

  const renderPaymentScheduleItem = (item: RepaymentScheduleItem, index: number) => {
    const dueDate = new Date(item.dueDate);
    const isPast = dueDate < new Date();
    const isNext = item.status === "pending" && !isPast;

    return (
      <View
        key={item.id}
        style={[
          styles.scheduleItem,
          item.status === "paid" && styles.scheduleItemPaid,
          item.status === "missed" && styles.scheduleItemMissed,
          isNext && styles.scheduleItemNext,
        ]}
      >
        <View style={styles.scheduleItemLeft}>
          <View
            style={[
              styles.scheduleItemIcon,
              item.status === "paid" && styles.scheduleItemIconPaid,
              item.status === "missed" && styles.scheduleItemIconMissed,
              item.status === "scheduled" && styles.scheduleItemIconScheduled,
            ]}
          >
            {item.status === "paid" ? (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            ) : item.status === "missed" ? (
              <Ionicons name="alert" size={14} color="#FFFFFF" />
            ) : (
              <Text style={styles.scheduleItemNumber}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.scheduleItemInfo}>
            <Text style={styles.scheduleItemDate}>
              {dueDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            {item.source && (
              <Text style={styles.scheduleItemSource}>
                via {item.source === "payout_withholding" ? "Payout Withholding" : "Wallet"}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.scheduleItemRight}>
          <Text
            style={[
              styles.scheduleItemAmount,
              item.status === "paid" && styles.scheduleItemAmountPaid,
            ]}
          >
            ${formatCurrency(item.amount, "USD")}
          </Text>
          {item.status === "paid" && (
            <Text style={styles.paidLabel}>Paid</Text>
          )}
          {item.status === "scheduled" && (
            <Text style={styles.scheduledLabel}>Scheduled</Text>
          )}
          {isNext && (
            <Text style={styles.nextLabel}>Next</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Loan Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Status & Amount */}
          <View style={styles.loanSummary}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
              <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <Text style={styles.loanAmount}>
              ${formatCurrency(loan.requestedAmount, "USD")}
            </Text>
            <Text style={styles.loanProduct}>{product?.name || "Loan"}</Text>
          </View>

          {/* Progress Bar (for active loans) */}
          {["disbursed", "active", "completed"].includes(loan.status) && (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>
                  ${formatCurrency(loan.amountPaid, "USD")} paid
                </Text>
                <Text style={styles.progressLabel}>
                  ${formatCurrency(loan.amountRemaining, "USD")} remaining
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]}
                />
              </View>
              <Text style={styles.progressPercent}>
                {progressPercent.toFixed(0)}% complete
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.content}>
          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Monthly Payment</Text>
              <Text style={styles.statValue}>
                ${loan.nextPaymentAmount ? formatCurrency(loan.nextPaymentAmount, "USD") : "0"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Term</Text>
              <Text style={styles.statValue}>{loan.termMonths} months</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Fee Rate</Text>
              <Text style={styles.statValue}>{loan.feeRate}%</Text>
            </View>
          </View>

          {/* Next Payment */}
          {loan.nextPaymentDate && ["disbursed", "active"].includes(loan.status) && (
            <View style={styles.nextPaymentCard}>
              <View style={styles.nextPaymentLeft}>
                <View style={styles.nextPaymentIcon}>
                  <Ionicons name="calendar" size={24} color="#F59E0B" />
                </View>
                <View style={styles.nextPaymentInfo}>
                  <Text style={styles.nextPaymentLabel}>Next Payment Due</Text>
                  <Text style={styles.nextPaymentDate}>
                    {new Date(loan.nextPaymentDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.payNowButton} onPress={handleMakePayment}>
                <Text style={styles.payNowText}>Pay Now</Text>
                <Ionicons name="arrow-forward" size={16} color="#00C6AE" />
              </TouchableOpacity>
            </View>
          )}

          {/* Loan Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Loan Details</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Principal</Text>
              <Text style={styles.detailValue}>
                ${formatCurrency(loan.requestedAmount, "USD")}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fee Amount</Text>
              <Text style={styles.detailValue}>
                ${formatCurrency(loan.feeAmount, "USD")}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabelBold}>Total to Repay</Text>
              <Text style={styles.detailValueBold}>
                ${formatCurrency(loan.totalToRepay, "USD")}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Purpose</Text>
              <Text style={styles.detailValue}>{loan.category}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Repayment Method</Text>
              <Text style={styles.detailValue}>
                {loan.repaymentMethod === "hybrid"
                  ? "Hybrid"
                  : loan.repaymentMethod === "payout_withholding"
                  ? "Payout Withholding"
                  : "Wallet"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Applied On</Text>
              <Text style={styles.detailValue}>
                {new Date(loan.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>

            {loan.approvedAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approved On</Text>
                <Text style={styles.detailValue}>
                  {new Date(loan.approvedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            )}

            {loan.automaticApproval && (
              <View style={styles.autoBadge}>
                <Ionicons name="flash" size={12} color="#10B981" />
                <Text style={styles.autoBadgeText}>Auto-Approved</Text>
              </View>
            )}
          </View>

          {/* Repayment Schedule */}
          {loan.repaymentSchedule.length > 0 && (
            <View style={styles.scheduleCard}>
              <Text style={styles.cardTitle}>Payment Schedule</Text>
              <View style={styles.scheduleList}>
                {loan.repaymentSchedule.map((item, index) =>
                  renderPaymentScheduleItem(item, index)
                )}
              </View>
            </View>
          )}

          {/* Risk Info */}
          <View style={styles.riskCard}>
            <View style={styles.riskHeader}>
              <Ionicons name="shield-checkmark" size={20} color="#00C6AE" />
              <Text style={styles.riskTitle}>At Time of Application</Text>
            </View>
            <View style={styles.riskRow}>
              <Text style={styles.riskLabel}>XnScore</Text>
              <Text style={styles.riskValue}>{loan.xnScoreAtRequest}</Text>
            </View>
            <View style={styles.riskRow}>
              <Text style={styles.riskLabel}>Tier</Text>
              <Text style={styles.riskValue}>
                {loan.tierAtRequest.charAt(0).toUpperCase() + loan.tierAtRequest.slice(1)}
              </Text>
            </View>
            <View style={styles.riskRow}>
              <Text style={styles.riskLabel}>Monthly Contribution</Text>
              <Text style={styles.riskValue}>${loan.smcAtRequest}</Text>
            </View>
          </View>

          {/* Actions */}
          {["draft", "submitted", "under_review"].includes(loan.status) && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelLoan}>
              <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
              <Text style={styles.cancelButtonText}>Cancel Application</Text>
            </TouchableOpacity>
          )}

          {loan.status === "rejected" && loan.rejectionReason && (
            <View style={styles.rejectionCard}>
              <Ionicons name="alert-circle" size={24} color="#DC2626" />
              <View style={styles.rejectionContent}>
                <Text style={styles.rejectionTitle}>Application Rejected</Text>
                <Text style={styles.rejectionReason}>{loan.rejectionReason}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action for Active Loans */}
      {["disbursed", "active"].includes(loan.status) && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.makePaymentButton} onPress={handleMakePayment}>
            <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
            <Text style={styles.makePaymentText}>Make a Payment</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  loanSummary: {
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loanAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loanProduct: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 20,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  progressBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: "#00C6AE",
    textAlign: "center",
    marginTop: 8,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
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
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  nextPaymentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  nextPaymentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nextPaymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  nextPaymentInfo: {},
  nextPaymentLabel: {
    fontSize: 11,
    color: "#92400E",
  },
  nextPaymentDate: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A2342",
  },
  payNowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  payNowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  detailLabelBold: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  detailValueBold: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  autoBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10B981",
  },
  scheduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  scheduleList: {
    gap: 8,
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
  },
  scheduleItemPaid: {
    backgroundColor: "#D1FAE5",
  },
  scheduleItemMissed: {
    backgroundColor: "#FEE2E2",
  },
  scheduleItemNext: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  scheduleItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scheduleItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleItemIconPaid: {
    backgroundColor: "#10B981",
  },
  scheduleItemIconMissed: {
    backgroundColor: "#DC2626",
  },
  scheduleItemIconScheduled: {
    backgroundColor: "#3B82F6",
  },
  scheduleItemNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  scheduleItemInfo: {},
  scheduleItemDate: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  scheduleItemSource: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  scheduleItemRight: {
    alignItems: "flex-end",
  },
  scheduleItemAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  scheduleItemAmountPaid: {
    color: "#10B981",
    textDecorationLine: "line-through",
  },
  paidLabel: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "600",
    marginTop: 2,
  },
  scheduledLabel: {
    fontSize: 10,
    color: "#3B82F6",
    fontWeight: "600",
    marginTop: 2,
  },
  nextLabel: {
    fontSize: 10,
    color: "#F59E0B",
    fontWeight: "600",
    marginTop: 2,
  },
  riskCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.2)",
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  riskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  riskLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  riskValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
  },
  rejectionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    padding: 16,
  },
  rejectionContent: {
    flex: 1,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 4,
  },
  rejectionReason: {
    fontSize: 13,
    color: "#991B1B",
    lineHeight: 18,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  makePaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  makePaymentText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
