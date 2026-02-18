import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useAdvance, AdvanceRequest, AdvanceStatus } from "../context/AdvanceContext";
import { useCurrency } from "../context/CurrencyContext";

type AdvanceDetailsRouteProp = RouteProp<RootStackParamList, "AdvanceDetails">;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<AdvanceStatus, { color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  pending: { color: "#F59E0B", bgColor: "#FEF3C7", icon: "time-outline", label: "Pending Review" },
  approved: { color: "#10B981", bgColor: "#D1FAE5", icon: "checkmark-circle-outline", label: "Approved" },
  disbursed: { color: "#3B82F6", bgColor: "#DBEAFE", icon: "cash-outline", label: "Disbursed" },
  repaying: { color: "#8B5CF6", bgColor: "#EDE9FE", icon: "repeat-outline", label: "Repaying" },
  completed: { color: "#10B981", bgColor: "#D1FAE5", icon: "checkmark-done-circle-outline", label: "Completed" },
  rejected: { color: "#EF4444", bgColor: "#FEE2E2", icon: "close-circle-outline", label: "Rejected" },
  defaulted: { color: "#DC2626", bgColor: "#FEE2E2", icon: "warning-outline", label: "Defaulted" },
};

export default function AdvanceDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AdvanceDetailsRouteProp>();
  const { advanceId } = route.params;
  const { getAdvanceById, approveAdvance, disburseAdvance } = useAdvance();
  const { formatAmount } = useCurrency();

  const [advance, setAdvance] = useState<AdvanceRequest | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const adv = getAdvanceById(advanceId);
    setAdvance(adv);
  }, [advanceId, getAdvanceById]);

  // Auto-approve for demo purposes (in production this would be a backend process)
  useEffect(() => {
    const autoApprove = async () => {
      if (advance?.status === "pending") {
        // Simulate approval delay
        setTimeout(async () => {
          await approveAdvance(advanceId);
          setAdvance(getAdvanceById(advanceId));
        }, 2000);
      }
    };
    autoApprove();
  }, [advance?.status]);

  const handleDisburse = async () => {
    if (!advance || advance.status !== "approved") return;

    setIsProcessing(true);
    try {
      await disburseAdvance(advanceId);
      setAdvance(getAdvanceById(advanceId));
      Alert.alert(
        "Funds Disbursed!",
        `${formatAmount(advance.approvedAmount || advance.requestedAmount, advance.currency)} has been added to your wallet.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to disburse funds. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMakeRepayment = () => {
    navigation.navigate("AdvanceRepayment", { advanceId });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!advance) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C6AE" />
          <Text style={styles.loadingText}>Loading advance details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[advance.status];
  const repaymentProgress = advance.totalRepayment > 0
    ? (advance.repaidAmount / advance.totalRepayment) * 100
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advance Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Ionicons name={statusConfig.icon} size={24} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          <Text style={styles.amountLabel}>
            {advance.status === "pending" ? "Requested Amount" : "Advance Amount"}
          </Text>
          <Text style={styles.amountValue}>
            {formatAmount(advance.approvedAmount || advance.requestedAmount, advance.currency)}
          </Text>

          <Text style={styles.circleLabel}>From: {advance.circleName}</Text>
        </View>

        {/* Progress Section (for repaying status) */}
        {["disbursed", "repaying", "completed"].includes(advance.status) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repayment Progress</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {formatAmount(advance.repaidAmount, advance.currency)} of {formatAmount(advance.totalRepayment, advance.currency)}
                </Text>
                <Text style={styles.progressPercent}>{repaymentProgress.toFixed(0)}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${repaymentProgress}%` }]} />
              </View>
              <View style={styles.progressDetails}>
                <View style={styles.progressItem}>
                  <Text style={styles.progressItemLabel}>Remaining</Text>
                  <Text style={styles.progressItemValue}>
                    {formatAmount(advance.remainingAmount, advance.currency)}
                  </Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={styles.progressItemLabel}>Due Date</Text>
                  <Text style={styles.progressItemValue}>{formatDate(advance.dueDate)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advance Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Advance ID</Text>
              <Text style={styles.detailValue}>{advance.id.slice(0, 16)}...</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Request Date</Text>
              <Text style={styles.detailValue}>{formatDateTime(advance.requestDate)}</Text>
            </View>
            {advance.approvalDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approval Date</Text>
                <Text style={styles.detailValue}>{formatDateTime(advance.approvalDate)}</Text>
              </View>
            )}
            {advance.disbursementDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Disbursement Date</Text>
                <Text style={styles.detailValue}>{formatDateTime(advance.disbursementDate)}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date</Text>
              <Text style={styles.detailValue}>{formatDate(advance.dueDate)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fee ({advance.feePercent}%)</Text>
              <Text style={styles.detailValue}>{formatAmount(advance.fee, advance.currency)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Repayment</Text>
              <Text style={[styles.detailValue, styles.totalValue]}>
                {formatAmount(advance.totalRepayment, advance.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Reason Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Advance</Text>
          <View style={styles.reasonCard}>
            <Ionicons name="document-text-outline" size={20} color="#6B7280" />
            <Text style={styles.reasonText}>{advance.reason}</Text>
          </View>
        </View>

        {/* Repayment Method Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Repayment Method</Text>
          <View style={styles.repaymentMethodCard}>
            <Ionicons
              name={
                advance.repaymentMethod === "payout_offset"
                  ? "swap-horizontal"
                  : advance.repaymentMethod === "auto_deduct"
                  ? "sync"
                  : "hand-left"
              }
              size={24}
              color="#00C6AE"
            />
            <View style={styles.repaymentMethodInfo}>
              <Text style={styles.repaymentMethodTitle}>
                {advance.repaymentMethod === "payout_offset"
                  ? "Payout Offset"
                  : advance.repaymentMethod === "auto_deduct"
                  ? "Auto Deduct"
                  : "Manual Payment"}
              </Text>
              <Text style={styles.repaymentMethodDesc}>
                {advance.repaymentMethod === "payout_offset"
                  ? "Deducted from your next circle payout"
                  : advance.repaymentMethod === "auto_deduct"
                  ? "Automatic weekly deductions from wallet"
                  : "You'll make payments manually"}
              </Text>
            </View>
          </View>
        </View>

        {/* XnScore Context */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trust Context</Text>
          <View style={styles.trustCard}>
            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Text style={styles.trustLabel}>XnScore at Request</Text>
                <Text style={styles.trustValue}>{advance.xnScoreAtRequest}</Text>
              </View>
              <View style={styles.trustItem}>
                <Text style={styles.trustLabel}>Tier</Text>
                <Text style={[styles.trustValue, styles.tierValue]}>
                  {advance.tierAtRequest.charAt(0).toUpperCase() + advance.tierAtRequest.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Text style={styles.trustLabel}>Circle Position</Text>
                <Text style={styles.trustValue}>#{advance.memberPosition}</Text>
              </View>
              <View style={styles.trustItem}>
                <Text style={styles.trustLabel}>Expected Payout</Text>
                <Text style={styles.trustValue}>
                  {formatAmount(advance.expectedPayoutAmount, advance.currency)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timelineCard}>
            <TimelineItem
              icon="document-text"
              title="Request Submitted"
              date={formatDateTime(advance.requestDate)}
              isComplete={true}
              isLast={!advance.approvalDate && advance.status !== "rejected"}
            />
            {advance.status === "rejected" ? (
              <TimelineItem
                icon="close-circle"
                title="Request Rejected"
                date={advance.approvalDate ? formatDateTime(advance.approvalDate) : ""}
                isComplete={true}
                isLast={true}
                isError={true}
              />
            ) : (
              <>
                <TimelineItem
                  icon="checkmark-circle"
                  title="Approved"
                  date={advance.approvalDate ? formatDateTime(advance.approvalDate) : "Pending..."}
                  isComplete={!!advance.approvalDate}
                  isLast={!advance.disbursementDate && advance.status !== "completed"}
                />
                <TimelineItem
                  icon="cash"
                  title="Disbursed"
                  date={advance.disbursementDate ? formatDateTime(advance.disbursementDate) : "Pending..."}
                  isComplete={!!advance.disbursementDate}
                  isLast={advance.status !== "completed"}
                />
                {advance.status === "completed" && (
                  <TimelineItem
                    icon="checkmark-done-circle"
                    title="Fully Repaid"
                    date="Completed"
                    isComplete={true}
                    isLast={true}
                  />
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Button */}
      {advance.status === "approved" && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDisburse}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Receive Funds</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {["disbursed", "repaying"].includes(advance.status) && advance.repaymentMethod === "manual" && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleMakeRepayment}
          >
            <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Make Repayment</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// Timeline Item Component
function TimelineItem({
  icon,
  title,
  date,
  isComplete,
  isLast,
  isError = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  date: string;
  isComplete: boolean;
  isLast: boolean;
  isError?: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIconContainer}>
        <View
          style={[
            styles.timelineIcon,
            isComplete
              ? isError
                ? styles.timelineIconError
                : styles.timelineIconComplete
              : styles.timelineIconPending,
          ]}
        >
          <Ionicons
            name={icon}
            size={16}
            color={isComplete ? "#FFFFFF" : "#9CA3AF"}
          />
        </View>
        {!isLast && (
          <View
            style={[
              styles.timelineLine,
              isComplete ? styles.timelineLineComplete : styles.timelineLinePending,
            ]}
          />
        )}
      </View>
      <View style={styles.timelineContent}>
        <Text style={[styles.timelineTitle, !isComplete && styles.timelineTitlePending]}>
          {title}
        </Text>
        <Text style={styles.timelineDate}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A2342",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  circleLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: "#374151",
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00C6AE",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    marginBottom: 12,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  progressDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressItem: {
    alignItems: "center",
  },
  progressItemLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  progressItemValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  totalValue: {
    fontWeight: "700",
    color: "#00C6AE",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  reasonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    marginLeft: 12,
    lineHeight: 20,
  },
  repaymentMethodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  repaymentMethodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  repaymentMethodTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  repaymentMethodDesc: {
    fontSize: 13,
    color: "#6B7280",
  },
  trustCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  trustRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  trustItem: {
    flex: 1,
  },
  trustLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  trustValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  tierValue: {
    color: "#00C6AE",
  },
  timelineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: "row",
  },
  timelineIconContainer: {
    alignItems: "center",
    width: 32,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineIconComplete: {
    backgroundColor: "#00C6AE",
  },
  timelineIconPending: {
    backgroundColor: "#E5E7EB",
  },
  timelineIconError: {
    backgroundColor: "#EF4444",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
  },
  timelineLineComplete: {
    backgroundColor: "#00C6AE",
  },
  timelineLinePending: {
    backgroundColor: "#E5E7EB",
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 20,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  timelineTitlePending: {
    color: "#9CA3AF",
  },
  timelineDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  bottomPadding: {
    height: 100,
  },
  actionContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0A2342",
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  actionButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
