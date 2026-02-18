import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

type PaymentStatus = "completed" | "pending" | "missed" | "upcoming";

interface Payment {
  id: string;
  cycleNumber: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  method?: string;
  transactionId?: string;
  recipientName?: string;
}

interface PaymentHistoryParams {
  circleName?: string;
  circleId?: string;
}

// Mock payment data - in real app this would come from API
const mockPayments: Payment[] = [
  {
    id: "1",
    cycleNumber: 1,
    amount: 100,
    dueDate: "2025-01-15",
    paidDate: "2025-01-14",
    status: "completed",
    method: "Bank Transfer",
    transactionId: "TXN-001-ABC123",
    recipientName: "Marie K.",
  },
  {
    id: "2",
    cycleNumber: 2,
    amount: 100,
    dueDate: "2025-02-15",
    paidDate: "2025-02-15",
    status: "completed",
    method: "Mobile Money",
    transactionId: "TXN-002-DEF456",
    recipientName: "Jean P.",
  },
  {
    id: "3",
    cycleNumber: 3,
    amount: 100,
    dueDate: "2025-03-15",
    paidDate: "2025-03-16",
    status: "completed",
    method: "Bank Transfer",
    transactionId: "TXN-003-GHI789",
    recipientName: "You",
  },
  {
    id: "4",
    cycleNumber: 4,
    amount: 100,
    dueDate: "2025-04-15",
    status: "missed",
    recipientName: "Paul M.",
  },
  {
    id: "5",
    cycleNumber: 5,
    amount: 100,
    dueDate: "2025-05-15",
    status: "pending",
    recipientName: "Sarah L.",
  },
  {
    id: "6",
    cycleNumber: 6,
    amount: 100,
    dueDate: "2025-06-15",
    status: "upcoming",
    recipientName: "David N.",
  },
  {
    id: "7",
    cycleNumber: 7,
    amount: 100,
    dueDate: "2025-07-15",
    status: "upcoming",
    recipientName: "Emma T.",
  },
];

export default function PaymentHistoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as PaymentHistoryParams) || {};
  const circleName = params.circleName || "Family Savings Circle";

  const [filter, setFilter] = useState<"all" | PaymentStatus>("all");
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  const filteredPayments =
    filter === "all"
      ? mockPayments
      : mockPayments.filter((p) => p.status === filter);

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "completed":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "missed":
        return "#EF4444";
      case "upcoming":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "pending":
        return "time";
      case "missed":
        return "close-circle";
      case "upcoming":
        return "calendar-outline";
      default:
        return "help-circle";
    }
  };

  const getStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case "completed":
        return "Paid";
      case "pending":
        return "Due Now";
      case "missed":
        return "Missed";
      case "upcoming":
        return "Upcoming";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateSummary = () => {
    const completed = mockPayments.filter(
      (p) => p.status === "completed"
    ).length;
    const missed = mockPayments.filter((p) => p.status === "missed").length;
    const pending = mockPayments.filter((p) => p.status === "pending").length;
    const totalPaid = mockPayments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.amount, 0);

    return { completed, missed, pending, totalPaid };
  };

  const summary = calculateSummary();

  const toggleExpand = (paymentId: string) => {
    setExpandedPayment(expandedPayment === paymentId ? null : paymentId);
  };

  const renderPaymentCard = (payment: Payment) => {
    const isExpanded = expandedPayment === payment.id;
    const statusColor = getStatusColor(payment.status);

    return (
      <TouchableOpacity
        key={payment.id}
        style={[styles.paymentCard, isExpanded && styles.paymentCardExpanded]}
        onPress={() => toggleExpand(payment.id)}
        activeOpacity={0.7}
      >
        <View style={styles.paymentHeader}>
          <View style={styles.paymentLeft}>
            <View
              style={[styles.cycleIndicator, { backgroundColor: statusColor }]}
            >
              <Text style={styles.cycleNumber}>{payment.cycleNumber}</Text>
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>Cycle {payment.cycleNumber}</Text>
              <Text style={styles.paymentRecipient}>
                To: {payment.recipientName}
              </Text>
            </View>
          </View>
          <View style={styles.paymentRight}>
            <Text style={styles.paymentAmount}>${payment.amount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Ionicons
                name={getStatusIcon(payment.status)}
                size={14}
                color={statusColor}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(payment.status)}
              </Text>
            </View>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.paymentDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date</Text>
              <Text style={styles.detailValue}>{formatDate(payment.dueDate)}</Text>
            </View>
            {payment.paidDate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Paid Date</Text>
                <Text style={styles.detailValue}>
                  {formatDate(payment.paidDate)}
                </Text>
              </View>
            )}
            {payment.method && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailValue}>{payment.method}</Text>
              </View>
            )}
            {payment.transactionId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction ID</Text>
                <Text style={[styles.detailValue, styles.transactionId]}>
                  {payment.transactionId}
                </Text>
              </View>
            )}
            {payment.status === "pending" && (
              <TouchableOpacity style={styles.payNowButton}>
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                <Text style={styles.payNowText}>Pay Now</Text>
              </TouchableOpacity>
            )}
            {payment.status === "missed" && (
              <View style={styles.missedWarning}>
                <Ionicons name="warning" size={16} color="#EF4444" />
                <Text style={styles.missedWarningText}>
                  Please contact your Circle Admin to resolve this payment.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.expandIndicator}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#9CA3AF"
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Payment History</Text>
          <Text style={styles.headerSubtitle}>{circleName}</Text>
        </View>
        <TouchableOpacity style={styles.downloadButton}>
          <Ionicons name="download-outline" size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
            <Text style={styles.summaryLabel}>Total Contributed</Text>
            <Text style={styles.summaryValueLarge}>${summary.totalPaid}</Text>
            <Text style={styles.summarySubtext}>
              {summary.completed} payments completed
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryCardSmall]}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.summaryCount}>{summary.completed}</Text>
              <Text style={styles.summaryLabelSmall}>Completed</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardSmall]}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="time" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.summaryCount}>{summary.pending}</Text>
              <Text style={styles.summaryLabelSmall}>Pending</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardSmall]}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </View>
              <Text style={styles.summaryCount}>{summary.missed}</Text>
              <Text style={styles.summaryLabelSmall}>Missed</Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: "all", label: "All" },
              { key: "completed", label: "Completed" },
              { key: "pending", label: "Pending" },
              { key: "missed", label: "Missed" },
              { key: "upcoming", label: "Upcoming" },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterTab,
                  filter === item.key && styles.filterTabActive,
                ]}
                onPress={() => setFilter(item.key as any)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === item.key && styles.filterTabTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Payment List */}
        <View style={styles.paymentList}>
          <Text style={styles.sectionTitle}>
            {filter === "all" ? "All Payments" : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Payments`}
          </Text>
          {filteredPayments.length > 0 ? (
            filteredPayments.map(renderPaymentCard)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>
                No {filter} payments found
              </Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#2563EB" />
            <Text style={styles.infoText}>
              Tap on any payment to view details. Download your full payment
              history using the button above.
            </Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  downloadButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryCardPrimary: {
    backgroundColor: "#2563EB",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  summaryValueLarge: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginVertical: 4,
  },
  summarySubtext: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCardSmall: {
    flex: 1,
    alignItems: "center",
  },
  summaryIconContainer: {
    marginBottom: 8,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  summaryLabelSmall: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 16,
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
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterTabText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  paymentList: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  paymentCardExpanded: {
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cycleIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cycleNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  paymentRecipient: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  paymentRight: {
    alignItems: "flex-end",
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  paymentDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
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
  transactionId: {
    fontFamily: "monospace",
    fontSize: 12,
  },
  payNowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  payNowText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  missedWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  missedWarningText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
  },
  expandIndicator: {
    alignItems: "center",
    marginTop: 8,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  infoSection: {
    padding: 16,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
  bottomPadding: {
    height: 40,
  },
});
